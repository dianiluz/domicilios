-- =====================================================================
-- CUPISSA DOMIS - Ejecutar UNA VEZ en Supabase > SQL Editor > Run
-- (se puede volver a ejecutar sin problema)
-- No borra ni modifica tus tablas actuales.
-- =====================================================================

-- 0) Ayuda: saber si quien consulta es administrador
create or replace function public.cupissa_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;

-- 1) MENSAJES administrador <-> domiciliario
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  courier_id uuid not null references public.profiles(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  sender_id uuid not null,
  sender_role text not null check (sender_role in ('admin','courier')),
  kind text not null default 'texto',      -- texto | entrega | transferencia
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists messages_courier_idx on public.messages (courier_id, created_at);
alter table public.messages enable row level security;

drop policy if exists msg_select on public.messages;
drop policy if exists msg_insert on public.messages;
drop policy if exists msg_update on public.messages;
create policy msg_select on public.messages for select
  using (public.cupissa_is_admin() or courier_id = auth.uid());
create policy msg_insert on public.messages for insert with check (
  (public.cupissa_is_admin() and sender_role = 'admin' and sender_id = auth.uid())
  or (courier_id = auth.uid() and sender_role = 'courier' and sender_id = auth.uid()));
create policy msg_update on public.messages for update
  using (public.cupissa_is_admin() or courier_id = auth.uid());

-- 2) UBICACION Y MENSAJES EN TIEMPO REAL
do $$ begin
  begin alter publication supabase_realtime add table public.messages;  exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.locations; exception when duplicate_object then null; end;
end $$;

-- 3) ELIMINAR DOMICILIARIOS (conserva el historial de servicios y ahorro)
alter table public.profiles add column if not exists active boolean not null default true;

create or replace function public.delete_courier(uid uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.cupissa_is_admin() then
    raise exception 'Solo el administrador puede eliminar domiciliarios';
  end if;
  if not exists (select 1 from public.profiles where id = uid and role = 'courier') then
    raise exception 'Ese usuario no es un domiciliario';
  end if;
  update public.orders set courier_id = null, status = 'pendiente'
    where courier_id = uid and status <> 'entregado';
  delete from public.locations where courier_id = uid;
  update public.shifts set end_at = now() where courier_id = uid and end_at is null;
  update public.profiles set active = false where id = uid;
  update auth.users set banned_until = 'infinity' where id = uid;   -- bloquea el acceso
end $$;
revoke all on function public.delete_courier(uuid) from public;
grant execute on function public.delete_courier(uuid) to authenticated;
