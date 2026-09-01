CREATE TABLE public.jugadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  nombre text NOT NULL,
  apodo text NOT NULL DEFAULT '',
  fecha_registro timestamptz NOT NULL DEFAULT now(),
  es_vip boolean NOT NULL DEFAULT false,
  estado_pago text NOT NULL DEFAULT 'AL_DÍA',
  puntaje_historico numeric NOT NULL DEFAULT 0,
  asistencias_totales integer NOT NULL DEFAULT 0,
  no_apariciones integer NOT NULL DEFAULT 0,
  bajas_aviso integer NOT NULL DEFAULT 0,
  juega_con_lluvia boolean NOT NULL DEFAULT true,
  sede_preferida text NOT NULL DEFAULT 'CANTON',
  flexible boolean NOT NULL DEFAULT false,
  activo boolean NOT NULL DEFAULT true
);

CREATE TABLE public.sedes (
  id text PRIMARY KEY,
  nombre text NOT NULL,
  horario text NOT NULL DEFAULT '',
  capacidad integer NOT NULL DEFAULT 14,
  ubicacion text NOT NULL DEFAULT '',
  activa boolean NOT NULL DEFAULT true
);

CREATE TABLE public.convocatorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha date NOT NULL UNIQUE,
  estado text NOT NULL DEFAULT 'PLANIFICADA',
  suspension_lluvia boolean NOT NULL DEFAULT false,
  sedes_canceladas text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.inscripciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  convocatoria_id uuid NOT NULL REFERENCES public.convocatorias(id) ON DELETE CASCADE,
  jugador_id uuid NOT NULL REFERENCES public.jugadores(id) ON DELETE CASCADE,
  sede_preferida text NOT NULL DEFAULT 'CANTON',
  flexible boolean NOT NULL DEFAULT false,
  juega_con_lluvia boolean NOT NULL DEFAULT true,
  timestamp_inscripcion timestamptz NOT NULL DEFAULT now(),
  estado text NOT NULL DEFAULT 'NO_ASIGNADO',
  motivo_no_asignacion text,
  UNIQUE (convocatoria_id, jugador_id)
);

CREATE TABLE public.equipos_asignados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  convocatoria_id uuid NOT NULL REFERENCES public.convocatorias(id) ON DELETE CASCADE,
  sede_id text NOT NULL,
  jugador_id uuid NOT NULL REFERENCES public.jugadores(id) ON DELETE CASCADE,
  tipo_asignacion text NOT NULL DEFAULT 'TITULAR',
  orden_convocatoria integer NOT NULL DEFAULT 1,
  asistio boolean,
  calificacion numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.historial_asistencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jugador_id uuid NOT NULL REFERENCES public.jugadores(id) ON DELETE CASCADE,
  convocatoria_id uuid NOT NULL REFERENCES public.convocatorias(id) ON DELETE CASCADE,
  sede_id text NOT NULL,
  asistio boolean NOT NULL DEFAULT false,
  estado text NOT NULL,
  motivo text,
  "timestamp" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.configuracion_panel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lluvia_suspension text NOT NULL DEFAULT 'SOL',
  suspension_extra_1 text,
  suspension_extra_2 text,
  columna_pagos text,
  puertos_10vs10 boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.jugadores TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sedes TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.convocatorias TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inscripciones TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipos_asignados TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.historial_asistencias TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.configuracion_panel TO anon, authenticated;
GRANT ALL ON public.jugadores, public.sedes, public.convocatorias, public.inscripciones, public.equipos_asignados, public.historial_asistencias, public.configuracion_panel TO service_role;

ALTER TABLE public.jugadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sedes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.convocatorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inscripciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipos_asignados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historial_asistencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracion_panel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "open_jugadores" ON public.jugadores FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "open_sedes" ON public.sedes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "open_convocatorias" ON public.convocatorias FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "open_inscripciones" ON public.inscripciones FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "open_equipos" ON public.equipos_asignados FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "open_historial" ON public.historial_asistencias FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "open_config" ON public.configuracion_panel FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

INSERT INTO public.sedes (id, nombre, horario, capacidad, ubicacion) VALUES
  ('CANTON', 'Cantón', '20:00', 14, 'Cantón'),
  ('SM', 'SM', '21:00', 16, 'San Martín'),
  ('PUERTOS', 'Puertos', '22:00', 14, 'Puertos');

INSERT INTO public.configuracion_panel (lluvia_suspension, puertos_10vs10) VALUES ('SOL', false);

INSERT INTO public.jugadores (email, nombre, apodo, es_vip, estado_pago, sede_preferida, flexible, juega_con_lluvia, asistencias_totales) VALUES
  ('martin@example.com', 'Martín Narvaez', 'Tincho', true, 'AL_DÍA', 'CANTON', true, true, 24),
  ('juan@example.com', 'Juan Pérez', 'Juancho', false, 'AL_DÍA', 'SM', false, true, 18),
  ('lucas@example.com', 'Lucas Gómez', 'Luqui', false, 'DEBE', 'PUERTOS', true, false, 9),
  ('diego@example.com', 'Diego Ramírez', 'Dieguito', true, 'AL_DÍA', 'CANTON', false, true, 31),
  ('pablo@example.com', 'Pablo Sosa', 'Pablito', false, 'AL_DÍA', 'SM', true, true, 12);