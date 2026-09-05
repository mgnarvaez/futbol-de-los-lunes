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
      .select("id, jugador_id")
      .eq("convocatoria_id", convocatoriaId);
    if (errorExistentes) throw errorExistentes;

    const inscripcionPorJugador = new Map<string, string>();
    ((existentes ?? []) as { id: string; jugador_id: string }[]).forEach((i) =>
      inscripcionPorJugador.set(i.jugador_id, i.id),
    );

    let nuevos = 0;
    const procesados = new Set<string>();

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

      if (procesados.has(jugador.id)) continue;
      procesados.add(jugador.id);

      const datos = {
        sede_preferida: sede,
        flexible: fila.flexible,
        juega_con_lluvia: fila.juega_con_lluvia,
      };

      const inscripcionExistente = inscripcionPorJugador.get(jugador.id);

      if (inscripcionExistente) {
        // La planilla es la fuente de verdad: refrescamos los datos que hayan cambiado
        const { error } = await supabase
          .from("inscripciones")
          .update(datos as never)
          .eq("id", inscripcionExistente);
        if (error) throw error;
        continue;
      }

      const { data: creada, error } = await supabase
        .from("inscripciones")
        .insert([
          {
            convocatoria_id: convocatoriaId,
            jugador_id: jugador.id,
            ...datos,
            estado: "NO_ASIGNADO",
          } as never,
        ])
        .select("id")
        .single();
      if (error) throw error;

      inscripcionPorJugador.set(jugador.id, (creada as { id: string }).id);
      nuevos += 1;
    }

    return { nuevos, total: inscriptos.length };
  },
};
