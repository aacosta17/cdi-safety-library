import {respond,randomHex,digestHex,fixedCompare,passwordHash,newId,getCookie,setSessionCookie,clearSessionCookie,requireWriteRequest,parseJson,getUser,createSession,publicUser,isEmail,validatePassword,assertDb} from '../../src/workspace-security.js';
export async function onRequestGet({request,env}) {
 try{assertDb(env);const count=await env.DB.prepare('SELECT count(*) AS total FROM workspace_users').first();const u=await getUser(request,env);return respond({ok:true,initialized:Number(count.total)>0,user:u});}
 catch(e){return respond({error:e.message},503);}
}
export async function onRequestPost({request,env}) {
 const deny=requireWriteRequest(request);if(deny)return deny;
 try{
  assertDb(env);const b=await parseJson(request,20000);
  if(b.action==='bootstrap'){
    if(!env.OWNER_BOOTSTRAP_KEY || String(env.OWNER_BOOTSTRAP_KEY).length<20)return respond({error:'Set a secret OWNER_BOOTSTRAP_KEY of at least 20 characters in Cloudflare.'},503);
    const count=await env.DB.prepare('SELECT count(*) AS total FROM workspace_users').first();
    if(Number(count.total)>0)return respond({error:'Owner setup was already completed.'},409);
    // Compare the provided secret without leaking it in error messages.
    if(!fixedCompare(String(b.setupKey||''),String(env.OWNER_BOOTSTRAP_KEY)))return respond({error:'Owner setup key is invalid.'},403);
    if(!isEmail(b.email)||!validatePassword(b.password))return respond({error:'Enter a valid email and a password of at least 10 characters.'},400);
    const salt=randomHex(24),id=newId(),hash=await passwordHash(b.password,salt);
    // A single conditional insert prevents duplicate owner bootstrap in normal race conditions.
    const result=await env.DB.prepare(`INSERT INTO workspace_users (id,email,display_name,pw_salt,pw_hash,pw_iterations,permissions,is_owner)
     SELECT ?,?,?,?,?,100000,'{}',1 WHERE NOT EXISTS (SELECT 1 FROM workspace_users)`).bind(id,b.email.trim().toLowerCase(),String(b.name||'Website owner').trim().slice(0,100),salt,hash).run();
    if(!result.meta?.changes)return respond({error:'Owner setup already completed.'},409);
    const token=await createSession(env,id);return respond({ok:true,user:await getUserFromId(env,id)},200,{'Set-Cookie':setSessionCookie(token)});
  }
  if(b.action==='login'){
    const email=String(b.email||'').trim().toLowerCase(),pw=b.password||'';
    if(!isEmail(email)||typeof pw!=='string')return respond({error:'Invalid email or password.'},401);
    const locked=await env.DB.prepare('SELECT locked_until FROM workspace_login_attempts WHERE email=?').bind(email).first();
    if(locked?.locked_until && locked.locked_until>new Date().toISOString().replace('T',' ').slice(0,19))return respond({error:'Too many attempts. Try again in 15 minutes or ask the owner to reset access.'},429);
    const row=await env.DB.prepare('SELECT * FROM workspace_users WHERE email=?').bind(email).first();
    let ok=false;if(row?.is_active && validatePassword(pw)){const hash=await passwordHash(pw,row.pw_salt,row.pw_iterations);ok=fixedCompare(hash,row.pw_hash);}
    if(!ok){
      await env.DB.prepare(`INSERT INTO workspace_login_attempts (email,failures,locked_until,updated_at) VALUES (?,1,NULL,datetime('now')) ON CONFLICT(email) DO UPDATE SET failures=failures+1,locked_until=CASE WHEN failures>=4 THEN datetime('now','+15 minutes') ELSE NULL END,updated_at=datetime('now')`).bind(email).run();
      return respond({error:'Invalid email or password.'},401);
    }
    await env.DB.prepare('DELETE FROM workspace_login_attempts WHERE email=?').bind(email).run();
    const token=await createSession(env,row.id);return respond({ok:true,user:publicUser(row)},200,{'Set-Cookie':setSessionCookie(token)});
  }
  if(b.action==='logout'){
    const token=getCookie(request);if(token)await env.DB.prepare('DELETE FROM workspace_sessions WHERE token_hash=?').bind(await digestHex(token)).run();
    return respond({ok:true},200,{'Set-Cookie':clearSessionCookie()});
  }
  return respond({error:'Unsupported action'},400);
 }catch(e){return respond({error:e instanceof SyntaxError?'Invalid JSON':String(e.message||'Unexpected error')},400);}
}
async function getUserFromId(env,id){return publicUser(await env.DB.prepare('SELECT * FROM workspace_users WHERE id=?').bind(id).first());}
