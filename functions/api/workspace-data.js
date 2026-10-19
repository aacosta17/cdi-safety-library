/* Shared Manpower document API. Keeps existing optimistic revision locking.
 * Adds display names + lightweight revision checks for faster meeting sync.
 */
import {respond,getUser,can,requireWriteRequest,parseJson,assertDb} from '../../src/workspace-security.js';
async function nameFor(env,email){if(!email)return null;const row=await env.DB.prepare('SELECT display_name FROM workspace_users WHERE email=?').bind(email).first();return row?.display_name||email;}
export async function onRequestGet({request,env}){
 try{assertDb(env);const u=await getUser(request,env);if(!can(u,'manpower','view'))return respond({error:'Manpower access required.'},403);
 const url=new URL(request.url),key=url.searchParams.get('key');if(key!=='manpower')return respond({error:'Unknown dataset'},400);
 const record=await env.DB.prepare('SELECT payload,revision,updated_at,updated_by FROM workspace_documents WHERE doc_key=?').bind(key).first();
 const revision=record?.revision||0;
 // Pollers can check revision without downloading the entire schedule each time.
 if(record&&url.searchParams.has('since')&&Number(url.searchParams.get('since'))===revision)return respond({ok:true,exists:true,revision,same:true});
 return respond({ok:true,exists:!!record,revision,data:record?JSON.parse(record.payload):null,updatedAt:record?.updated_at||null,updatedBy:record?.updated_by||null,updatedByName:await nameFor(env,record?.updated_by)});
 }catch(e){return respond({error:String(e.message)},503)}
}
export async function onRequestPost({request,env}){
 const deny=requireWriteRequest(request);if(deny)return deny;
 try{assertDb(env);const u=await getUser(request,env);if(!can(u,'manpower','edit'))return respond({error:'Manpower edit permission required.'},403);
 const b=await parseJson(request,1300000);
 if(b.key!=='manpower'||!b.data||typeof b.data!=='object'||!Array.isArray(b.data.jobs)||!Array.isArray(b.data.employees))return respond({error:'Invalid manpower payload'},400);
 const expected=Number(b.revision);
 if(!Number.isInteger(expected)||expected<0)return respond({error:'Missing document revision'},400);
 const body=JSON.stringify(b.data);
 if(body.length>950000)return respond({error:'Dataset exceeds current limit; ask owner to split the storage.'},413);
 if(expected===0){const r=await env.DB.prepare("INSERT INTO workspace_documents (doc_key,payload,revision,updated_by) VALUES ('manpower',?,1,?) ON CONFLICT(doc_key) DO NOTHING").bind(body,u.email).run();if(r.meta?.changes)return respond({ok:true,revision:1,updatedBy:u.email,updatedByName:u.displayName});}
 else{const r=await env.DB.prepare("UPDATE workspace_documents SET payload=?,revision=revision+1,updated_by=?,updated_at=datetime('now') WHERE doc_key='manpower' AND revision=?").bind(body,u.email,expected).run();if(r.meta?.changes)return respond({ok:true,revision:expected+1,updatedBy:u.email,updatedByName:u.displayName});}
 const latest=await env.DB.prepare("SELECT revision,updated_at,updated_by FROM workspace_documents WHERE doc_key='manpower'").first();return respond({error:'Another user saved changes first. Reload to review their update before saving yours.',conflict:true,revision:latest?.revision||0,updatedBy:latest?.updated_by||'',updatedByName:await nameFor(env,latest?.updated_by)},409);
 }catch(e){return respond({error:String(e.message)},503)}
}
