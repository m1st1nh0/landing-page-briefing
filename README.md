# Landing Page Briefing MVP

Frontend estático pronto para GitHub Pages + backend de referência em Supabase Edge Function.

## Segurança
- nenhum `service_role`, `DATABASE_URL` ou segredo fica no frontend;
- token opaco enviado em `X-Briefing-Token` e armazenado somente como SHA-256 no banco;
- token sai da URL após carregar;
- tabelas e bucket ficam com RLS e sem policies públicas;
- Edge Function usa service role apenas no servidor;
- upload aceita somente JPG/PNG/WebP de até 5 MB e valida assinatura binária;
- CORS aceita `https://m1st1nh0.github.io` e localhost por padrão;
- o formulário nunca escreve em `draft_content`.

## Estado da implementação
- Migration do backend: **aplicada** no projeto Supabase auditado.
- Edge Function `briefing`: **ACTIVE**, versão 1.
- Bucket `briefing-assets`: privado.
- Frontend: pronto, mas ainda precisa ser colocado em um repositório público separado e habilitado no GitHub Pages.

## Rodar localmente em modo demo
1. Altere temporariamente `demoMode` para `true` em `config.js`.
2. Rode `python -m http.server 8000` nesta pasta.
3. Abra `http://localhost:8000/?token=demo-briefing-token-00000000000000000000`.
4. O modo demo salva rascunho no `localStorage`; não envia dados à nuvem.

## Publicação no GitHub Pages
1. Crie um repositório público separado, recomendado: `m1st1nh0/landing-page-briefing`.
2. Copie o conteúdo deste projeto para a raiz.
3. Habilite GitHub Pages para a branch `main`.
4. Gere o primeiro link pelo SQL de `scripts/new-briefing.sql` e envie o token apenas ao cliente correto.
5. Faça um smoke real do formulário publicado antes de usar com cliente.

A Edge Function foi implantada com `verify_jwt=false` **somente porque a função implementa autenticação própria por token opaco**.

## Fluxo de status
`PENDING → IN_PROGRESS → SUBMITTED → REVIEWED → COMPLETED`.

`SUBMITTED` bloqueia novas alterações via token. `REVIEWED` e `COMPLETED` são atualizados pelo operador/SUPER_ADMIN, não pelo browser público.

## Observação importante
Este projeto contém um **manifesto público sanitizado**, não copia os schemas privados da plataforma. A evolução recomendada é gerar automaticamente esse manifesto no CI do repositório privado para evitar divergência.
