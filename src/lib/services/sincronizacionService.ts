import { supabase } from "@/integrations/supabase/client";
import type { InscriptoSheet } from "@/lib/sheets.server";
import { jugadorService } from "@/lib/services/jugadorService";

export const FORM_URL = "https://forms.gle/71nzT7gzo4C99mxSA";

export const sincronizacionService = {
  async sincronizarInscriptos(
    convocatoriaId: string,
    inscriptos: InscriptoSheet[],
  ): Promise<{ nuevos: number; total: number }> {
    
    // 1. Borrón total: eliminamos todas las inscripciones previas de esta fecha
    await supabase
      .from("inscripciones")
      .delete()
      .eq("convocatoria_id", convocatoriaId);

    let nuevos = 0;
    const emailsProcesados = new Set<string>();

    for (const fila of inscriptos) {
      const emailLimpio = (fila.email || "").trim().toLowerCase();
      
      // 2. Filtro anti-duplicados en la misma lectura
      if (!emailLimpio || emailsProcesados.has(emailLimpio)) continue; 

      const sede = fila.sede ?? "CANTON";

      // 3. Crea o actualiza el jugador (aplica las correcciones de apodo)
      const jugador = await jugadorService.crearOActualizarJugador({
        email: emailLimpio,
        nombre: fila.apodo || fila.email,
        apodo: fila.apodo || fila.email,
        sede_preferida: sede,
        flexible: fila.flexible,
        juega_con_lluvia: fila.juega_con_lluvia,
        es_vip: fila.vip,
        activo: true,
      });

      // 4. Inserta la inscripción de forma limpia
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

      emailsProcesados.add(emailLimpio);
      nuevos += 1;
    }

    return { nuevos, total: nuevos };
  },
};
