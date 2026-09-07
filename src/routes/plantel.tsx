import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, MessageCircle } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { obtenerPlantelSheet } from "@/lib/sheets.functions";

export const Route = createFileRoute("/plantel")({
  head: () => ({
    meta: [
      { title: "Plantel de jugadores | Convocatorias" },
      {
        name: "description",
        content:
          "Listado completo del plantel con mail, teléfono, barrio, lote y puesto en la cancha.",
      },
      { property: "og:title", content: "Plantel de jugadores | Convocatorias" },
      {
        property: "og:description",
        content: "Ficha de contacto y puesto de cada jugador del grupo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlantelPage,
});

function PlantelPage() {
  const [busqueda, setBusqueda] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["plantel-sheet"],
    queryFn: () => obtenerPlantelSheet(),
    staleTime: 5 * 60 * 1000,
  });

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return data ?? [];
    return (data ?? []).filter((j) =>
      [j.nombre, j.apodo, j.email, j.telefono, j.puesto, j.barrio, j.lote]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [data, busqueda]);

  const abrirWhatsApp = (telefono?: string) => {
    if (!telefono) return;
    
    // Quitamos espacios, guiones y cualquier símbolo (incluyendo el +)
    let numeroLimpio = telefono.replace(/\D/g, "");
    
    // Si el número no empieza con el código de Argentina (54), le agregamos el 549 por defecto
    if (!numeroLimpio.startsWith("54")) {
      numeroLimpio = "549" + numeroLimpio;
    }

    // Abre directamente el chat sin ningún mensaje predefinido
    window.open(`https://wa.me/${numeroLimpio}`, "_blank");
  };

  return (
    <AppShell
      title="Plantel"
      description="Datos de contacto y puesto de cada jugador, sincronizados desde la planilla."
    >
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por nombre, apodo, mail, puesto…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      {isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Cargando plantel…
        </p>
      ) : error ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-destructive">
            {error instanceof Error ? error.message : "No se pudo leer el plantel."}
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {filtrados.length} de {data?.length ?? 0} jugadores
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {filtrados.map((j) => (
              <Card key={`${j.email}-${j.nombre}`}>
                <CardContent className="space-y-1 py-4 text-sm">
                  <div className="flex items-center gap-2">
                    <p className="mr-auto font-semibold text-foreground">
                      {j.apodo || j.nombre}
                    </p>
                    {j.puesto && <Badge variant="secondary">{j.puesto}</Badge>}
                    {j.telefono && (
                      <Button
                        size="icon"
                        variant="outline"
                        className="size-8 text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
                        title="Abrir chat en WhatsApp"
                        onClick={() => abrirWhatsApp(j.telefono)}
                      >
                        <MessageCircle className="size-4" />
                      </Button>
                    )}
                  </div>
                  <p className="text-muted-foreground">{j.nombre}</p>
                  <p className="truncate text-muted-foreground">{j.email}</p>
                  {j.email_alternativo && (
                    <p className="truncate text-muted-foreground">
                      Alt: {j.email_alternativo}
                    </p>
                  )}
                  {j.telefono && <p className="text-muted-foreground">Tel: {j.telefono}</p>}
                  {(j.barrio || j.lote) && (
                    <p className="text-muted-foreground">
                      {[j.barrio, j.lote].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {j.edad && (
                    <p className="text-muted-foreground">
                      {j.edad} años
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </AppShell>
  );
}
