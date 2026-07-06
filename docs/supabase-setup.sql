-- gym-oso: tablas en el proyecto compartido con la app de viajes.
-- Prefijo gym_ evita colisión. RLS por auth.uid(). Ejecutar en SQL Editor del dashboard.

-- 4 tablas de fila única + 1 de sesiones
create table gym_profile        (user_id uuid primary key references auth.users(id), data jsonb, updated_at timestamptz default now());
create table gym_plan           (user_id uuid primary key references auth.users(id), data jsonb, updated_at timestamptz default now());
create table gym_settings       (user_id uuid primary key references auth.users(id), data jsonb, updated_at timestamptz default now());
create table gym_active_session (user_id uuid primary key references auth.users(id), data jsonb, updated_at timestamptz default now());
create table gym_sessions       (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id), data jsonb, created_at timestamptz default now());
-- Telemetría: backup push-only (la app la sube en cada sync pero NUNCA la hidrata — el buffer local manda)
create table gym_telemetry      (user_id uuid primary key references auth.users(id), data jsonb, updated_at timestamptz default now());

-- REPLICA IDENTITY FULL: necesario para DELETE realtime con filtro (convención del proyecto de viajes)
alter table gym_profile        replica identity full;
alter table gym_plan           replica identity full;
alter table gym_settings       replica identity full;
alter table gym_active_session replica identity full;
alter table gym_sessions       replica identity full;

-- RLS: cada usuario solo ve/escribe sus filas
do $$ declare t text;
begin
  foreach t in array array['gym_profile','gym_plan','gym_settings','gym_active_session','gym_sessions','gym_telemetry'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "own rows" on %I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;

-- Realtime: publicar las 5 tablas
alter publication supabase_realtime add table gym_profile, gym_plan, gym_settings, gym_active_session, gym_sessions;
