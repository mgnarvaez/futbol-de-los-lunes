import type { Sede } from "@/lib/types";

const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";

export const SHEET_INSCRIPTOS_ID = "1b_JOQKHe6mz_9aVka90hKhEM3Gqaw9U6dR6iK_80TkU";
export const SHEET_PLANTEL_ID = "13_t_cbzP3F7Pbt1Apzto8i7WB2-QCLICP7D5fIUHaf0";
export const TAB_VIP = "Ingresos VIP";
export const TAB_GENERAL = "Ingresos General";
export const TAB_PLANTEL = "Respuestas de formulario 1";

export interface InscriptoSheet {
  timestamp: string;
  fecha: string;
  hora: string;
  email: string;
  turno: string;
  sede: Sede | null;
  flexible: boolean;
  apodo: string;
  juega_con_lluvia: boolean;
  vip: boolean;
}

export interface JugadorPlantelSheet {
  email: string;
  email_alternativo: string;
  nombre: string;
  apodo: string;
  telefono: string;
  edad: string;
  /** Edad declarada al momento de inscribirse en la planilla. */
  edad_declarada: string;
  /** Fecha en que se inscribió en la planilla (columna A). */
  fecha_inscripcion: string;
  barrio: string;
  lote: string;
  puesto: string;
}


async function sheetsGet(path: string, params: [string, string][]): Promise<unknown> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["GOOGLE_SHEETS_API_KEY"];
  if (!lovableKey || !connectionKey) {
    throw new Error("La conexión con Google Sheets no está configurada.");
  }

  const query = params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
  const res = await fetch(`${GATEWAY}${path}${query ? `?${query}` : ""}`, {
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connectionKey,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`Google Sheets error [${res.status}]: ${body}`);
    throw new Error(`No se pudo leer la planilla [${res.status}]: ${body}`);
  }
  return res.json();
}

const texto = (row: string[], i: number) => (row[i] ?? "").toString().trim();

function detectarSede(turno: string): Sede | null {
  const t = turno.toUpperCase();
  if (t.includes("CANTON") || t.includes("CANTÓN")) return "CANTON";
  if (t.includes("PUERTOS")) return "PUERTOS";
  if (t.includes("SM") || t.includes("MATIAS") || t.includes("MATÍAS")) return "SM";
  return null;
}

function mapInscripto(row: string[], vip: boolean): InscriptoSheet | null {
  const timestamp = texto(row, 0);
  const email = texto(row, 1).toLowerCase();
  if (!email) return null;
  const [fecha = "", hora = ""] = timestamp.split(" ");
  const turno = texto(row, 2);
  const flexibilidad = texto(row, 3);
  const lluvia = texto(row, 5).toLowerCase();

  return {
    timestamp,
    fecha,
    hora,
    email,
    turno,
    sede: detectarSede(turno),
    flexible: /cualquier/i.test(flexibilidad),
    apodo: texto(row, 4).replace(/\s+/g, " "),
    juega_con_lluvia: lluvia.startsWith("si") || lluvia.startsWith("sí"),
    vip,
  };
}

export async function leerInscriptos(): Promise<InscriptoSheet[]> {
  const data = (await sheetsGet(
    `/spreadsheets/${SHEET_INSCRIPTOS_ID}/values:batchGet`,
    [
      ["ranges", `${TAB_VIP}!A2:L`],
      ["ranges", `${TAB_GENERAL}!A2:L`],
      ["valueRenderOption", "FORMATTED_VALUE"],
    ],
  )) as { valueRanges?: { values?: string[][] }[] };

  const [vip, general] = data.valueRanges ?? [];
  const filas: InscriptoSheet[] = [];
  for (const row of vip?.values ?? []) {
    const item = mapInscripto(row, true);
    if (item) filas.push(item);
  }
  for (const row of general?.values ?? []) {
    const item = mapInscripto(row, false);
    if (item) filas.push(item);
  }
  return filas;
}

/** Parsea "1/9/2026 10:24:49" o "1/9/2026" (formato d/m/aaaa de Google). */
function parsearFecha(valor: string): Date | null {
  const [fechaParte] = valor.trim().split(" ");
  const partes = (fechaParte ?? "").split(/[/-]/).map((p) => Number(p));
  const [d, m, a] = partes;
  if (!d || !m || !a) return null;
  const anio = a < 100 ? 2000 + a : a;
  const fecha = new Date(anio, m - 1, d);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

/** Edad de hoy = edad declarada + años completos transcurridos desde la inscripción. */
function edadActual(edadDeclarada: string, fechaInscripcion: string): string {
  const base = Number(edadDeclarada.replace(/\D/g, ""));
  const fecha = parsearFecha(fechaInscripcion);
  if (!base || !fecha) return edadDeclarada;

  const hoy = new Date();
  let anios = hoy.getFullYear() - fecha.getFullYear();
  const antesDelAniversario =
    hoy.getMonth() < fecha.getMonth() ||
    (hoy.getMonth() === fecha.getMonth() && hoy.getDate() < fecha.getDate());
  if (antesDelAniversario) anios -= 1;

  return String(base + Math.max(0, anios));
}

export async function leerPlantel(): Promise<JugadorPlantelSheet[]> {
  const data = (await sheetsGet(
    `/spreadsheets/${SHEET_PLANTEL_ID}/values/${TAB_PLANTEL}!A2:L`,
    [["valueRenderOption", "FORMATTED_VALUE"]],
  )) as { values?: string[][] };

  return (data.values ?? [])
    .map((row) => {
      const fecha_inscripcion = texto(row, 0);
      const edad_declarada = texto(row, 5);
      return {
        email: texto(row, 1).toLowerCase(),
        email_alternativo: texto(row, 11).toLowerCase(),
        nombre: texto(row, 2),
        apodo: texto(row, 3),
        telefono: texto(row, 4),
        edad: edadActual(edad_declarada, fecha_inscripcion),
        edad_declarada,
        fecha_inscripcion,
        barrio: texto(row, 6),
        lote: texto(row, 7),
        puesto: texto(row, 8),
      };
    })
    .filter((j) => j.email || j.nombre)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}
