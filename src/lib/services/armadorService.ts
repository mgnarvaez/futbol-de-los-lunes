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
  // Función principal: Armar equipos automáticamente
  async armarEquipos(convocatoriaId: string): Promise<ResultadoArmado> {
    // 1. Obtener inscripciones
    const { data: inscripciones, error: errInsc } = await supabase
      .from("inscripciones")
      .select("*, jugador:jugadores(*)")
      .eq("convocatoria_id", convocatoriaId)
      .order("timestamp_inscripcion", { ascending: true });

    if (errInsc) throw errInsc;

    // 2. Obtener configuración
    const { data: config, error: errConfig } = await supabase
      .from("configuracion_panel")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (errConfig) throw errConfig;

    // 3. Estado de la convocatoria (lluvia / sedes canceladas)
    const { data: convocatoria, error: errConv } = await supabase
      .from("convocatorias")
      .select("*")
      .eq("id", convocatoriaId)
      .single();

    if (errConv) throw errConv;

    const suspensionLluvia = Boolean(
      (convocatoria as { suspension_lluvia?: boolean }).suspension_lluvia,
    );
    const sedesCanceladas =
      ((convocatoria as { sedes_canceladas?: string[] }).sedes_canceladas ?? []) as string[];
    const puertos10vs10 = Boolean(
      (config as { puertos_10vs10?: boolean } | null)?.puertos_10vs10,
    );

    // 4. Capacidades de sedes
    const capacidades: Record<Sede, number> = {
      CANTON: 14,
      SM: 16,
      PUERTOS: puertos10vs10 ? 20 : 14,
    };

    // 5. Limpiar armado previo
    const { error: errDelete } = await supabase
      .from("equipos_asignados")
      .delete()
      .eq("convocatoria_id", convocatoriaId);

    if (errDelete) throw errDelete;

    // 6. Filtrar por lluvia y suspensiones
    const jugadoresValidos = ((inscripciones ?? []) as unknown as Inscripcion[]).filter(
      (insc) => {
        if (suspensionLluvia && !insc.juega_con_lluvia) return false;
        if (sedesCanceladas.includes(insc.sede_preferida) && !insc.flexible) return false;
        return true;
      },
    );

    // 7. Ordenar por prioridad (VIP → pago al día → antigüedad)
    jugadoresValidos.sort((a, b) => {
      const ja = a.jugador;
      const jb = b.jugador;

      if (ja && jb && ja.es_vip !== jb.es_vip) return ja.es_vip ? -1 : 1;
      if (ja && jb && ja.estado_pago !== jb.estado_pago)
        return ja.estado_pago === "AL_DÍA" ? -1 : 1;

      return (
        new Date(a.timestamp_inscripcion).getTime() -
        new Date(b.timestamp_inscripcion).getTime()
      );
    });

    // 8. Asignar
    const sedes: Record<Sede, { titulares: Inscripcion[]; suplentes: Inscripcion[] }> = {
      CANTON: { titulares: [], suplentes: [] },
      SM: { titulares: [], suplentes: [] },
      PUERTOS: { titulares: [], suplentes: [] },
    };

    const noAsignados: Inscripcion[] = [];
    const sedesDisponibles = SEDES.filter((s) => !sedesCanceladas.includes(s));

    for (const inscripcion of jugadoresValidos) {
      const sedePref = inscripcion.sede_preferida;
      let sedeAsignada: Sede | null = null;

      if (
        !sedesCanceladas.includes(sedePref) &&
        sedes[sedePref].titulares.length < capacidades[sedePref]
      ) {
        sedeAsignada = sedePref;
      } else if (inscripcion.flexible) {
        for (const sede of sedesDisponibles) {
          if (sedes[sede].titulares.length < capacidades[sede]) {
            sedeAsignada = sede;
            break;
          }
        }
      }

      if (sedeAsignada) {
        sedes[sedeAsignada].titulares.push(inscripcion);
      } else {
        const sedeSuplente =
          !sedesCanceladas.includes(sedePref) ? sedePref : (sedesDisponibles[0] ?? sedePref);
        sedes[sedeSuplente].suplentes.push(inscripcion);
        if (!inscripcion.flexible) noAsignados.push(inscripcion);
      }
    }

    // 9. Guardar en BD
    let ordenConvocatoria = 1;
    const filas: Record<string, unknown>[] = [];

    for (const sede of SEDES) {
      for (const insc of sedes[sede].titulares) {
        filas.push({
          convocatoria_id: convocatoriaId,
          sede_id: sede,
          jugador_id: insc.jugador_id,
          tipo_asignacion: "TITULAR",
          orden_convocatoria: ordenConvocatoria++,
        });
      }
      for (const insc of sedes[sede].suplentes) {
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
        .insert(filas as never);
      if (errInsert) throw errInsert;
    }

    // 10. Actualizar estado de inscripciones
    for (const sede of SEDES) {
      for (const insc of sedes[sede].titulares) {
        await supabase
          .from("inscripciones")
          .update({ estado: "CONVOCADO", motivo_no_asignacion: null })
          .eq("id", insc.id);
      }
      for (const insc of sedes[sede].suplentes) {
        await supabase
          .from("inscripciones")
          .update({ estado: "SUPLENTE", motivo_no_asignacion: "Sin lugar como titular" })
          .eq("id", insc.id);
      }
    }

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
        titulares: filas.filter(
          (e) => e.sede_id === sede && e.tipo_asignacion === "TITULAR",
        ),
        suplentes: filas.filter(
          (e) => e.sede_id === sede && e.tipo_asignacion === "SUPLENTE",
        ),
      });
    }

    return equipos;
  },
};
