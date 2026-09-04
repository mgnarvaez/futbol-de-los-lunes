import { supabase } from "@/integrations/supabase/client";
import type { EstadisticasJugador, EstadoPago, Jugador } from "@/lib/types";

export const jugadorService = {
  async crearOActualizarJugador(jugador: Partial<Jugador>): Promise<Jugador> {
    const emailLimpio = (jugador.email || "").trim().toLowerCase();

    // 1. Buscar si existe
    const { data: existente } = await supabase
      .from("jugadores")
      .select("*")
      .eq("email", emailLimpio)
      .maybeSingle();

    if (existente) {
      // 2. ACTUALIZACIÓN FORZADA: Obligamos a la base a tomar el apodo nuevo que viene de Google Sheets
      const apodoNuevo = jugador.apodo && jugador.apodo.trim() !== "" ? jugador.apodo : existente.apodo;
      const nombreNuevo = jugador.nombre && jugador.nombre.trim() !== "" ? jugador.nombre : existente.nombre;

      const { data: actualizado, error: errUpdate } = await supabase
        .from("jugadores")
        .update({
          nombre: nombreNuevo,
          apodo: apodoNuevo,
          sede_preferida: jugador.sede_preferida ?? existente.sede_preferida,
          flexible: jugador.flexible ?? existente.flexible,
          juega_con_lluvia: jugador.juega_con_lluvia ?? existente.juega_con_lluvia,
          es_vip: jugador.es_vip ?? existente.es_vip,
        })
        .eq("id", existente.id)
        .select()
        .single();

      if (errUpdate) throw errUpdate;
      return actualizado as unknown as Jugador;
    }

    // 3. Si es nuevo, lo inserta
    const { data: nuevo, error: errInsert } = await supabase
      .from("jugadores")
      .insert([{ ...jugador, email: emailLimpio } as never])
      .select()
      .single();

    if (errInsert) throw errInsert;
    return nuevo as unknown as Jugador;
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
