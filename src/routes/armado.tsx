import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle, RefreshCw, Shuffle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { correrArmadoEquipos, obtenerEquiposArmadosSheet } from "@/lib/sheets.functions";
import type { EquipoSede, JugadorEquipo } from "@/lib/sheets.server";
import { SEDE_LABELS } from "@/lib/types";

export const Route = createFileRoute("/armado")({
  head: () => ({
    meta: [
      { title: "Armado de equipos por puntaje | Fútbol" },
      {
        name: "description",
        content:
          "Corré el algoritmo de la planilla de puntajes y mirá los dos equipos de cada sede.",
      },
      { property: "og:title", content: "Armado de equipos por puntaje" },
      {
        property: "og:description",
        content: "Blancos y negros de Cantón, Puertos y San Matías según los puntajes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ArmadoPage,
});

function ListaEquipo({
  titulo,
  puntaje,
  jugadores,
  oscuro,
}: {
  titulo: string;
  puntaje: string;
  jugadores: JugadorEquipo[];
  oscuro?: boolean;
}) {
  return (
    <div className="flex-1 rounded-lg border border-border p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">
          {oscuro ? "⚫" : "⚪"} {titulo}
        </p>
        <Badge variant="secondary">{puntaje}</Badge>
      </div>
      {jugadores.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin jugadores</p>
      ) : (
        <ul className="space-y-1">
          {jugadores.map((j, i) => (
            <li key={`${j.nombre}-${i}`} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-foreground">{j.nombre}</span>
              {j.puesto ? (
                <span className="text-xs text-muted-foreground">{j.puesto}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function enviarPorWhatsApp(eq: EquipoSede) {
  const linea = (j: JugadorEquipo, i: number) =>
    `${i + 1}. ${j.nombre}${j.puesto ? ` (${j.puesto})` : ""}`;

  let texto = `⚽ *EQUIPOS - ${SEDE_LABELS[eq.sede]}*\n\n`;
  texto += `*⚪ Blancos ${eq.puntajeBlancos}:*\n`;
  texto += eq.blancos.map(linea).join("\n");
  texto += `\n\n*⚫ Negros ${eq.puntajeNegros}:*\n`;
  texto += eq.negros.map(linea).join("\n");

  window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank");
}

function ArmadoPage() {
  const [equipos, setEquipos] = useState<EquipoSede[]>([]);
  const [cargando, setCargando] = useState(true);
  const [armando, setArmando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setEquipos(await obtenerEquiposArmadosSheet());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al leer la planilla");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const armar = async () => {
    setArmando(true);
    try {
      const res = await correrArmadoEquipos();
      if (!res.ok) {
        toast.error(res.mensaje);
        return;
      }
      toast.success("Equipos armados en la planilla");
      await cargar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al correr el armado");
    } finally {
      setArmando(false);
    }
  };

  return (
    <AppShell
      title="Armado de equipos"
      description="Corré el algoritmo de puntajes de tu planilla y mirá los dos equipos de cada sede."
    >
      <div className="flex flex-wrap gap-2">
        <Button onClick={armar} disabled={armando}>
          <Shuffle className="mr-2 size-4" />
          {armando ? "Armando..." : "Armar equipos"}
        </Button>
        <Button variant="outline" onClick={cargar} disabled={cargando}>
          <RefreshCw className={`mr-2 size-4 ${cargando ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {equipos.map((eq) => (
        <Card key={eq.sede}>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle>{SEDE_LABELS[eq.sede]}</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => enviarPorWhatsApp(eq)}
              disabled={eq.blancos.length === 0 && eq.negros.length === 0}
            >
              <MessageCircle className="mr-2 size-4" />
              WhatsApp
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row">
            <ListaEquipo titulo="Blancos" puntaje={eq.puntajeBlancos} jugadores={eq.blancos} />
            <ListaEquipo titulo="Negros" puntaje={eq.puntajeNegros} jugadores={eq.negros} oscuro />
          </CardContent>
        </Card>
      ))}

      {!cargando && equipos.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Todavía no hay equipos armados en la planilla.
        </p>
      ) : null}
    </AppShell>
  );
}
