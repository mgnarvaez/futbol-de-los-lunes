import { supabase } from "@/integrations/supabase/client";
import type { InscriptoSheet } from "@/lib/sheets.server";
import { jugadorService } from "@/lib/services/jugadorService";

export const FORM_URL = "https://forms.gle/71nzT7gzo4C99mxSA";

export const sincronizacionService = {
  async sincronizarInscriptos(
    convocatoriaId: string,
    inscriptos: InscriptoSheet[],
  ): Promise<{ nuevos: number; total: number }> {
    const { data: existentes, error: errorExistentes } = await supabase
      .from("inscripciones")
      .select("jugador_id")
      .eq("convocatoria_id", convocatoriaId);
    if (errorExistentes) throw errorExistentes;

    const yaInscriptos = new Set(
      ((existentes ?? []) as { jugador_id: string }[]).map((i) => i.jugador_id),
    );

    let nuevos = 0;

    for (const fila of inscriptos) {
      const sede = fila.sede ?? "CANTON";
      const jugador = await jugadorService.crearOActualizarJugador({
        email: fila.email,
        nombre: fila.apodo || fila.email,
        apodo: fila.apodo || fila.email,
        sede_preferida: sede,
        flexible: fila.flexible,
        juega_con_lluvia: fila.juega_con_lluvia,
        es_vip: fila.vip,
        activo: true,
      });

      if (yaInscriptos.has(jugador.id)) continue;

      const { error } = await supabase.from("inscripciones").insert([
        {
          convocatoria_id: convocatoriaId,
          jugador_id: jugador.id,
          sede_preferida: sede,
          flexible: fila.flexible,
          juega_con_lluvia: fila.juega_con_lluvia,
          estado: "NO_ASIGNADO",
        } as never,
      ]);
      if (error) throw error;

      yaInscriptos.add(jugador.id);
      nuevos += 1;
    }

    return { nuevos, total: inscriptos.length };
  },
};
