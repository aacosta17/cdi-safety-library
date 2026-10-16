import {respond,randomHex,passwordHash,newId,requireWriteRequest,parseJson,requireOwner,permissions,isEmail,validatePassword,assertDb,MODULES,ACCESS,publicUser} from '../../src/workspace-security.js';
function normalizePermissions(v){return Object.fromEntries(MODULES.map(k=>[k,ACCESS.includes(v?.[k])?v[k]:'none']));}
export async function onRequestGet({request,env}){
 try{assertDb(env);const owner=await requireOwner(request,env);if(!owner)return respond({error:'Owner permission required.'},403);
 const result=await env.DB.prepare('SELECT * FROM workspace_users ORDER BY is_owner DESC, display_name COLLATE NOCASE').all();return respond({ok:true,users:result.results.map(publicUser)});
 }catch(e){return respond({error:String(e.message)},503);}
}
export async function onRequestPost({request,env}){
 const deny=requireWriteRequest(request);if(deny)return deny;
 try{assertDb(env);const owner=await requireOwner(request,env);if(!owner)return respond({error:'Owner permission required.'},403);
  const b=await parseJson(request,30000);
  if(b.action==='create'){
    if(!isEmail(b.email)||!validatePassword(b.password)||!String(b.name||'').trim())return respond({error:'Name, valid work email and password of at least 10 characters are required.'},400);
    const salt=randomHex(24),hash=await passwordHash(b.password,salt),id=newId();
    const perms=normalizePermissions(b.permissions);
    try{await env.DB.prepare(`INSERT INTO workspace_users (id,email,display_name,employee_id,pw_salt,pw_hash,pw_iterations,permissions) VALUES (?,?,?,?,?,?,250000,?)`).bind(id,b.email.trim().toLowerCase(),String(b.name).trim().slice(0,120),String(b.employeeId||'').trim().slice(0,50),salt,hash,JSON.stringify(perms)).run();}
    catch(e){if(/UNIQUE|constraint/i.test(String(e)))return respond({error:'That email already has an account.'},409);throw e;}
    return respond({ok:true,id});
  }
  if(!['update','reset_password','disable','enable'].includes(b.action))return respond({error:'Unsupported account action.'},400);
  const target=await env.DB.prepare('SELECT * FROM workspace_users WHERE id=?').bind(String(b.id||'')).first();
  if(!target)return respond({error:'User not found.'},404);
  if(target.is_owner)return respond({error:'Owner privileges can only be changed through a separate owner recovery procedure.'},403);
  if(b.action==='update'){
    if(!isEmail(b.email)||!String(b.name||'').trim())return respond({error:'Name and valid email required.'},400);
    await env.DB.prepare(`UPDATE workspace_users SET email=?,display_name=?,employee_id=?,permissions=?,updated_at=datetime('now') WHERE id=?`).bind(b.email.trim().toLowerCase(),String(b.name).trim().slice(0,120),String(b.employeeId||'').trim().slice(0,50),JSON.stringify(normalizePermissions(b.permissions)),target.id).run();
  }else if(b.action==='reset_password'){
    if(!validatePassword(b.password))return respond({error:'New password must contain at least 10 characters.'},400);
    const salt=randomHex(24),hash=await passwordHash(b.password,salt);
    await env.DB.prepare(`UPDATE workspace_users SET pw_salt=?,pw_hash=?,pw_iterations=250000,updated_at=datetime('now') WHERE id=?`).bind(salt,hash,target.id).run();
    await env.DB.prepare('DELETE FROM workspace_sessions WHERE user_id=?').bind(target.id).run();
  }else{
    await env.DB.prepare(`UPDATE workspace_users SET is_active=?,updated_at=datetime('now') WHERE id=?`).bind(b.action==='enable'?1:0,target.id).run();
    if(b.action==='disable')await env.DB.prepare('DELETE FROM workspace_sessions WHERE user_id=?').bind(target.id).run();
  }
  return respond({ok:true});
 }catch(e){return respond({error:String(e.message||'Unexpected error')},400);}
}
