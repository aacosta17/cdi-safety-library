const enc = new TextEncoder();
export const COOKIE = '__Host-fieldwork_session';
export const MODULES = ['manpower','safety','ppe','production','fleet','expenses'];
export const ACCESS = ['none','view','edit','approve','manage'];
export function respond(payload, status=200, headers={}) {
  return new Response(JSON.stringify(payload), {status, headers:{'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store',...headers}});
}
export function randomHex(bytes=32) {const a=new Uint8Array(bytes);crypto.getRandomValues(a);return [...a].map(n=>n.toString(16).padStart(2,'0')).join('');}
export async function digestHex(value) {let digest=await crypto.subtle.digest('SHA-256',enc.encode(value));return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');}
export function fixedCompare(a,b) {if(typeof a!=='string'||typeof b!=='string')return false;const length=Math.max(a.length,b.length);let diff=a.length^b.length;for(let i=0;i<length;i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return diff===0;}
export async function passwordHash(password,salt,iterations=100000) {
 const key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);
 const out=await crypto.subtle.deriveBits({name:'PBKDF2',salt:Uint8Array.from(salt.match(/.{2}/g).map(x=>parseInt(x,16))),iterations,hash:'SHA-256'},key,256);
 return [...new Uint8Array(out)].map(n=>n.toString(16).padStart(2,'0')).join('');
}
export function newId() {return crypto.randomUUID();}
export function getCookie(request){const h=request.headers.get('Cookie')||'';const m=h.match(/(?:^|;\s*)__Host-fieldwork_session=([a-f0-9]{64})(?:;|$)/);return m?.[1]||'';}
export function setSessionCookie(token, maxAge=43200){return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;}
export function clearSessionCookie(){return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;}
export function requireWriteRequest(request){
 if(!['POST','PUT','PATCH','DELETE'].includes(request.method))return null;
 if(request.headers.get('X-Field-Request')!=='1')return respond({error:'Invalid request header'},403);
 const source=request.headers.get('Origin');
 if(source && source!==new URL(request.url).origin)return respond({error:'Cross-site request not allowed'},403);
 return null;
}
export async function parseJson(request,max=1200000){if(Number(request.headers.get('content-length')||0)>max)throw new Error('Request too large');const raw=await request.text();if(raw.length>max)throw new Error('Request too large');return JSON.parse(raw||'{}');}
export function permissions(raw){try{const v=JSON.parse(raw||'{}');return Object.fromEntries(MODULES.map(k=>[k,ACCESS.includes(v[k])?v[k]:'none']));}catch(_){return Object.fromEntries(MODULES.map(k=>[k,'none']));}}
export function publicUser(u){return {id:u.id, email:u.email,displayName:u.display_name,employeeId:u.employee_id||'',owner:!!u.is_owner,active:!!u.is_active,permissions:u.is_owner?Object.fromEntries(MODULES.map(m=>[m,'manage'])):permissions(u.permissions)};}
export function can(user,module,minimum='view'){if(!user||!user.active)return false;if(user.owner)return true;const p=user.permissions[module]||'none';return ACCESS.indexOf(p)>=ACCESS.indexOf(minimum);}
export async function getUser(request, env) {
 const token=getCookie(request); if(!token)return null;
 const hash=await digestHex(token);
 const r=await env.DB.prepare(`SELECT u.* FROM workspace_sessions s JOIN workspace_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>datetime('now') AND u.is_active=1`).bind(hash).first();
 return r?publicUser(r):null;
}
export async function createSession(env,userId){const token=randomHex(32);const hash=await digestHex(token);await env.DB.prepare(`INSERT INTO workspace_sessions (token_hash,user_id,expires_at) VALUES (?, ?, datetime('now','+12 hours'))`).bind(hash,userId).run();return token;}
export async function requireOwner(request,env){const u=await getUser(request,env);return u?.owner?u:null;}
export function isEmail(s){return typeof s==='string'&&s.length<255&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);}
export function validatePassword(p){return typeof p==='string'&&p.length>=10&&p.length<=128;}
export function assertDb(env){if(!env.DB)throw new Error('Cloudflare D1 DB binding is missing. See SETUP.md.');}
