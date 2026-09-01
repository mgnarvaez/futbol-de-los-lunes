import { supabase } from "@/integrations/supabase/client";
import type { Convocatoria, Inscripcion, SedeInfo } from "@/lib/types";

export const convocatoriaService = {
  async crearConvocatoria(fecha: string): Promise<Convocatoria> {
    const { data, error } = await supabase
      .from("convocatorias")
      .insert([
        {
          fecha,
          estado: "PLANIFICADA",
          suspension_lluvia: false,
          sedes_canceladas: [],
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data as unknown as Convocatoria;
  },

  async obtenerConvocatoria(id: string): Promise<Convocatoria> {
    const { data, error } = await supabase
      .from("convocatorias")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data as unknown as Convocatoria;
  },

  async listarConvocatorias(): Promise<Convocatoria[]> {
    const { data, error } = await supabase
      .from("convocatorias")
      .select("*")
      .order("fecha", { ascending: false });

    if (error) throw error;
    return (data ?? []) as unknown as Convocatoria[];
  },

  async obtenerConvocatoriaDelDia(): Promise<Convocatoria | null> {
    const hoy = new Date().toISOString().split("T")[0];
    const { data, error } = await supabase
      .from("convocatorias")
      .select("*")
      .eq("fecha", hoy)
      .maybeSingle();

    if (error) throw error;
    return (data as unknown as Convocatoria) ?? null;
  },

  async actualizarEstado(id: string, estado: string): Promise<Convocatoria> {
    const { data, error } = await supabase
      .from("convocatorias")
      .update({ estado, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data as unknown as Convocatoria;
  },

  async actualizarSuspensiones(
    id: string,
    lluvia: boolean,
    sedesCanceladas: string[],
  ): Promise<Convocatoria> {
    const { data, error } = await supabase
      .from("convocatorias")
      .update({
        suspension_lluvia: lluvia,
        sedes_canceladas: sedesCanceladas,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data as unknown as Convocatoria;
  },

  async obtenerInscripciones(convocatoriaId: string): Promise<Inscripcion[]> {
    const { data, error } = await supabase
      .from("inscripciones")
      .select("*, jugador:jugadores(*)")
      .eq("convocatoria_id", convocatoriaId)
      .order("timestamp_inscripcion", { ascending: true });

    if (error) throw error;
    return (data ?? []) as unknown as Inscripcion[];
  },

  async listarSedes(): Promise<SedeInfo[]> {
    const { data, error } = await supabase
      .from("sedes")
      .select("*")
      .order("id", { ascending: true });

    if (error) throw error;
    return (data ?? []) as unknown as SedeInfo[];
  },
};
