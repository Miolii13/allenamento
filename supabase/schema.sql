-- Allenamento: tabella per la sincronizzazione tra dispositivi.
-- Da eseguire una volta nel SQL Editor del progetto Supabase. Si può rieseguire senza danni.
--
-- Ogni riga è un documento dell'app (un esercizio, una scheda, un allenamento, le impostazioni;
-- in futuro anche corsa e alimentazione) salvato come JSON. Ogni utente vede solo le proprie righe.

create table if not exists public.records (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null,                  -- 'exercises' | 'templates' | 'workouts' | 'settings' | ...
  id text not null,
  data jsonb,                          -- null se il record è stato eliminato
  deleted boolean not null default false,
  modified_at bigint not null,         -- ora della modifica sul dispositivo (ms): vince la più recente
  device text not null default '',     -- dispositivo che ha scritto la riga
  updated_at timestamptz not null default now(), -- ora del server: per scaricare solo le novità
  primary key (user_id, kind, id)
);

create index if not exists records_user_updated_idx on public.records (user_id, updated_at);

alter table public.records enable row level security;

drop policy if exists "Ognuno vede solo i propri dati" on public.records;
create policy "Ognuno vede solo i propri dati" on public.records
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.records to authenticated;

-- Una modifica più vecchia di quella già salvata non sovrascrive (es. telefono rimasto offline).
create or replace function public.records_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.modified_at < old.modified_at then
    return null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists records_before_write on public.records;
create trigger records_before_write
  before insert or update on public.records
  for each row execute function public.records_before_write();
