-- Execute no SQL Editor apenas pelo operador. O token bruto é retornado UMA vez e nunca armazenado.
-- Ajuste preset/template/family/source antes de executar.
with secret as (
  select encode(extensions.gen_random_bytes(32), 'hex') as token
), inserted as (
  insert into public.briefing_requests (template_slug, preset_slug, family, source, partner_ref, token_hash, expires_at)
  select 'clinica', 'fisioterapia', 'health', 'parceira-marketing', 'parceira-01',
         encode(extensions.digest(token, 'sha256'), 'hex'), now() + interval '14 days'
  from secret
  returning id
)
select inserted.id, secret.token
from inserted cross join secret;
-- Monte o link: https://m1st1nh0.github.io/<repo>/?token=<TOKEN_RETORNADO>
