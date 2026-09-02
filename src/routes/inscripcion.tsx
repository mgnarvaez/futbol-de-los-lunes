import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { convocatoriaService } from "@/lib/services/convocatoriaService";
import { jugadorService } from "@/lib/services/jugadorService";
import { SEDES, SEDE_LABELS, type Convocatoria, type Sede } from "@/lib/types";

export const Route = createFileRoute("/inscripcion")({
  head: () => ({
    meta: [
      { title: "Inscripción a la convocatoria | Fútbol" },
      {
        name: "description",
        content:
          "Anotate en la convocatoria del día: elegí tu sede, si jugás con lluvia y si sos flexible.",
      },
      { property: "og:title", content: "Inscripción a la convocatoria | Fútbol" },
      {
        property: "og:description",
        content: "Anotate en la convocatoria del día y elegí tu sede preferida.",
      },
    ],
  }),
  component: InscripcionPage,
});

function InscripcionPage() {
  const [convocatoria, setConvocatoria] = useState<Convocatoria | null>(null);
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);

  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [apodo, setApodo] = useState("");
  const [sede, setSede] = useState<Sede>("CANTON");
  const [flexible, setFlexible] = useState(true);
  const [lluvia, setLluvia] = useState(true);

  useEffect(() => {
    convocatoriaService
      .obtenerConvocatoriaDelDia()
      .then(setConvocatoria)
      .catch(() => toast.error("No se pudo cargar la convocatoria"))
      .finally(() => setCargando(false));
  }, []);

  const abierta = convocatoria?.estado === "ABIERTA";

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!convocatoria) return;
    setEnviando(true);
    try {
      const jugador = await jugadorService.crearOActualizarJugador({
        email: email.trim().toLowerCase(),
        nombre: nombre.trim(),
        apodo: apodo.trim() || nombre.trim(),
        sede_preferida: sede,
        flexible,
        juega_con_lluvia: lluvia,
        activo: true,
      });

      const { error } = await supabase.from("inscripciones").insert([
        {
          convocatoria_id: convocatoria.id,
          jugador_id: jugador.id,
          sede_preferida: sede,
          flexible,
          juega_con_lluvia: lluvia,
          estado: "NO_ASIGNADO",
          timestamp_inscripcion: new Date().toISOString(),
        } as never,
      ]);
      if (error) throw error;

      setListo(true);
      toast.success("¡Inscripción registrada!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al inscribirse");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <AppShell
      title="Inscripción"
      description="Anotate para la convocatoria del día y elegí tu sede."
    >
      {cargando ? (
        <p className="text-sm text-muted-foreground">Cargando convocatoria…</p>
      ) : !convocatoria ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Todavía no hay convocatoria creada para hoy.
          </CardContent>
        </Card>
      ) : !abierta ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            La convocatoria de hoy está {convocatoria.estado.toLowerCase()}. Esperá a que
            se abra la inscripción.
          </CardContent>
        </Card>
      ) : listo ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <CheckCircle2 className="size-10 text-success" />
            <p className="font-semibold text-foreground">Ya estás anotado</p>
            <p className="text-sm text-muted-foreground">
              Revisá la vista de equipos cuando se cierre la convocatoria.
            </p>
            <Button variant="outline" onClick={() => setListo(false)}>
              Anotar a otro jugador
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Convocatoria del {convocatoria.fecha}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={enviar}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nombre">Nombre y apellido</Label>
                  <Input
                    id="nombre"
                    required
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="apodo">Apodo (opcional)</Label>
                  <Input
                    id="apodo"
                    value={apodo}
                    onChange={(e) => setApodo(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Sede preferida</Label>
                <div className="grid gap-2">
                  {SEDES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSede(s)}
                      className={`rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                        sede === s
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-foreground hover:bg-accent"
                      }`}
                    >
                      {SEDE_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 rounded-lg border border-border p-4">
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="flexible" className="font-normal">
                    Puedo jugar en otra sede si hace falta
                  </Label>
                  <Switch id="flexible" checked={flexible} onCheckedChange={setFlexible} />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="lluvia" className="font-normal">
                    Juego con lluvia
                  </Label>
                  <Switch id="lluvia" checked={lluvia} onCheckedChange={setLluvia} />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={enviando}>
                {enviando && <Loader2 className="mr-2 size-4 animate-spin" />}
                Anotarme
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}
