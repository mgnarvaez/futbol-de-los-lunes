import { supabase } from "@/integrations/supabase/client";
import type { InscriptoSheet, JugadorPlantelSheet } from "@/lib/sheets.server";
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

  /**
   * Toma la columna de pago de la planilla del plantel y marca a cada jugador
   * como AL_DÍA o DEBE. Los que deben quedan al final de la prioridad.
   */
  async sincronizarPagos(plantel: JugadorPlantelSheet[]): Promise<{ deben: number }> {
    const pagoPorEmail = new Map<string, boolean>();
    for (const fila of plantel) {
      if (fila.email) pagoPorEmail.set(fila.email.trim().toLowerCase(), fila.pago);
      if (fila.email_alternativo) {
        pagoPorEmail.set(fila.email_alternativo.trim().toLowerCase(), fila.pago);
      }
    }

    const { data, error } = await supabase.from("jugadores").select("id, email, estado_pago");
    if (error) throw error;

    const jugadores = (data ?? []) as { id: string; email: string; estado_pago: string }[];
    const alDia: string[] = [];
    const deben: string[] = [];

    for (const jug of jugadores) {
      const pago = pagoPorEmail.get((jug.email ?? "").trim().toLowerCase());
      if (pago === undefined) continue;
      const objetivo = pago ? "AL_DÍA" : "DEBE";
      if (jug.estado_pago === objetivo) {
        if (!pago) deben.push(jug.id);
        continue;
      }
      (pago ? alDia : deben).push(jug.id);
    }

    if (alDia.length > 0) {
      const { error: err } = await supabase
        .from("jugadores")
        .update({ estado_pago: "AL_DÍA" } as never)
        .in("id", alDia);
      if (err) throw err;
    }
    if (deben.length > 0) {
      const { error: err } = await supabase
        .from("jugadores")
        .update({ estado_pago: "DEBE" } as never)
        .in("id", deben);
      if (err) throw err;
    }

    return { deben: deben.length };
  },
};
