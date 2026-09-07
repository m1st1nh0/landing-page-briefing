-- Diagnóstico de um link de briefing.
-- Cole abaixo APENAS o token bruto recebido ao executar scripts/new-briefing.sql.
-- Não commite tokens reais neste repositório.

with input as (
  select 'COLE_O_TOKEN_AQUI'::text as token
)
select
  br.id,
  br.status,
  br.template_slug,
  br.preset_slug,
  br.family,
  br.created_at,
  br.expires_at,
  br.revoked_at,
  (br.expires_at > now() and br.revoked_at is null) as token_ativo
from public.briefing_requests br
cross join input
where br.token_hash = encode(extensions.digest(input.token, 'sha256'), 'hex');

-- Resultado esperado: exatamente 1 linha.
-- 0 linhas = o token nunca foi cadastrado neste projeto Supabase (ou não é o token correto).
-- token_ativo=false = expirado ou revogado.
