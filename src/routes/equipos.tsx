import { createFileRoute } from "@tanstack/react-router";
import { Download, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { armadorService, type GrupoSede } from "@/lib/services/armadorService";
import { convocatoriaService } from "@/lib/services/convocatoriaService";
import { exportService } from "@/lib/services/exportService";
import { SEDES, SEDE_LABELS, type Convocatoria, type Sede } from "@/lib/types";

export const Route = createFileRoute("/equipos")({
  head: () => ({
    meta: [
      { title: "Equipos armados por sede | Fútbol" },
      {
        name: "description",
        content:
          "Mirá los titulares y suplentes asignados a cada sede para la convocatoria del día.",
      },
      { property: "og:title", content: "Equipos armados por sede | Fútbol" },
      {
        property: "og:description",
        content: "Titulares y suplentes por sede para la convocatoria del día.",
      },
    ],
  }),
  component: EquiposPage,
});

function EquiposPage() {
  const [convocatoria, setConvocatoria] = useState<Convocatoria | null>(null);
  const [equipos, setEquipos] = useState<Map<Sede, GrupoSede> | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const conv = await convocatoriaService.obtenerConvocatoriaDelDia();
      setConvocatoria(conv);
      setEquipos(conv ? await armadorService.obtenerEquipos(conv.id) : null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al cargar equipos");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const exportar = () => {
    if (!equipos) return;
    const filas = SEDES.flatMap((sede) => {
      const grupo = equipos.get(sede);
      return [
        ...(grupo?.titulares ?? []).map((e) => ({
          sede,
          tipo: "TITULAR",
          orden: e.orden_convocatoria,
          jugador: e.jugador?.apodo ?? e.jugador?.nombre ?? e.jugador_id,
        })),
        ...(grupo?.suplentes ?? []).map((e) => ({
          sede,
          tipo: "SUPLENTE",
          orden: e.orden_convocatoria,
          jugador: e.jugador?.apodo ?? e.jugador?.nombre ?? e.jugador_id,
        })),
      ];
    });
    if (filas.length === 0) {
      toast.error("No hay equipos para exportar");
      return;
    }
    exportService.exportarCSV(filas, "equipos");
  };

  return (
    <AppShell
      title="Equipos"
      description="Titulares y suplentes asignados por sede."
    >
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => void cargar()} disabled={cargando}>
          <RefreshCw className={`mr-2 size-4 ${cargando ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
        <Button variant="outline" onClick={exportar}>
          <Download className="mr-2 size-4" />
          Exportar CSV
        </Button>
      </div>

      {!convocatoria ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No hay convocatoria para hoy.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {SEDES.map((sede) => {
            const grupo = equipos?.get(sede);
            const cancelada = convocatoria.sedes_canceladas?.includes(sede);
            return (
              <Card key={sede} className={cancelada ? "opacity-60" : undefined}>
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <CardTitle className="text-base">{SEDE_LABELS[sede]}</CardTitle>
                  {cancelada ? (
                    <Badge variant="destructive">Cancelada</Badge>
                  ) : (
                    <Badge variant="secondary">
                      {grupo?.titulares.length ?? 0} titulares
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <Lista titulo="Titulares" items={grupo?.titulares ?? []} />
                  <Lista titulo="Suplentes" items={grupo?.suplentes ?? []} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

function Lista({
  titulo,
  items,
}: {
  titulo: string;
  items: GrupoSede["titulares"];
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {titulo}
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin jugadores.</p>
      ) : (
        <ol className="space-y-1">
          {items.map((e, i) => (
            <li
              key={e.id}
              className="flex items-center gap-2 rounded-md bg-muted/60 px-3 py-1.5 text-sm text-foreground"
            >
              <span className="w-5 text-xs text-muted-foreground">{i + 1}</span>
              <span className="truncate">
                {e.jugador?.apodo || e.jugador?.nombre || "Jugador"}
              </span>
              {e.jugador?.es_vip && (
                <Badge className="ml-auto" variant="outline">
                  VIP
                </Badge>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
