import { createFileRoute } from "@tanstack/react-router";
import { CloudRain, Loader2, Play, Shuffle, Square, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { armadorService } from "@/lib/services/armadorService";
import { convocatoriaService } from "@/lib/services/convocatoriaService";
import { useAppStore } from "@/lib/store";
import { SEDES, SEDE_LABELS, type EstadoPago, type Sede } from "@/lib/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Panel de convocatorias de fútbol" },
      {
        name: "description",
        content:
          "Administrá la convocatoria del día: abrir inscripciones, suspender por lluvia, armar equipos y controlar pagos.",
      },
      { property: "og:title", content: "Panel de convocatorias de fútbol" },
      {
        property: "og:description",
        content:
          "Abrí inscripciones, suspendé sedes por lluvia y armá los equipos automáticamente.",
      },
    ],
  }),
  component: Panel,
});

function Panel() {
  const {
    convocatoriaActual,
    inscripciones,
    jugadores,
    cargando,
    cargarConvocatoriaDelDia,
    crearConvocatoria,
    abrirConvocatoria,
    cerrarConvocatoria,
    cargarJugadores,
    actualizarEstadoPago,
    actualizarVip,
  } = useAppStore();

  const [armando, setArmando] = useState(false);

  useEffect(() => {
    void cargarConvocatoriaDelDia();
    void cargarJugadores();
  }, [cargarConvocatoriaDelDia, cargarJugadores]);

  const hoy = new Date().toISOString().slice(0, 10);
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
      description="Gestioná la convocatoria del día, las sedes y el plantel."
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
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-muted-foreground">
                Todavía no hay convocatoria creada para hoy.
              </p>
              <Button onClick={() => void crearConvocatoria(hoy)} disabled={cargando}>
                {cargando && <Loader2 className="mr-2 size-4 animate-spin" />}
                Crear convocatoria
              </Button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => void abrirConvocatoria()}
                  disabled={convocatoriaActual.estado === "ABIERTA"}
                >
                  <Play className="mr-2 size-4" />
                  Abrir inscripción
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void cerrarConvocatoria()}
                  disabled={convocatoriaActual.estado !== "ABIERTA"}
                >
                  <Square className="mr-2 size-4" />
                  Cerrar
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
            Inscriptos de hoy ({inscripciones.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {inscripciones.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nadie se anotó todavía.</p>
          ) : (
            <ul className="space-y-1">
              {inscripciones.map((i) => (
                <li
                  key={i.id}
                  className="flex items-center gap-2 rounded-md bg-muted/60 px-3 py-2 text-sm"
                >
                  <span className="truncate text-foreground">
                    {i.jugador?.apodo || i.jugador?.nombre || "Jugador"}
                  </span>
                  <Badge variant="outline">{i.sede_preferida}</Badge>
                  {i.flexible && <Badge variant="secondary">Flexible</Badge>}
                  <Badge className="ml-auto" variant="outline">
                    {i.estado}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Plantel ({jugadores.length})</CardTitle>
          <UserPlus className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {jugadores.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin jugadores registrados.</p>
          ) : (
            <ul className="divide-y divide-border">
              {jugadores.map((j) => (
                <li key={j.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="mr-auto min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {j.apodo || j.nombre}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{j.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs font-normal text-muted-foreground">VIP</Label>
                    <Switch
                      checked={j.es_vip}
                      onCheckedChange={(v) => void actualizarVip(j.id, v)}
                    />
                  </div>
                  <Button
                    size="sm"
                    variant={j.estado_pago === "DEBE" ? "destructive" : "outline"}
                    onClick={() =>
                      void actualizarEstadoPago(
                        j.id,
                        (j.estado_pago === "DEBE" ? "AL_DÍA" : "DEBE") as EstadoPago,
                      )
                    }
                  >
                    {j.estado_pago === "DEBE" ? "Debe" : "Al día"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
