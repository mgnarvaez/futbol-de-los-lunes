import { createServerFn } from "@tanstack/react-start";

import type { InscriptoSheet, JugadorPlantelSheet } from "@/lib/sheets.server";

export const obtenerInscriptosSheet = createServerFn({ method: "GET" }).handler(
  async (): Promise<InscriptoSheet[]> => {
    const { leerInscriptos } = await import("@/lib/sheets.server");
    return leerInscriptos();
  },
);

export const obtenerPlantelSheet = createServerFn({ method: "GET" }).handler(
  async (): Promise<JugadorPlantelSheet[]> => {
    const { leerPlantel } = await import("@/lib/sheets.server");
    return leerPlantel();
  },
);
