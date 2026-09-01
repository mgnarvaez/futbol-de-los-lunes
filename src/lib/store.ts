import { create } from "zustand";

import { convocatoriaService } from "@/lib/services/convocatoriaService";
import { jugadorService } from "@/lib/services/jugadorService";
import type {
  ConfiguracionPanel,
  Convocatoria,
  EstadoPago,
  Inscripcion,
  Jugador,
} from "@/lib/types";

interface AppState {
  convocatoriaActual: Convocatoria | null;
  jugadores: Jugador[];
  inscripciones: Inscripcion[];
  configuracion: ConfiguracionPanel | null;
  darkMode: boolean;
  cargando: boolean;
  error: string | null;

  cargarConvocatoriaDelDia: () => Promise<void>;
  crearConvocatoria: (fecha: string) => Promise<void>;
  abrirConvocatoria: () => Promise<void>;
  cerrarConvocatoria: () => Promise<void>;

  cargarJugadores: () => Promise<void>;
  agregarJugador: (jugador: Partial<Jugador>) => Promise<void>;
  actualizarEstadoPago: (jugadorId: string, estado: EstadoPago) => Promise<void>;
  actualizarVip: (jugadorId: string, esVip: boolean) => Promise<void>;

  toggleDarkMode: () => void;
  setDarkMode: (value: boolean) => void;
  setError: (error: string | null) => void;
  resetState: () => void;
}

const mensaje = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export const useAppStore = create<AppState>((set, get) => ({
  convocatoriaActual: null,
  jugadores: [],
  inscripciones: [],
  configuracion: null,
  darkMode: false,
  cargando: false,
  error: null,

  cargarConvocatoriaDelDia: async () => {
    set({ cargando: true, error: null });
    try {
      const convocatoria = await convocatoriaService.obtenerConvocatoriaDelDia();
      if (convocatoria) {
        const inscripciones = await convocatoriaService.obtenerInscripciones(
          convocatoria.id,
        );
        set({ convocatoriaActual: convocatoria, inscripciones, cargando: false });
      } else {
        set({ convocatoriaActual: null, inscripciones: [], cargando: false });
      }
    } catch (error) {
      set({ error: mensaje(error, "Error al cargar la convocatoria"), cargando: false });
    }
  },

  crearConvocatoria: async (fecha: string) => {
    set({ cargando: true, error: null });
    try {
      const convocatoria = await convocatoriaService.crearConvocatoria(fecha);
      set({ convocatoriaActual: convocatoria, inscripciones: [], cargando: false });
    } catch (error) {
      set({ error: mensaje(error, "Error al crear convocatoria"), cargando: false });
    }
  },

  abrirConvocatoria: async () => {
    const { convocatoriaActual } = get();
    if (!convocatoriaActual) return;
    set({ cargando: true, error: null });
    try {
      const actualizada = await convocatoriaService.actualizarEstado(
        convocatoriaActual.id,
        "ABIERTA",
      );
      set({ convocatoriaActual: actualizada, cargando: false });
    } catch (error) {
      set({ error: mensaje(error, "Error al abrir convocatoria"), cargando: false });
    }
  },

  cerrarConvocatoria: async () => {
    const { convocatoriaActual } = get();
    if (!convocatoriaActual) return;
    set({ cargando: true, error: null });
    try {
      const actualizada = await convocatoriaService.actualizarEstado(
        convocatoriaActual.id,
        "CERRADA",
      );
      set({ convocatoriaActual: actualizada, cargando: false });
    } catch (error) {
      set({ error: mensaje(error, "Error al cerrar convocatoria"), cargando: false });
    }
  },

  cargarJugadores: async () => {
    set({ cargando: true, error: null });
    try {
      const jugadores = await jugadorService.listarJugadores();
      set({ jugadores, cargando: false });
    } catch (error) {
      set({ error: mensaje(error, "Error al cargar jugadores"), cargando: false });
    }
  },

  agregarJugador: async (jugador: Partial<Jugador>) => {
    set({ cargando: true, error: null });
    try {
      const nuevo = await jugadorService.crearOActualizarJugador(jugador);
      const { jugadores } = get();
      const existe = jugadores.some((j) => j.id === nuevo.id);
      set({
        jugadores: existe
          ? jugadores.map((j) => (j.id === nuevo.id ? nuevo : j))
          : [...jugadores, nuevo],
        cargando: false,
      });
    } catch (error) {
      set({ error: mensaje(error, "Error al agregar jugador"), cargando: false });
    }
  },

  actualizarEstadoPago: async (jugadorId: string, estado: EstadoPago) => {
    set({ error: null });
    try {
      await jugadorService.actualizarEstadoPago(jugadorId, estado);
      set({
        jugadores: get().jugadores.map((j) =>
          j.id === jugadorId ? { ...j, estado_pago: estado } : j,
        ),
      });
    } catch (error) {
      set({ error: mensaje(error, "Error al actualizar el pago") });
    }
  },

  actualizarVip: async (jugadorId: string, esVip: boolean) => {
    set({ error: null });
    try {
      await jugadorService.toggleVip(jugadorId, esVip);
      set({
        jugadores: get().jugadores.map((j) =>
          j.id === jugadorId ? { ...j, es_vip: esVip } : j,
        ),
      });
    } catch (error) {
      set({ error: mensaje(error, "Error al actualizar VIP") });
    }
  },

  setDarkMode: (value: boolean) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("darkMode", String(value));
    }
    set({ darkMode: value });
  },

  toggleDarkMode: () => {
    get().setDarkMode(!get().darkMode);
  },

  setError: (error: string | null) => set({ error }),

  resetState: () =>
    set({
      convocatoriaActual: null,
      jugadores: [],
      inscripciones: [],
      configuracion: null,
      error: null,
      cargando: false,
    }),
}));
