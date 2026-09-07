from pathlib import Path
import json,re
root=Path(__file__).resolve().parents[1]
html=(root/'index.html').read_text(encoding='utf-8')
js=(root/'app.js').read_text(encoding='utf-8')
edge=(root/'supabase/functions/briefing/index.ts').read_text(encoding='utf-8')
schema=json.loads((root/'schema/briefing-schema.json').read_text(encoding='utf-8'))
assert 'service_role' not in html.lower()
assert 'database_url' not in html.lower()
assert 'history.replaceState' in js
assert 'X-Briefing-Token' in js
assert 'token_hash' in (root/'supabase/migrations/202609040001_briefing_mvp.sql').read_text()
assert 'SUBMITTED' in edge and 'SHA-256' in edge
assert schema['limits']['imageMaxBytes']==5*1024*1024
assert set(schema['families'])=={'health','lifestyle','professional'}
print('ok: contrato MVP validado')
