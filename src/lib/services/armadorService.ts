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
    // 1. Obtener inscripciones, configuración y convocatoria en paralelo
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

    // 3. FILTRADO POR LLUVIA
    // Excluye automáticamente a quienes marcaron que NO juegan con lluvia si hay suspensión activa
    const jugadoresValidos = ((inscripciones ?? []) as unknown as Inscripcion[]).filter(
      (insc) => {
        if (suspensionLluvia && !insc.juega_con_lluvia) {
          return false;
        }
        return true;
      }
    );

    // 4. Orden de prioridad estricto (Pago al día -> VIP -> Antigüedad/Inscripción)
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

    // 5. Ordenar sedes por cantidad de demanda inicial
    const ordenSedes: Sede[] = [...SEDES];
    const demandaSedes: Record<Sede, number> = { CANTON: 0, SM: 0, PUERTOS: 0 };

    jugadoresValidos.forEach((jug) => {
      if (demandaSedes[jug.sede_preferida] !== undefined) {
        demandaSedes[jug.sede_preferida]++;
      }
    });

    ordenSedes.sort((a, b) => demandaSedes[b] - demandaSedes[a]);
    const sedesDisponibles = ordenSedes.filter((s) => !sedesCanceladas.includes(s));

    // 6. ASIGNACIÓN INICIAL CON REDIRECCIÓN DE SEDES SUSPENDIDAS
    const sedes: Record<Sede, { titulares: Inscripcion[]; suplentes: Inscripcion[] }> = {
      CANTON: { titulares: [], suplentes: [] },
      SM: { titulares: [], suplentes: [] },
      PUERTOS: { titulares: [], suplentes: [] },
    };

    const noAsignados: Inscripcion[] = [];

    for (const jug of jugadoresValidos) {
      let asignado = false;
      const pref = jug.sede_preferida;
      const sedePreferidaCancelada = sedesCanceladas.includes(pref);

      // A) Intenta entrar en su sede preferida si NO está suspendida
      if (!sedePreferidaCancelada && sedes[pref].titulares.length < capacidades[pref]) {
        sedes[pref].titulares.push(jug);
        asignado = true;
      }

      // B) Si no pudo entrar a su preferida y es FLEXIBLE O su sede preferida está suspendida
      if (!asignado && (jug.flexible || sedePreferidaCancelada)) {
        for (const otraSede of sedesDisponibles) {
          if (sedes[otraSede].titulares.length < capacidades[otraSede]) {
            sedes[otraSede].titulares.push(jug);
            asignado = true;
            break;
          }
        }
      }

      // C) Si no logró entrar como titular en ninguna sede activa
      if (!asignado) {
        if (!sedePreferidaCancelada) {
          sedes[pref].suplentes.push(jug);
        } else {
          const primeraActiva = sedesDisponibles[0];
          if (primeraActiva) {
            sedes[primeraActiva].suplentes.push(jug);
          } else {
            sedes[pref].suplentes.push(jug);
          }
        }
        if (!jug.flexible && !sedePreferidaCancelada) noAsignados.push(jug);
      }
    }

    // 7. LÓGICA DE TRUEQUE CONDICIONADO A LLENAR LA SEDE
    sedesDisponibles.forEach((sedeIncompleta) => {
      const cupoTotal = capacidades[sedeIncompleta];
      const anotados = sedes[sedeIncompleta].titulares.length;
      const faltantes = cupoTotal - anotados;

      if (faltantes > 0) {
        let truequesDisponibles = 0;
        sedesDisponibles.forEach((otraSede) => {
          if (otraSede !== sedeIncompleta) {
            const flexiblesEnConv = sedes[otraSede].titulares.filter((j) => j.flexible).length;
            const suplentesEsperando = sedes[otraSede].suplentes.length;
            truequesDisponibles += Math.min(flexiblesEnConv, suplentesEsperando);
          }
        });

        // SOLO realiza trueques si alcanzan para completar la sede
        if (truequesDisponibles >= faltantes) {
          while (sedes[sedeIncompleta].titulares.length < cupoTotal) {
            let truequeRealizado = false;

            for (const sedeLlena of sedesDisponibles) {
              if (sedeLlena !== sedeIncompleta && sedes[sedeLlena].suplentes.length > 0) {
                let indexFlexible = -1;
                for (let j = sedes[sedeLlena].titulares.length - 1; j >= 0; j--) {
                  if (sedes[sedeLlena].titulares[j].flexible) {
                    indexFlexible = j;
                    break;
                  }
                }

                if (indexFlexible !== -1) {
                  const jugadorFlexible = sedes[sedeLlena].titulares.splice(indexFlexible, 1)[0];
                  sedes[sedeIncompleta].titulares.push(jugadorFlexible);

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
    });

    // 8. Reordenar listas finales por prioridad
    for (const sede of SEDES) {
      sedes[sede].titulares.sort(compararPrioridad);
      sedes[sede].suplentes.sort(compararPrioridad);
    }

    // 9. Persistir cambios en la base de datos Supabase
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

    // 10. Actualización de estados en lote
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
