import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CloudRain, ExternalLink, Loader2, RefreshCw, Shuffle, UserMinus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { armadorService } from "@/lib/services/armadorService";
import { convocatoriaService } from "@/lib/services/convocatoriaService";
import {
  FORM_URL,
  sincronizacionService,
} from "@/lib/services/sincronizacionService";
import { obtenerInscriptosSheet } from "@/lib/sheets.functions";
import { useAppStore } from "@/lib/store";
import { SEDES, SEDE_LABELS, type EstadoPago, type Sede } from "@/lib/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Panel de convocatorias de fútbol" },
      {
        name: "description",
        content:
          "Panel del día: inscripción automática por Google Form, suspensión por lluvia, armado de equipos y control de pagos.",
      },
      { property: "og:title", content: "Panel de convocatorias de fútbol" },
      {
        property: "og:description",
        content:
          "Inscripción automática desde el formulario, suspensión de sedes y armado de equipos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Panel,
});

function Panel() {
  const {
    convocatoriaActual,
    inscripciones,
    cargando,
    cargarConvocatoriaDelDia,
    crearConvocatoria,
    abrirConvocatoria,
    cargarJugadores,
    actualizarEstadoPago,
  } = useAppStore();

  const [armando, setArmando] = useState(false);
  const [bajando, setBajando] = useState<string | null>(null);
  const [sincronizando, setSincronizando] = useState(false);
  const preparando = useRef(false);

  const { data: inscriptosSheet, refetch: refetchSheet } = useQuery({
    queryKey: ["inscriptos-sheet"],
    queryFn: () => obtenerInscriptosSheet(),
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    void cargarConvocatoriaDelDia();
    void cargarJugadores();
  }, [cargarConvocatoriaDelDia, cargarJugadores]);

  const hoy = new Date().toISOString().slice(0, 10);

  // Apertura automática: si no hay convocatoria del día, se crea y se abre sola.
  useEffect(() => {
    if (cargando || preparando.current) return;
    if (!convocatoriaActual) {
      preparando.current = true;
      void crearConvocatoria(hoy).finally(() => {
        preparando.current = false;
      });
      return;
    }
    if (convocatoriaActual.estado === "PLANIFICADA") {
      preparando.current = true;
      void abrirConvocatoria().finally(() => {
        preparando.current = false;
      });
    }
  }, [cargando, convocatoriaActual, crearConvocatoria, abrirConvocatoria, hoy]);

  const lluvia = convocatoriaActual?.suspension_lluvia ?? false;
  const canceladas = convocatoriaActual?.sedes_canceladas ?? [];

  const toggleSede = async (sede: Sede, cancelada: boolean) => {
    if (!convocatoriaActual) return;
    const nuevas = cancelada
      ? [...canceladas, sede]
      : canceladas.filter((s) => s !== sede);
    try {
      await convocatoriaService.actualizarSuspensiones(
        convocatoriaActual.id,
        lluvia,
        nuevas,
      );
      await cargarConvocatoriaDelDia();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al actualizar sedes");
    }
  };

  const toggleLluvia = async (valor: boolean) => {
    if (!convocatoriaActual) return;
    try {
      await convocatoriaService.actualizarSuspensiones(
        convocatoriaActual.id,
        valor,
        canceladas,
      );
      await cargarConvocatoriaDelDia();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al actualizar lluvia");
    }
  };

  const sincronizar = async () => {
    if (!convocatoriaActual) return;
    setSincronizando(true);
    try {
      const { data } = await refetchSheet();
      const filas = data ?? inscriptosSheet ?? [];
      const resultado = await sincronizacionService.sincronizarInscriptos(
        convocatoriaActual.id,
        filas,
      );
      toast.success(
        `${resultado.nuevos} inscripto(s) nuevo(s) de ${resultado.total} en la planilla`,
      );
      await cargarConvocatoriaDelDia();
      await cargarJugadores();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error al sincronizar inscriptos",
      );
    } finally {
      setSincronizando(false);
    }
  };

  const armar = async () => {
    if (!convocatoriaActual) return;
    setArmando(true);
    try {
      const resultado = await armadorService.armarEquipos(convocatoriaActual.id);
      toast.success(
        `Equipos armados · ${resultado.noAsignados.length} jugador(es) sin asignar`,
      );
      await cargarConvocatoriaDelDia();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al armar equipos");
    } finally {
      setArmando(false);
    }
  };

  return (
    <AppShell
      title="Panel de control"
      description="La convocatoria del día se abre sola. La inscripción se hace por el Google Form."
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Convocatoria de hoy · {hoy}</CardTitle>
          {convocatoriaActual && (
            <Badge
              variant={
                convocatoriaActual.estado === "ABIERTA"
                  ? "default"
                  : convocatoriaActual.estado === "CANCELADA"
                    ? "destructive"
                    : "secondary"
              }
            >
              {convocatoriaActual.estado}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {!convocatoriaActual ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Preparando la convocatoria de hoy…
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <a href={FORM_URL} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 size-4" />
                    Abrir formulario de inscripción
                  </a>
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void sincronizar()}
                  disabled={sincronizando}
                >
                  {sincronizando ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 size-4" />
                  )}
                  Traer inscriptos de la planilla
                </Button>
                <Button variant="secondary" onClick={() => void armar()} disabled={armando}>
                  {armando ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Shuffle className="mr-2 size-4" />
                  )}
                  Armar equipos
                </Button>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
                <Label htmlFor="lluvia" className="flex items-center gap-2 font-normal">
                  <CloudRain className="size-4 text-info" />
                  Suspensión por lluvia
                </Label>
                <Switch
                  id="lluvia"
                  checked={lluvia}
                  onCheckedChange={(v) => void toggleLluvia(v)}
                />
              </div>

              <div className="space-y-2 rounded-lg border border-border p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Sedes canceladas
                </p>
                {SEDES.map((sede) => (
                  <div key={sede} className="flex items-center justify-between gap-4">
                    <Label htmlFor={`sede-${sede}`} className="font-normal">
                      {SEDE_LABELS[sede]}
                    </Label>
                    <Switch
                      id={`sede-${sede}`}
                      checked={canceladas.includes(sede)}
                      onCheckedChange={(v) => void toggleSede(sede, v)}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Inscriptos en la planilla ({inscriptosSheet?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!inscriptosSheet ? (
            <p className="text-sm text-muted-foreground">Leyendo la planilla…</p>
          ) : inscriptosSheet.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay respuestas en el formulario.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {inscriptosSheet.map((i, idx) => (
                <li
                  key={`${i.email}-${idx}`}
                  className="flex flex-wrap items-center gap-2 py-2 text-sm"
                >
                  <span className="font-medium text-foreground">
                    {i.apodo || i.email}
                  </span>
                  {i.vip && <Badge>VIP</Badge>}
                  <Badge variant="outline">{i.sede ?? (i.turno || "Sin turno")}</Badge>
                  {i.flexible && <Badge variant="secondary">Flexible</Badge>}
                  {!i.juega_con_lluvia && (
                    <Badge variant="destructive">No juega con lluvia</Badge>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {i.fecha} {i.hora}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Anotados de hoy ({inscripciones.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {inscripciones.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Todavía no sincronizaste la planilla.
            </p>
          ) : (
            <ul className="space-y-1">
              {inscripciones.map((i) => (
                <li
                  key={i.id}
                  className="flex flex-wrap items-center gap-2 rounded-md bg-muted/60 px-3 py-2 text-sm"
                >
                  <span className="truncate text-foreground">
                    {i.jugador?.apodo || i.jugador?.nombre || "Jugador"}
                  </span>
                  <Badge variant="outline">{i.sede_preferida}</Badge>
                  {i.flexible && <Badge variant="secondary">Flexible</Badge>}
                  <Badge variant="outline">{i.estado}</Badge>
                  <div className="ml-auto flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={
                        i.jugador?.estado_pago === "DEBE" ? "destructive" : "outline"
                      }
                      onClick={() =>
                        i.jugador &&
                        void actualizarEstadoPago(
                          i.jugador.id,
                          (i.jugador.estado_pago === "DEBE"
                            ? "AL_DÍA"
                            : "DEBE") as EstadoPago,
                        )
                      }
                    >
                      {i.jugador?.estado_pago === "DEBE" ? "Debe" : "Al día"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={bajando === i.id}
                      onClick={() => void bajar(i)}
                    >
                      {bajando === i.id ? (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      ) : (
                        <UserMinus className="mr-2 size-4" />
                      )}
                      Bajar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
