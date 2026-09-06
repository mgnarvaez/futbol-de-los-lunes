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
  edad_declarada: string;
  fecha_inscripcion: string;
  barrio: string;
  lote: string;
  puesto: string;
  pago: boolean;
}

async function sheetsGet(path: string, params: [string, string][]): Promise<unknown> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["GOOGLE_SHEETS_API_KEY"];
  
  // Si las llaves no están en el entorno, registramos una advertencia en lugar de romper la app
  if (!lovableKey || !connectionKey) {
    console.warn("Las credenciales de Google Sheets no están configuradas en el entorno.");
    return null;
  }

  try {
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
      return null;
    }
    return res.json();
  } catch (error) {
    console.error("Error de red al conectar con Google Sheets:", error);
    return null;
  }
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
  )) as { valueRanges?: { values?: string[][] }[] } | null;

  if (!data || !data.valueRanges) {
    return [];
  }

  const [vip, general] = data.valueRanges;
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

function parsearFecha(valor: string): Date | null {
  const [fechaParte] = valor.trim().split(" ");
  const partes = (fechaParte ?? "").split(/[/-]/).map((p) => Number(p));
  const [d, m, a] = partes;
  if (!d || !m || !a) return null;
  const anio = a < 100 ? 2000 + a : a;
  const fecha = new Date(anio, m - 1, d);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

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
    `/spreadsheets/${SHEET_PLANTEL_ID}/values/${TAB_PLANTEL}!A2:R`,
    [["valueRenderOption", "FORMATTED_VALUE"]],
  )) as { values?: string[][] } | null;

  if (!data || !data.values) {
    return [];
  }

  return data.values
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
        pago: texto(row, 16).toLowerCase().startsWith("x"),
      };
    })
    .filter((j) => j.email || j.nombre)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

/* ------------------------------------------------------------------ */
/* Planilla de puntajes y armado de equipos (script propio del usuario) */
/* ------------------------------------------------------------------ */

export const SHEET_EQUIPOS_ID = "1vAkjAgb7A7glehP2N2IUhph4ILCHEtELdv9_Ckic8to";

const TAB_EQUIPOS: Record<Sede, string> = {
  CANTON: "Equipos CANTON",
  SM: "Equipos SM",
  PUERTOS: "Equipos PUERTOS",
};

export interface JugadorEquipo {
  nombre: string;
  puesto: string;
}

export interface EquipoSede {
  sede: Sede;
  puntajeBlancos: string;
  puntajeNegros: string;
  blancos: JugadorEquipo[];
  negros: JugadorEquipo[];
}

const RE_PUESTO = /(ARQ|DEF|MED|DEL)\s*$/i;

function parsearJugador(celda: string): JugadorEquipo | null {
  const valor = (celda ?? "").toString().trim();
  if (!valor) return null;
  const match = valor.match(RE_PUESTO);
  const puesto = match?.[1]?.toUpperCase() ?? "";
  const nombre = valor
    .replace(RE_PUESTO, "")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "")
    .trim();
  if (!nombre) return null;
  return { nombre, puesto };
}

function parsearPuntaje(encabezado: string): string {
  const m = (encabezado ?? "").match(/\(([^)]+)\)/);
  return m?.[1] ?? "-";
}

export async function leerEquiposArmados(): Promise<EquipoSede[]> {
  const ranges: [string, string][] = (Object.values(TAB_EQUIPOS) as string[]).map(
    (tab) => ["ranges", `${tab}!A1:B30`],
  );
  const data = (await sheetsGet(
    `/spreadsheets/${SHEET_EQUIPOS_ID}/values:batchGet`,
    [...ranges, ["valueRenderOption", "FORMATTED_VALUE"]],
  )) as { valueRanges?: { values?: string[][] }[] } | null;

  const sedes = Object.keys(TAB_EQUIPOS) as Sede[];
  return sedes.map((sede, i) => {
    const filas = data?.valueRanges?.[i]?.values ?? [];
    const encabezado = filas[0] ?? [];
    const blancos: JugadorEquipo[] = [];
    const negros: JugadorEquipo[] = [];
    for (const fila of filas.slice(1)) {
      const b = parsearJugador(fila[0] ?? "");
      if (b) blancos.push(b);
      const n = parsearJugador(fila[1] ?? "");
      if (n) negros.push(n);
    }
    return {
      sede,
      puntajeBlancos: parsearPuntaje(encabezado[0] ?? ""),
      puntajeNegros: parsearPuntaje(encabezado[1] ?? ""),
      blancos,
      negros,
    };
  });
}

/**
 * Corre el script de armado publicado como aplicación web de Google Apps Script.
 */
export async function ejecutarArmadoEquipos(): Promise<{ ok: boolean; mensaje: string }> {
  const url = process.env["APPS_SCRIPT_EQUIPOS_URL"];
  if (!url) {
    return {
      ok: false,
      mensaje:
        "Falta configurar el link de la aplicación web del script de armado de equipos.",
    };
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "armar" }),
      redirect: "follow",
    });
    const texto = (await res.text()).slice(0, 500);
    const pideLogin =
      res.status === 401 ||
      /accounts\.google\.com|<!doctype html|<html/i.test(texto);
    if (!res.ok || pideLogin) {
      console.error(`Apps Script error [${res.status}]: ${texto.slice(0, 200)}`);
      if (pideLogin) {
        return {
          ok: false,
          mensaje:
            "El script pide iniciar sesión. En Apps Script → Implementar → Administrar implementaciones, poné 'Quién tiene acceso: Cualquier persona' y volvé a implementar.",
        };
      }
      return { ok: false, mensaje: `El script respondió con error ${res.status}.` };
    }
    return { ok: true, mensaje: texto || "Equipos armados." };
  } catch (error) {
    console.error("Error al llamar al script de armado:", error);
    return { ok: false, mensaje: "No se pudo contactar al script de armado." };
  }
}
