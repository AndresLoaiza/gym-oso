-- gym-oso: tablas en el proyecto compartido con la app de viajes.
-- Prefijo gym_ evita colisión. SIN login (decisión user 2026-06-23, único usuario):
-- RLS abierta a anon (privacidad por oscuridad, igual que el viaje) + user_id fijo desde la app.
-- Ejecutar en SQL Editor del dashboard.

-- 5 tablas de fila única + 1 de sesiones
create table gym_profile        (user_id uuid primary key, data jsonb, updated_at timestamptz default now());
create table gym_plan           (user_id uuid primary key, data jsonb, updated_at timestamptz default now());
create table gym_settings       (user_id uuid primary key, data jsonb, updated_at timestamptz default now());
create table gym_active_session (user_id uuid primary key, data jsonb, updated_at timestamptz default now());
-- Telemetría: backup push-only (la app la sube en cada sync pero NUNCA la hidrata — el buffer local manda)
create table gym_telemetry      (user_id uuid primary key, data jsonb, updated_at timestamptz default now());
create table gym_sessions       (id uuid primary key default gen_random_uuid(), user_id uuid, data jsonb, created_at timestamptz default now());

-- REPLICA IDENTITY FULL: necesario para DELETE realtime con filtro (convención del proyecto de viajes)
alter table gym_profile        replica identity full;
alter table gym_plan           replica identity full;
alter table gym_settings       replica identity full;
alter table gym_active_session replica identity full;
alter table gym_telemetry      replica identity full;
alter table gym_sessions       replica identity full;

-- RLS abierta a anon (riesgo asumido: cualquiera con la anon key lee/escribe — datos de gimnasio)
do $$ declare t text;
begin
  foreach t in array array['gym_profile','gym_plan','gym_settings','gym_active_session','gym_sessions','gym_telemetry'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy anon_all on %I for all using (true) with check (true)', t);
    execute format('grant all on %I to anon, authenticated', t);
  end loop;
end $$;

-- Realtime: publicar las tablas que la app subscribe (telemetría no — push-only)
alter publication supabase_realtime add table gym_profile, gym_plan, gym_settings, gym_active_session, gym_sessions;
