-- MVP de briefing - somente aditivo. Não grava em draft_content.
create table if not exists public.briefing_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid null references public.clients(id) on delete set null,
  site_id uuid null references public.sites(id) on delete set null,
  source text null,
  partner_ref text null,
  sale_ref text null,
  template_slug text not null,
  preset_slug text not null,
  family text not null check (family in ('health','lifestyle','professional')),
  status text not null default 'PENDING' check (status in ('PENDING','IN_PROGRESS','SUBMITTED','REVIEWED','COMPLETED')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz null,
  payload jsonb not null default '{}'::jsonb,
  consent_accepted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz null,
  reviewed_at timestamptz null,
  completed_at timestamptz null
);
create index if not exists idx_briefing_requests_status on public.briefing_requests(status, created_at desc);
create index if not exists idx_briefing_requests_site on public.briefing_requests(site_id) where site_id is not null;

create table if not exists public.briefing_assets (
  id uuid primary key default gen_random_uuid(),
  briefing_request_id uuid not null references public.briefing_requests(id) on delete cascade,
  type text not null check (type in ('logo','hero','professional','team','gallery','article')),
  storage_key text not null unique,
  filename text not null,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 5242880),
  width integer null,
  height integer null,
  created_at timestamptz not null default now()
);
create index if not exists idx_briefing_assets_request on public.briefing_assets(briefing_request_id, created_at);

alter table public.briefing_requests enable row level security;
alter table public.briefing_assets enable row level security;
revoke all on public.briefing_requests from anon, authenticated;
revoke all on public.briefing_assets from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('briefing-assets','briefing-assets',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;
