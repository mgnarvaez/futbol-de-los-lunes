import { supabase } from "@/integrations/supabase/client";
import { SEDES, type EquipoAsignado, type Inscripcion, type Sede } from "@/lib/types";

export interface GrupoSede {
  titulares: EquipoAsignado[];
  suplentes: EquipoAsignado[];
}

export interface ResultadoArmado {
  equipos: Map<Sede, GrupoSede>;
  noAsignados: Inscripcion[];
}

export const armadorService = {
  async armarEquipos(convocatoriaId: string): Promise<ResultadoArmado> {
    // 1. Obtener inscripciones, configuración y convocatoria
    const [resInsc, resConfig, resConv] = await Promise.all([
      supabase
        .from("inscripciones")
        .select("*, jugador:jugadores(*)")
        .eq("convocatoria_id", convocatoriaId)
        .order("timestamp_inscripcion", { ascending: true }),
      supabase
        .from("configuracion_panel")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("convocatorias")
        .select("*")
        .eq("id", convocatoriaId)
        .single(),
    ]);

    if (resInsc.error) throw resInsc.error;
    if (resConfig.error) throw resConfig.error;
    if (resConv.error) throw resConv.error;

    const inscripciones = resInsc.data;
    const config = resConfig.data;
    const convocatoria = resConv.data;

    const suspensionLluvia = Boolean(
      (convocatoria as { suspension_lluvia?: boolean }).suspension_lluvia
    );
    const sedesCanceladas =
      ((convocatoria as { sedes_canceladas?: string[] }).sedes_canceladas ?? []) as string[];
    const puertos10vs10 = Boolean(
      (config as { puertos_10vs10?: boolean } | null)?.puertos_10vs10
    );

    // 2. Capacidades estándar de las sedes
    const capacidades: Record<Sede, number> = {
      CANTON: 14,
      SM: 16,
      PUERTOS: puertos10vs10 ? 20 : 14,
    };

    // 3. Filtrar por lluvia y suspensiones de sede
    const jugadoresValidos = ((inscripciones ?? []) as unknown as Inscripcion[]).filter(
      (insc) => {
        if (suspensionLluvia && !insc.juega_con_lluvia) return false;
        if (sedesCanceladas.includes(insc.sede_preferida) && !insc.flexible) return false;
        return true;
      }
    );

    // 4. Orden de prioridad individual ESTRICTO (Pago al día -> VIP -> Antigüedad/Índice)
    const compararPrioridad = (a: Inscripcion, b: Inscripcion) => {
      const pagoA = a.jugador?.estado_pago === "AL_DÍA";
      const pagoB = b.jugador?.estado_pago === "AL_DÍA";
      if (pagoA !== pagoB) return pagoA ? -1 : 1;

      const vipA = Boolean(a.jugador?.es_vip);
      const vipB = Boolean(b.jugador?.es_vip);
      if (vipA !== vipB) return vipA ? -1 : 1;

      return (
        new Date(a.timestamp_inscripcion).getTime() -
        new Date(b.timestamp_inscripcion).getTime()
      );
    };

    jugadoresValidos.sort(compararPrioridad);

    // 5. CALCULAR DEMANDA PARA ORDENAR QUÉ SEDE SE ARMA PRIMERO
    const ordenSedes: Sede[] = [...SEDES];
    const demandaSedes: Record<Sede, number> = { CANTON: 0, SM: 0, PUERTOS: 0 };

    jugadoresValidos.forEach((jug) => {
      if (demandaSedes[jug.sede_preferida] !== undefined) {
        demandaSedes[jug.sede_preferida]++;
      }
    });

    // Ordena sedes de mayor a menor preferencia inicial
    ordenSedes.sort((a, b) => demandaSedes[b] - demandaSedes[a]);

    // 6. ASIGNACIÓN INICIAL POR PRIORIDAD ESTRICTA
    const sedes: Record<Sede, { titulares: Inscripcion[]; suplentes: Inscripcion[] }> = {
      CANTON: { titulares: [], suplentes: [] },
      SM: { titulares: [], suplentes: [] },
      PUERTOS: { titulares: [], suplentes: [] },
    };

    const noAsignados: Inscripcion[] = [];

    for (const jug of jugadoresValidos) {
      let asignado = false;
      const pref = jug.sede_preferida;

      // 1. Intenta entrar en su sede preferida
      if (!sedesCanceladas.includes(pref) && sedes[pref].titulares.length < capacidades[pref]) {
        sedes[pref].titulares.push(jug);
        asignado = true;
      }

      // 2. Si no pudo y es FLEXIBLE, busca en orden de demanda de las sedes
      if (!asignado && jug.flexible) {
        for (const otraSede of ordenSedes) {
          if (
            !sedesCanceladas.includes(otraSede) &&
            sedes[otraSede].titulares.length < capacidades[otraSede]
          ) {
            sedes[otraSede].titulares.push(jug);
            asignado = true;
            break;
          }
        }
      }

      // 3. Si no logró entrar como titular, va a suplentes
      if (!asignado) {
        if (!sedesCanceladas.includes(pref)) {
          sedes[pref].suplentes.push(jug);
        } else {
          const primeraActiva = ordenSedes.find((s) => !sedesCanceladas.includes(s));
          if (primeraActiva) {
            sedes[primeraActiva].suplentes.push(jug);
          } else {
            sedes[pref].suplentes.push(jug);
          }
        }
        if (!jug.flexible) noAsignados.push(jug);
      }
    }

    // 7. LÓGICA DE OPTIMIZACIÓN (TRUEQUE CONDICIONADO A LLENAR LA SEDE INCOMPLETA)
    ordenSedes.forEach((sedeIncompleta) => {
      if (!sedesCanceladas.includes(sedeIncompleta)) {
        const cupoTotal = capacidades[sedeIncompleta];
        const anotados = sedes[sedeIncompleta].titulares.length;
        const faltantes = cupoTotal - anotados;

        if (faltantes > 0) {
          // Contar cuántos trueques totales son posibles desde las sedes llenas
          let truequesDisponibles = 0;
          ordenSedes.forEach((otraSede) => {
            if (otraSede !== sedeIncompleta && !sedesCanceladas.includes(otraSede)) {
              const flexiblesEnConv = sedes[otraSede].titulares.filter((j) => j.flexible).length;
              const suplentesEsperando = sedes[otraSede].suplentes.length;
              truequesDisponibles += Math.min(flexiblesEnConv, suplentesEsperando);
            }
          });

          // SOLO se ejecutan cambios si los trueques alcanzan para LLENAR la sede
          if (truequesDisponibles >= faltantes) {
            while (sedes[sedeIncompleta].titulares.length < cupoTotal) {
              let truequeRealizado = false;

              for (const sedeLlena of ordenSedes) {
                if (
                  sedeLlena !== sedeIncompleta &&
                  !sedesCanceladas.includes(sedeLlena) &&
                  sedes[sedeLlena].suplentes.length > 0
                ) {
                  // Buscar de atrás para adelante al flexible de MENOR prioridad en la sede llena
                  let indexFlexible = -1;
                  for (let j = sedes[sedeLlena].titulares.length - 1; j >= 0; j--) {
                    if (sedes[sedeLlena].titulares[j].flexible) {
                      indexFlexible = j;
                      break;
                    }
                  }

                  if (indexFlexible !== -1) {
                    // Mover al jugador flexible a la sede incompleta
                    const jugadorFlexible = sedes[sedeLlena].titulares.splice(indexFlexible, 1)[0];
                    sedes[sedeIncompleta].titulares.push(jugadorFlexible);

                    // Ascender al primer suplente de la sede llena a titular
                    const suplentePromovido = sedes[sedeLlena].suplentes.shift()!;
                    sedes[sedeLlena].titulares.push(suplentePromovido);

                    truequeRealizado = true;
                    break;
                  }
                }
              }
              if (!truequeRealizado) break;
            }
          }
        }
      }
    });

    // 8. Reordenar titularidades y suplencias por prioridad tras los trueques
    for (const sede of SEDES) {
      sedes[sede].titulares.sort(compararPrioridad);
      sedes[sede].suplentes.sort(compararPrioridad);
    }

    // 9. Limpiar y persistir en Supabase
    const { error: errDelete } = await supabase
      .from("equipos_asignados")
      .delete()
      .eq("convocatoria_id", convocatoriaId);

    if (errDelete) throw errDelete;

    let ordenConvocatoria = 1;
    const filas: Record<string, unknown>[] = [];
    const idsTitulares: string[] = [];
    const idsSuplentes: string[] = [];

    for (const sede of SEDES) {
      for (const insc of sedes[sede].titulares) {
        idsTitulares.push(insc.id);
        filas.push({
          convocatoria_id: convocatoriaId,
          sede_id: sede,
          jugador_id: insc.jugador_id,
          tipo_asignacion: "TITULAR",
          orden_convocatoria: ordenConvocatoria++,
        });
      }
      for (const insc of sedes[sede].suplentes) {
        idsSuplentes.push(insc.id);
        filas.push({
          convocatoria_id: convocatoriaId,
          sede_id: sede,
          jugador_id: insc.jugador_id,
          tipo_asignacion: "SUPLENTE",
          orden_convocatoria: ordenConvocatoria++,
        });
      }
    }

    if (filas.length > 0) {
      const { error: errInsert } = await supabase.from("equipos_asignados").insert(filas as never);
      if (errInsert) throw errInsert;
    }

    // 10. Actualizar estados de inscripción en lote
    const promesasActualizacion = [];
    if (idsTitulares.length > 0) {
      promesasActualizacion.push(
        supabase
          .from("inscripciones")
          .update({ estado: "CONVOCADO", motivo_no_asignacion: null })
          .in("id", idsTitulares)
      );
    }
    if (idsSuplentes.length > 0) {
      promesasActualizacion.push(
        supabase
          .from("inscripciones")
          .update({ estado: "SUPLENTE", motivo_no_asignacion: "Sin lugar como titular" })
          .in("id", idsSuplentes)
      );
    }

    await Promise.all(promesasActualizacion);

    return {
      equipos: await armadorService.obtenerEquipos(convocatoriaId),
      noAsignados,
    };
  },

  async obtenerEquipos(convocatoriaId: string): Promise<Map<Sede, GrupoSede>> {
    const { data, error } = await supabase
      .from("equipos_asignados")
      .select("*, jugador:jugadores(*)")
      .eq("convocatoria_id", convocatoriaId)
      .order("sede_id", { ascending: true })
      .order("orden_convocatoria", { ascending: true });

    if (error) throw error;

    const filas = (data ?? []) as unknown as EquipoAsignado[];
    const equipos = new Map<Sede, GrupoSede>();

    for (const sede of SEDES) {
      equipos.set(sede, {
        titulares: filas.filter((e) => e.sede_id === sede && e.tipo_asignacion === "TITULAR"),
        suplentes: filas.filter((e) => e.sede_id === sede && e.tipo_asignacion === "SUPLENTE"),
      });
    }

    return equipos;
  },
};
