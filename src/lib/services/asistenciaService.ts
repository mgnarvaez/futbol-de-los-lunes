import { supabase } from "@/integrations/supabase/client";
import type { HistorialAsistencia } from "@/lib/types";

type EstadoAsistencia = "ASISTIÓ" | "SE_BAJÓ" | "NO_APARECIÓ";

export const asistenciaService = {
  async registrarAsistencia(
    jugadorId: string,
    convocatoriaId: string,
    sedeId: string,
    asistio: boolean,
    estado: EstadoAsistencia,
    motivo?: string,
  ): Promise<HistorialAsistencia> {
    const { data, error } = await supabase
      .from("historial_asistencias")
      .insert([
        {
          jugador_id: jugadorId,
          convocatoria_id: convocatoriaId,
          sede_id: sedeId,
          asistio,
          estado,
          motivo: motivo ?? null,
          timestamp: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data as unknown as HistorialAsistencia;
  },

  async obtenerHistorialJugador(jugadorId: string): Promise<HistorialAsistencia[]> {
    const { data, error } = await supabase
      .from("historial_asistencias")
      .select("*")
      .eq("jugador_id", jugadorId)
      .order("timestamp", { ascending: false });

    if (error) throw error;
    return (data ?? []) as unknown as HistorialAsistencia[];
  },

  async obtenerAsistenciasConvocatoria(
    convocatoriaId: string,
  ): Promise<HistorialAsistencia[]> {
    const { data, error } = await supabase
      .from("historial_asistencias")
      .select("*")
      .eq("convocatoria_id", convocatoriaId);

    if (error) throw error;
    return (data ?? []) as unknown as HistorialAsistencia[];
  },

  async actualizarAsistencia(
    id: string,
    asistio: boolean,
    estado: EstadoAsistencia,
  ): Promise<void> {
    const { error } = await supabase
      .from("historial_asistencias")
      .update({ asistio, estado })
      .eq("id", id);

    if (error) throw error;
  },
};
