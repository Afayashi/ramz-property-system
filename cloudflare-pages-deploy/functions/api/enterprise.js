const SUPABASE_URL = 'https://tmadxitvailfqtqthhkd.supabase.co';
const SUPABASE_ANON = 'sb_publishable_iDOR8WCqFAqisuotzhuJEw_agdYeyyQ';
const enc = new TextEncoder();

function json(body,status=200,headers={}) { return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}}); }
function b64url(bytes){return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function fromB64(v){v=String(v).replace(/-/g,'+').replace(/_/g,'/');while(v.length%4)v+='=';return Uint8Array.from(atob(v),c=>c.charCodeAt(0));}
function cookie(request,name){const m=(request.headers.get('cookie')||'').match(new RegExp('(?:^|;\\s*)'+name+'=([^;]+)'));return m?decodeURIComponent(m[1]):'';}
async function hmac(secret,value){const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return b64url(await crypto.subtle.sign('HMAC',key,enc.encode(value)));}
async function session(secret,request){const token=cookie(request,'ramz_session');if(!token)return null;const parts=token.split('.');if(parts.length!==2||await hmac(secret,parts[0])!==parts[1])return null;try{const body=JSON.parse(new TextDecoder().decode(fromB64(parts[0])));return body.exp>Date.now()?body:null;}catch{return null;}}
async function rpc(secret,action,payload={}){const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/ramz_server_call`,{method:'POST',headers:{apikey:SUPABASE_ANON,authorization:`Bearer ${SUPABASE_ANON}`,'content-type':'application/json'},body:JSON.stringify({p_secret:secret,p_action:action,p_payload:payload})});const text=await r.text();if(!r.ok)throw new Error(text||`RPC ${r.status}`);return text?JSON.parse(text):null;}
async function derive(password,salt,iterations){const key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);return b64url(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:fromB64(salt),iterations},key,256));}
async function hashPassword(password){const salt=crypto.getRandomValues(new Uint8Array(16)),iterations=100000,key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations},key,256);return {password_salt:btoa(String.fromCharCode(...salt)),password_hash:btoa(String.fromCharCode(...new Uint8Array(bits))),password_iterations:iterations};}

export async function onRequestPost({request,env}){
  const secret=env.RAMZ_ENTERPRISE_SECRET;if(!secret)return json({error:'Enterprise secret is not configured.'},503);
  let body={};try{body=await request.json();}catch{return json({error:'Invalid JSON.'},400);}
  try{
    if(body.action==='login'){
      const user=await rpc(secret,'get_user',{username:String(body.username||'')});
      if(!user||user.status==='inactive')return json({error:'بيانات الدخول غير صحيحة أو الحساب موقوف.'},401);
      const derived=await derive(String(body.password||''),user.password_salt,Number(user.password_iterations||100000));
      const expected=b64url(fromB64(user.password_hash));if(derived!==expected)return json({error:'بيانات الدخول غير صحيحة أو الحساب موقوف.'},401);
      const payload=b64url(enc.encode(JSON.stringify({id:user.source_id,username:user.username,name:user.name,role:user.role,exp:Date.now()+12*60*60*1000})));const signed=payload+'.'+await hmac(secret,payload);
      return json({ok:true,user:{id:user.source_id,username:user.username,name:user.name,email:user.email,role:user.role,status:user.status}},200,{'set-cookie':`ramz_session=${encodeURIComponent(signed)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=43200`});
    }
    if(body.action==='logout')return json({ok:true},200,{'set-cookie':'ramz_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'});
    const s=await session(secret,request);if(!s)return json({error:'unauthorized'},401);
    const live=await rpc(secret,'get_user_by_id',{source_id:s.id});if(!live||live.status==='inactive')return json({error:'unauthorized'},401);
    if(body.action==='status')return json({ok:true,user:live});
    if(body.action==='load')return json(await rpc(secret,'load',{}));
    if(body.action==='upsert_record')return json(await rpc(secret,'upsert_record',{record:body.record||{}}));
    if(body.action==='delete_record')return json(await rpc(secret,'delete_record',{source_id:body.source_id||''}));
    if(body.action==='audit')return json(await rpc(secret,'audit',{record:body.record||{}}));
    if(body.action==='create_user'){
      if(s.role!=='admin')return json({error:'forbidden'},403);const password=String(body.user?.password||'');if(password.length<8)return json({error:'password too short'},400);
      const hashed=await hashPassword(password);const user={...body.user,source_id:body.user.source_id,...hashed};delete user.password;return json(await rpc(secret,'save_user',{user}));
    }
    if(body.action==='toggle_user'){if(s.role!=='admin')return json({error:'forbidden'},403);return json(await rpc(secret,'toggle_user',{source_id:body.source_id||''}));}
    return json({error:'unknown action'},400);
  }catch(error){return json({error:'Enterprise backend unavailable.',detail:String(error.message||error).slice(0,300)},503);}
}
