import type { Convocatoria, HistorialAsistencia, Jugador } from "@/lib/types";

function descargar(contenido: string, tipo: string, nombreArchivo: string) {
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nombreArchivo}_${new Date().toISOString().slice(0, 10)}`;
  a.click();
  URL.revokeObjectURL(url);
}

export const exportService = {
  exportarCSV(datos: Record<string, unknown>[], nombreArchivo: string): void {
    const headers = Object.keys(datos[0] ?? {});
    const csv = [
      headers.join(","),
      ...datos.map((row) =>
        headers
          .map((h) => {
            const valor = row[h];
            const esTexto = typeof valor === "string" && valor.includes(",");
            return esTexto ? `"${valor}"` : String(valor ?? "");
          })
          .join(","),
      ),
    ].join("\n");

    descargar(csv, "text/csv", `${nombreArchivo}.csv`);
  },

  exportarJSON(datos: unknown, nombreArchivo: string): void {
    descargar(JSON.stringify(datos, null, 2), "application/json", `${nombreArchivo}.json`);
  },

  generarReporteSemanal(
    convocatorias: Convocatoria[],
    jugadores: Jugador[],
    historial: HistorialAsistencia[],
  ) {
    return {
      fecha_reporte: new Date().toISOString(),
      total_convocatorias: convocatorias.length,
      total_jugadores: jugadores.length,
      resumen_asistencias: historial.reduce<Record<string, number>>((acc, h) => {
        acc[h.estado] = (acc[h.estado] ?? 0) + 1;
        return acc;
      }, {}),
      datos_completos: { convocatorias, jugadores, historial },
    };
  },

  crearBackup(datos: unknown): Blob {
    const backup = {
      timestamp: new Date().toISOString(),
      version: "1.0",
      datos,
    };

    return new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  },
};
