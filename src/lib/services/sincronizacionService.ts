import { supabase } from "@/integrations/supabase/client";
import type { InscriptoSheet } from "@/lib/sheets.server";
import { jugadorService } from "@/lib/services/jugadorService";

export const FORM_URL = "https://forms.gle/71nzT7gzo4C99mxSA";

export const sincronizacionService = {
  async sincronizarInscriptos(
    convocatoriaId: string,
    inscriptos: InscriptoSheet[],
  ): Promise<{ nuevos: number; total: number }> {
    
    // 🚨 ESCUDO PROTECTOR: Si la planilla está vacía o falló la conexión, frenamos.
    if (!inscriptos || inscriptos.length === 0) {
      throw new Error("No se pudo leer la planilla o está vacía. No se borró nada por seguridad.");
    }

    // 1. ASPIRADORA SEGURA: Solo borramos porque ya confirmamos que tenemos los datos nuevos.
    await supabase
      .from("inscripciones")
      .delete()
      .eq("convocatoria_id", convocatoriaId);

    let nuevos = 0;
    const emailsProcesados = new Set<string>();

    for (const fila of inscriptos) {
      const emailLimpio = (fila.email || "").trim().toLowerCase();
      
      // 2. Filtro anti-duplicados
      if (!emailLimpio || emailsProcesados.has(emailLimpio)) continue; 

      const sede = fila.sede ?? "CANTON";
      const apodoReal = fila.apodo || fila.email;

      // 3. Forzamos la actualización del jugador (Acá pisa el apodo)
      const jugador = await jugadorService.crearOActualizarJugador({
        email: emailLimpio,
        nombre: apodoReal,
        apodo: apodoReal,
        sede_preferida: sede,
        flexible: fila.flexible,
        juega_con_lluvia: fila.juega_con_lluvia,
        es_vip: fila.vip,
        activo: true,
      });

      // 4. Lo anotamos limpio
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
