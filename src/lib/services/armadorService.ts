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

const esVerdadero = (val: unknown): boolean => {
  if (typeof val === "boolean") return val;
  if (typeof val === "number") return val === 1;
  if (typeof val === "string") {
    const v = val.trim().toLowerCase();
    return v === "si" || v === "sí" || v === "true" || v === "1" || v === "s";
  }
  return false;
};

const esFlexible = (val: unknown): boolean => {
  if (typeof val === "boolean") return val;
  if (typeof val === "number") return val === 1;
  if (typeof val === "string") {
    const v = val.trim().toLowerCase();
    if (v.includes("solo") || v.includes("no") || v === "false" || v === "0" || v === "n") {
      return false;
    }
    if (v.includes("cualquier") || v.includes("flexible") || v.includes("si") || v.includes("sí") || v === "1" || v === "s") {
      return true;
    }
  }
  return false;
};

const jugadorAceptaLluvia = (insc: Inscripcion): boolean => {
  const record = insc as unknown as Record<string, unknown>;
  const jugadorRecord = (record["jugador"] as Record<string, unknown>) || {};

  const claves = [
    "juega_con_lluvia", "juega_lluvia", "juegaConLluvia",
    "si_llueve_juega", "juega_si_llueve", "lluvia",
  ];
  const posiblesValores = [
    ...claves.map((k) => record[k]),
    ...claves.map((k) => jugadorRecord[k]),
  ];


  for (const val of posiblesValores) {
    if (val === undefined || val === null) continue;
    if (typeof val === "boolean") return val;
    if (typeof val === "number") return val === 1;
    if (typeof val === "string") {
      const v = val.trim().toLowerCase();
      if (v.includes("no") || v.includes("false") || v === "0" || v === "n") return false;
      if (v.includes("si") || v.includes("sí") || v.includes("true") || v === "1" || v === "s") return true;
    }
  }
  return true;
};

export const armadorService = {
  async armarEquipos(convocatoriaId: string): Promise<ResultadoArmado> {
    // 0. Borrón y cuenta nueva: limpiar asignaciones previas
    await supabase
      .from("equipos_asignados")
      .delete()
      .eq("convocatoria_id", convocatoriaId);

    await supabase
      .from("inscripciones")
      .update({ estado: "PENDIENTE", motivo_no_asignacion: null })
      .eq("convocatoria_id", convocatoriaId);

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

    const convRecord = convocatoria as unknown as Record<string, unknown>;
    const configRecord = config as unknown as Record<string, unknown> | null;

    const suspensionLluvia =
      esVerdadero(convRecord?.["suspension_lluvia"]) ||
      esVerdadero(convRecord?.["lluvia"]) ||
      esVerdadero(configRecord?.["suspension_lluvia"]) ||
      esVerdadero(configRecord?.["lluvia"]);

    let sedesCanceladas = ((convRecord?.["sedes_canceladas"] as string[]) ?? []) as string[];

    if (suspensionLluvia && !sedesCanceladas.includes("CANTON")) {
      sedesCanceladas = [...sedesCanceladas, "CANTON"];
    }

    const puertos10vs10 = esVerdadero(configRecord?.["puertos_10vs10"]);

    const capacidades: Record<Sede, number> = {
      CANTON: 14,
      SM: 16,
      PUERTOS: puertos10vs10 ? 20 : 14,
    };

    // 2. FILTRADO Y PROTECCIÓN ANTI-DUPLICADOS (Por ID de jugador o Correo)
    const jugadoresValidos: Inscripcion[] = [];
    const idsExcluidosLluvia: string[] = [];
    const emailsVistos = new Set<string>();

    ((inscripciones ?? []) as unknown as Inscripcion[]).forEach((insc) => {
      const emailJugador = (insc.jugador as any)?.email?.trim().toLowerCase() || insc.jugador_id;
      
      // Si ya procesamos a este jugador en esta misma lista, lo ignoramos (evita duplicado)
      if (emailsVistos.has(emailJugador)) {
        return; 
      }

      if (suspensionLluvia && !jugadorAceptaLluvia(insc)) {
        idsExcluidosLluvia.push(insc.id);
      } else {
        emailsVistos.add(emailJugador);
        jugadoresValidos.push(insc);
      }
    });

    // 3. Orden de prioridad estricto: 1° Pago al día -> 2° VIP -> 3° Timestamp
    const compararPrioridad = (a: Inscripcion, b: Inscripcion) => {
      const pagoA = a.jugador?.estado_pago === "AL_DÍA";
      const pagoB = b.jugador?.estado_pago === "AL_DÍA";
      if (pagoA !== pagoB) return pagoA ? -1 : 1;

      const vipA = Boolean(a.jugador?.es_vip);
      const vipB = Boolean(b.jugador?.es_vip);
      if (vipA !== vipB) return vipA ? -1 : 1;

      return new Date(a.timestamp_inscripcion).getTime() - new Date(b.timestamp_inscripcion).getTime();
    };

    jugadoresValidos.sort(compararPrioridad);

    // 4. Calcular demanda para ordenar sedes
    const ordenSedes: Sede[] = [...SEDES];
    const demandaSedes: Record<Sede, number> = { CANTON: 0, SM: 0, PUERTOS: 0 };

    jugadoresValidos.forEach((jug) => {
      if (demandaSedes[jug.sede_preferida] !== undefined) {
        demandaSedes[jug.sede_preferida]++;
      }
    });

    ordenSedes.sort((a, b) => demandaSedes[b] - demandaSedes[a]);

    // 5. Asignación limpia
    const sedes: Record<Sede, { titulares: Inscripcion[]; suplentes: Inscripcion[] }> = {
      CANTON: { titulares: [], suplentes: [] },
      SM: { titulares: [], suplentes: [] },
      PUERTOS: { titulares: [], suplentes: [] },
    };

    const noAsignados: Inscripcion[] = [];

    for (const jug of jugadoresValidos) {
      let asignado = false;
      const pref = jug.sede_preferida;
      const sedeActiva = !sedesCanceladas.includes(pref);
      const jugFlexible = esFlexible(jug.flexible);

      if (sedeActiva && sedes[pref].titulares.length < capacidades[pref]) {
        sedes[pref].titulares.push(jug);
        asignado = true;
      }

      if (!asignado && jugFlexible) {
        for (const otraSede of ordenSedes) {
          if (!sedesCanceladas.includes(otraSede) && sedes[otraSede].titulares.length < capacidades[otraSede]) {
            sedes[otraSede].titulares.push(jug);
            asignado = true;
            break;
          }
        }
      }

      if (!asignado) {
        if (sedeActiva) {
          sedes[pref].suplentes.push(jug);
        } else {
          const primeraActiva = ordenSedes.find((s) => !sedesCanceladas.includes(s));
          if (primeraActiva) {
            sedes[primeraActiva].suplentes.push(jug);
          } else {
            sedes[pref].suplentes.push(jug);
          }
        }
        if (!jugFlexible && !sedeActiva) noAsignados.push(jug);
      }
    }

    // 6. Trueque condicionado a llenar la sede
    ordenSedes.forEach((sedeIncompleta) => {
      if (!sedesCanceladas.includes(sedeIncompleta)) {
        const cupoTotal = capacidades[sedeIncompleta];
        const anotados = sedes[sedeIncompleta].titulares.length;
        const faltantes = cupoTotal - anotados;

        if (faltantes > 0) {
          let truequesDisponibles = 0;
          ordenSedes.forEach((otraSede) => {
            if (otraSede !== sedeIncompleta && !sedesCanceladas.includes(otraSede)) {
              const flexiblesEnConv = sedes[otraSede].titulares.filter((j) => esFlexible(j.flexible)).length;
              const suplentesEsperando = sedes[otraSede].suplentes.length;
              truequesDisponibles += Math.min(flexiblesEnConv, suplentesEsperando);
            }
          });

          if (truequesDisponibles >= faltantes) {
            while (sedes[sedeIncompleta].titulares.length < cupoTotal) {
              let truequeRealizado = false;

              for (const sedeLlena of ordenSedes) {
                if (
                  sedeLlena !== sedeIncompleta &&
                  !sedesCanceladas.includes(sedeLlena) &&
                  sedes[sedeLlena].suplentes.length > 0
                ) {
                  let indexFlexible = -1;
                  for (let j = sedes[sedeLlena].titulares.length - 1; j >= 0; j--) {
                    if (esFlexible(sedes[sedeLlena].titulares[j]?.flexible)) {
                      indexFlexible = j;
                      break;
                    }
                  }

                  if (indexFlexible !== -1) {
                    const jugadorFlexible = sedes[sedeLlena].titulares.splice(indexFlexible, 1)[0];
                    if (jugadorFlexible) sedes[sedeIncompleta].titulares.push(jugadorFlexible);

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

    // 7. Ordenar listas finales
    for (const sede of SEDES) {
      sedes[sede].titulares.sort(compararPrioridad);
      sedes[sede].suplentes.sort(compararPrioridad);
    }

    // 8. Persistir en Supabase
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
      const { error: errInsert } = await supabase
        .from("equipos_asignados")
        .upsert(filas as never, { onConflict: "convocatoria_id,jugador_id" });
      if (errInsert) throw errInsert;
    }

    // 9. Actualización de estados
    const promesasActualizacion = [];
    if (idsTitulares.length > 0) {
      promesasActualizacion.push(
        supabase.from("inscripciones").update({ estado: "CONVOCADO", motivo_no_asignacion: null }).in("id", idsTitulares)
      );
    }
    if (idsSuplentes.length > 0) {
      promesasActualizacion.push(
        supabase.from("inscripciones").update({ estado: "SUPLENTE", motivo_no_asignacion: "Sin lugar como titular" }).in("id", idsSuplentes)
      );
    }
    if (idsExcluidosLluvia.length > 0) {
      promesasActualizacion.push(
        supabase.from("inscripciones").update({ estado: "NO_CONVOCADO", motivo_no_asignacion: "No juega con lluvia" }).in("id", idsExcluidosLluvia)
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
        titulares: filesFilter(filas, sede, "TITULAR"),
        suplentes: filesFilter(filas, sede, "SUPLENTE"),
      });
    }

    return equipos;
  },
};

// Función auxiliar interna para filtrar de forma limpia
function filesFilter(filas: EquipoAsignado[], sede: Sede, tipo: string) {
  return filas.filter((e) => e.sede_id === sede && e.tipo_asignacion === tipo);
}
