import { supabase } from "@/integrations/supabase/client";
import type { EstadisticasJugador, EstadoPago, Jugador } from "@/lib/types";

export const jugadorService = {
  async crearOActualizarJugador(jugador: Partial<Jugador>): Promise<Jugador> {
    const { data, error } = await supabase
      .from("jugadores")
      .upsert([jugador as never], { onConflict: "email" })
      .select()
      .single();

    if (error) throw error;
    return data as unknown as Jugador;
  },

  async obtenerPorEmail(email: string): Promise<Jugador | null> {
    const { data, error } = await supabase
      .from("jugadores")
      .select("*")
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();

    if (error) throw error;
    return (data as unknown as Jugador) ?? null;
  },

  async listarJugadores(): Promise<Jugador[]> {
    const { data, error } = await supabase
      .from("jugadores")
      .select("*")
      .eq("activo", true)
      .order("nombre", { ascending: true });

    if (error) throw error;
    return (data ?? []) as unknown as Jugador[];
  },

  async obtenerEstadisticas(jugadorId: string): Promise<EstadisticasJugador> {
    const { data, error } = await supabase
      .from("historial_asistencias")
      .select("*")
      .eq("jugador_id", jugadorId);

    if (error) throw error;

    const registros = (data ?? []) as { estado: string }[];
    const asistencias = registros.filter((r) => r.estado === "ASISTIÓ").length;
    const ausencias = registros.filter((r) => r.estado === "NO_APARECIÓ").length;
    const bajas = registros.filter((r) => r.estado === "SE_BAJÓ").length;
    const total = registros.length;

    return {
      total_convocatorias: total,
      asistencias,
      ausencias,
      bajas,
      porcentaje_asistencia: total > 0 ? (asistencias / total) * 100 : 0,
      puntaje_promedio: 0,
    };
  },

  async actualizarEstadoPago(jugadorId: string, estado: EstadoPago): Promise<void> {
    const { error } = await supabase
      .from("jugadores")
      .update({ estado_pago: estado })
      .eq("id", jugadorId);

    if (error) throw error;
  },

  async toggleVip(jugadorId: string, esVip: boolean): Promise<void> {
    const { error } = await supabase
      .from("jugadores")
      .update({ es_vip: esVip })
      .eq("id", jugadorId);

    if (error) throw error;
  },

  async desactivarJugador(jugadorId: string): Promise<void> {
    const { error } = await supabase
      .from("jugadores")
      .update({ activo: false })
      .eq("id", jugadorId);

    if (error) throw error;
  },

  async obtenerVIP(): Promise<Jugador[]> {
    const { data, error } = await supabase
      .from("jugadores")
      .select("*")
      .eq("es_vip", true)
      .eq("activo", true);

    if (error) throw error;
    return (data ?? []) as unknown as Jugador[];
  },
};
