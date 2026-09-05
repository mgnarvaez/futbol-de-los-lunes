import { createFileRoute } from "@tanstack/react-router";
import { Download, RefreshCw, Copy } from "lucide-react";
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
      { title: "Convocados por sede | Fútbol" },
      {
        name: "description",
        content: "Titulares y suplentes convocados por sede para el día.",
      },
    ],
  }),
  component: ConvocadosPage,
});

function ConvocadosPage() {
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
      toast.error(error instanceof Error ? error.message : "Error al cargar convocados");
    } finally {
      setCargando(false);
    }
  }, []);

  const rearmar = useCallback(async () => {
    setCargando(true);
    try {
      const conv = await convocatoriaService.obtenerConvocatoriaDelDia();
      setConvocatoria(conv);
      if (!conv) {
        setEquipos(null);
        toast.error("No hay convocatoria para hoy");
        return;
      }
      const resultado = await armadorService.armarEquipos(conv.id);
      setEquipos(resultado.equipos);
      toast.success("Convocados actualizados");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al armar convocados");
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
      toast.error("No hay convocados para exportar");
      return;
    }
    exportService.exportarCSV(filas, "convocados_por_sede");
  };

  const copiarParaWhatsApp = (sedeId: Sede, grupo: GrupoSede | undefined) => {
    if (!grupo || (grupo.titulares.length === 0 && grupo.suplentes.length === 0)) {
      toast.error("No hay jugadores para copiar en esta sede.");
      return;
    }

    const nombreSede = SEDE_LABELS[sedeId];
    let texto = `🏟️ *CONVOCADOS - ${nombreSede}*\n\n`;
    
    texto += `*⚽ Titulares (${grupo.titulares.length}):*\n`;
    grupo.titulares.forEach((t, i) => {
      const nombre = t.jugador?.apodo || t.jugador?.nombre || "Jugador";
      texto += `${i + 1}. ${nombre}${t.jugador?.es_vip ? ' ⭐' : ''}\n`;
    });

    if (grupo.suplentes.length > 0) {
      texto += `\n*🔄 Suplentes:*\n`;
      grupo.suplentes.forEach((s, i) => {
        const nombre = s.jugador?.apodo || s.jugador?.nombre || "Jugador";
        texto += `${i + 1}. ${nombre}\n`;
      });
    }

    navigator.clipboard.writeText(texto);
    toast.success(`Lista de ${nombreSede} copiada lista para WhatsApp`);
  };

  return (
    <AppShell
      title="Convocados"
      description="Titulares y suplentes convocados por sede para la fecha."
    >
      <div className="flex flex-wrap gap-2 mb-6">
        <Button onClick={() => void rearmar()} disabled={cargando}>
          <RefreshCw className={`mr-2 size-4 ${cargando ? "animate-spin" : ""}`} />
          Rearmar convocados
        </Button>
        <Button variant="outline" onClick={exportar}>
          <Download className="mr-2 size-4" />
          Exportar CSV
        </Button>
      </div>

      {!convocatoria ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No hay convocatoria activa para hoy.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {SEDES.map((sede) => {
            const grupo = equipos?.get(sede);
            const cancelada = convocatoria.sedes_canceladas?.includes(sede);
            
            return (
              <Card key={sede} className={cancelada ? "opacity-60 bg-muted/50" : undefined}>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{SEDE_LABELS[sede]}</CardTitle>
                    {cancelada ? (
                      <Badge variant="destructive">Cancelada</Badge>
                    ) : (
                      <Badge variant="secondary" className={grupo?.titulares.length === 14 || grupo?.titulares.length === 16 ? "bg-green-100 text-green-800" : ""}>
                        {grupo?.titulares.length ?? 0} titulares
                      </Badge>
                    )}
                  </div>
                  
                  {!cancelada && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => copiarParaWhatsApp(sede, grupo)}
                      title="Copiar para WhatsApp"
                    >
                      <Copy className="size-4" />
                    </Button>
                  )}
                </CardHeader>
                
                <CardContent className="space-y-4 pt-2">
                  <Lista titulo="Titulares" items={grupo?.titulares ?? []} cancelada={cancelada} />
                  <Lista titulo="Suplentes" items={grupo?.suplentes ?? []} cancelada={cancelada} />
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
  cancelada,
}: {
  titulo: string;
  items: GrupoSede["titulares"];
  cancelada?: boolean;
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
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm ${cancelada ? "bg-transparent text-muted-foreground" : "bg-muted/60 text-foreground"}`}
            >
              <span className="w-5 text-xs text-muted-foreground">{i + 1}</span>
              <span className="truncate">
                {e.jugador?.apodo || e.jugador?.nombre || "Jugador"}
              </span>
              {e.jugador?.es_vip && !cancelada && (
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
