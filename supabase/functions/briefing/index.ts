import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const MAX_BYTES = 5 * 1024 * 1024;
const MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_KINDS = new Set(["logo", "hero", "professional", "team", "gallery", "article"]);
const BASE_ORIGINS = new Set(["https://m1st1nh0.github.io", "http://localhost:8000", "http://127.0.0.1:8000"]);
const extraOrigins = (Deno.env.get("BRIEFING_ALLOWED_ORIGINS") || "").split(",").map(v=>v.trim()).filter(Boolean);
extraOrigins.forEach(v=>BASE_ORIGINS.add(v));

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {auth:{persistSession:false,autoRefreshToken:false}});

function cors(req: Request){
  const origin=req.headers.get("origin")||"";
  if(!BASE_ORIGINS.has(origin)) return null;
  return {"Access-Control-Allow-Origin":origin,"Vary":"Origin","Access-Control-Allow-Headers":"content-type,x-briefing-token","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
}
function json(req:Request, body:unknown, status=200){const h=cors(req);return new Response(JSON.stringify(body),{status,headers:h||{"Content-Type":"application/json","Cache-Control":"no-store"}});}
async function sha256(value:string){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");}
function signatureOk(bytes:Uint8Array,mime:string){
  if(mime==="image/jpeg") return bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
  if(mime==="image/png") return bytes.length>=8&&[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a].every((v,i)=>bytes[i]===v);
  return bytes.length>=12&&new TextDecoder().decode(bytes.slice(0,4))==="RIFF"&&new TextDecoder().decode(bytes.slice(8,12))==="WEBP";
}
async function loadRequest(req:Request){
  const token=req.headers.get("x-briefing-token")?.trim(); if(!token||token.length<32)return null;
  const tokenHash=await sha256(token);
  const {data,error}=await supabase.from("briefing_requests").select("id,status,expires_at,revoked_at,preset_slug,template_slug,family,payload").eq("token_hash",tokenHash).maybeSingle();
  if(error||!data)return null;
  if(data.revoked_at||new Date(data.expires_at).getTime()<=Date.now())return null;
  return data;
}
function requiredOk(p:any){return Boolean(p?.businessName?.trim()&&p?.responsibleName?.trim()&&p?.responsibleEmail?.trim()&&p?.whatsapp?.trim()&&p?.businessSummary?.trim()&&p?.serviceSummary?.trim()&&p?.consent);}

Deno.serve(async(req:Request)=>{
  const ch=cors(req);
  if(req.method==="OPTIONS") return ch?new Response(null,{status:204,headers:ch}):new Response(null,{status:403});
  if(!ch) return json(req,{error:"Origem não permitida."},403);
  try{
    const br=await loadRequest(req); if(!br)return json(req,{error:"Link inválido ou expirado."},401);
    if(req.method==="GET"){
      if(["SUBMITTED","COMPLETED"].includes(br.status))return json(req,{error:"Briefing já finalizado."},409);
      return json(req,{status:br.status,preset:br.preset_slug,family:br.family,payload:br.payload||{}});
    }
    if(req.method!=="POST")return json(req,{error:"Método não permitido."},405);
    const ct=req.headers.get("content-type")||"";
    if(ct.includes("multipart/form-data")){
      if(["SUBMITTED","REVIEWED","COMPLETED"].includes(br.status))return json(req,{error:"Briefing bloqueado para alterações."},409);
      const fd=await req.formData(); if(fd.get("action")!=="upload")return json(req,{error:"Ação inválida."},400);
      const kind=String(fd.get("kind")||""); const file=fd.get("file");
      if(!ALLOWED_KINDS.has(kind)||!(file instanceof File))return json(req,{error:"Arquivo/slot inválido."},400);
      if(!MIMES.has(file.type)||file.size<=0||file.size>MAX_BYTES)return json(req,{error:"Use JPG, PNG ou WebP com até 5 MB."},415);
      const bytes=new Uint8Array(await file.arrayBuffer()); if(!signatureOk(bytes,file.type))return json(req,{error:"O conteúdo não corresponde a uma imagem válida."},415);
      const ext=file.type==="image/jpeg"?"jpg":file.type.split("/")[1]; const key=`briefings/${br.id}/${kind}/${crypto.randomUUID()}.${ext}`;
      const {error:upErr}=await supabase.storage.from("briefing-assets").upload(key,bytes,{contentType:file.type,upsert:false}); if(upErr)throw upErr;
      const {data:asset,error:dbErr}=await supabase.from("briefing_assets").insert({briefing_request_id:br.id,type:kind,storage_key:key,filename:file.name,mime_type:file.type,size_bytes:file.size}).select("id,type,filename,size_bytes").single();
      if(dbErr){await supabase.storage.from("briefing-assets").remove([key]);throw dbErr;}
      await supabase.from("briefing_requests").update({status:br.status==="PENDING"?"IN_PROGRESS":br.status,updated_at:new Date().toISOString()}).eq("id",br.id);
      return json(req,{ok:true,asset});
    }
    const body=await req.json(); const action=body?.action;
    if(action==="save"){
      if(["SUBMITTED","REVIEWED","COMPLETED"].includes(br.status))return json(req,{error:"Briefing bloqueado para alterações."},409);
      const payload=body?.payload&&typeof body.payload==="object"?body.payload:{};
      const {error}=await supabase.from("briefing_requests").update({payload,status:"IN_PROGRESS",updated_at:new Date().toISOString()}).eq("id",br.id); if(error)throw error;
      return json(req,{ok:true,status:"IN_PROGRESS"});
    }
    if(action==="submit"){
      if(["SUBMITTED","REVIEWED","COMPLETED"].includes(br.status))return json(req,{error:"Briefing já finalizado."},409);
      const payload=body?.payload&&typeof body.payload==="object"?body.payload:{}; if(!requiredOk(payload))return json(req,{error:"Preencha os campos obrigatórios e confirme a autorização dos materiais."},422);
      const now=new Date().toISOString(); const {error}=await supabase.from("briefing_requests").update({payload,status:"SUBMITTED",submitted_at:now,consent_accepted_at:now,updated_at:now}).eq("id",br.id); if(error)throw error;
      return json(req,{ok:true,status:"SUBMITTED"});
    }
    return json(req,{error:"Ação inválida."},400);
  }catch(err){console.error("briefing function error",err instanceof Error?err.message:"unknown");return json(req,{error:"Não foi possível processar agora."},500);}
});