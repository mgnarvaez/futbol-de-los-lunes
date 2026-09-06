import { Link } from "@tanstack/react-router";
import { ClipboardList, Moon, Shuffle, Sun, Users, UsersRound } from "lucide-react";
import { useEffect, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";

const NAV = [
  { to: "/", label: "Panel", icon: ClipboardList },
  { to: "/equipos", label: "Convocados", icon: Users },
  { to: "/armado", label: "Equipos", icon: Shuffle },
  { to: "/plantel", label: "Plantel", icon: UsersRound },
] as const;


export function AppShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const darkMode = useAppStore((s) => s.darkMode);
  const setDarkMode = useAppStore((s) => s.setDarkMode);
  const toggleDarkMode = useAppStore((s) => s.toggleDarkMode);

  useEffect(() => {
    const guardado = localStorage.getItem("darkMode");
    if (guardado !== null) setDarkMode(guardado === "true");
  }, [setDarkMode]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-primary text-lg text-primary-foreground">
            ⚽
          </span>
          <div className="mr-auto">
            <p className="text-sm font-semibold leading-none text-foreground">
              Convocatorias
            </p>
            <p className="text-xs text-muted-foreground">Fútbol amateur</p>
          </div>
          <nav className="hidden gap-1 sm:flex">
            {NAV.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                activeProps={{ className: "bg-primary/10 text-primary" }}
                activeOptions={{ exact: to === "/" }}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            ))}
          </nav>
          <Button
            variant="outline"
            size="icon"
            aria-label="Cambiar tema"
            onClick={toggleDarkMode}
          >
            {darkMode ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-24 pt-6 sm:pb-10">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        <div className="mt-6 space-y-6">{children}</div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-card sm:hidden">
        {NAV.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex flex-1 flex-col items-center gap-1 py-2.5 text-xs text-muted-foreground"
            activeProps={{ className: "text-primary" }}
            activeOptions={{ exact: to === "/" }}
          >
            <Icon className="size-5" />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
