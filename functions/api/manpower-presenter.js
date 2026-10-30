/* Field Management Workspace — Presenter Mode collaboration API.
 * Reuses existing D1 workspace_documents. No database migration or saved schedule versions.
 * The only schedule writes are entity-scoped changes protected by compare-and-swap.
 */
import {respond,getUser,can,requireWriteRequest,parseJson,assertDb} from '../../src/workspace-security.js';
const DOC='manpower', PRESENCE='manpower-presenter-presence';
const json=v=>JSON.stringify(v);
const same=(a,b)=>json(a??null)===json(b??null);
const safe=s=>String(s??'').trim().slice(0,150);
const clone=v=>v==null?null:JSON.parse(JSON.stringify(v));
const now=()=>new Date().toISOString();
const bad=(message,status=400,extra={})=>respond({ok:false,error:message,...extra},status);
async function getDoc(db,key){return db.prepare('SELECT payload,revision,updated_at,updated_by FROM workspace_documents WHERE doc_key=?').bind(key).first();}
async function displayName(db,email){if(!email)return '';const r=await db.prepare('SELECT display_name FROM workspace_users WHERE email=?').bind(email).first();return r?.display_name||String(email);}
async function getPresence(db){const r=await getDoc(db,PRESENCE);const all=r?JSON.parse(r.payload||'{}'):{};const stamp=Date.now();return Object.values(all).filter(p=>p&&p.at&&stamp-new Date(p.at).getTime()<45000).map(({id,name,at})=>({id,name,at})).slice(0,40);}
function validateEntity(kind,v){
 if(v===null)return true;
 if(!v||typeof v!=='object'||Array.isArray(v)||!safe(v.id))return false;
 if(kind==='job')return typeof v.name==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(String(v.date||''))&&Array.isArray(v.assignments)&&v.assignments.length<250&&v.assignments.every(a=>a&&typeof a.employeeId==='string'&&a.employeeId.length>0&&a.employeeId.length<160&&Number.isFinite(Number(a.hours))&&Number(a.hours)>=0&&Number(a.hours)<=24);
 if(kind==='note')return typeof v.text==='string'&&v.text.length<=1600&&typeof v.date==='string';
 if(kind==='employee')return typeof v.name==='string'&&v.name.trim().length>0&&v.name.length<=150&&(!v.schoolDays||Array.isArray(v.schoolDays))&&(!v.exceptions||typeof v.exceptions==='object')&&json(v).length<18000;
 return false;
}
function applyOps(doc,ops){
 const data=clone(doc),pres=data.presenter||{notes:[],edits:{},events:[]};
 pres.notes=Array.isArray(pres.notes)?pres.notes:[];pres.edits=pres.edits&&typeof pres.edits==='object'?pres.edits:{};
 pres.events=Array.isArray(pres.events)?pres.events:[];
 const changes=[];
 for(const op of ops){
  if(!op||!['job','note','employee'].includes(op.kind)||!safe(op.id)||safe(op.id).length>130||!validateEntity(op.kind,op.after)||!validateEntity(op.kind,op.before))return {error:'Invalid change data.'};
  if(op.after&&String(op.after.id)!==op.id||op.before&&String(op.before.id)!==op.id)return {error:'Invalid change identity.'};
  const array=op.kind==='job'?data.jobs:op.kind==='employee'?data.employees:pres.notes;
  const index=array.findIndex(x=>String(x.id)===op.id);
  const current=index<0?null:array[index];
  if(!same(current,op.before))return {conflict:true,kind:op.kind,id:op.id};
  if(same(current,op.after))continue;
  if(index>=0&&op.after===null)array.splice(index,1);
  else if(index>=0)array[index]=clone(op.after);
  else if(op.after!==null)array.push(clone(op.after));
  changes.push({kind:op.kind,id:op.id,label:safe(op.label)||'Updated',job:op.kind==='job'?(op.after?.name||op.before?.name||'Job'):op.kind==='employee'?(op.after?.name||op.before?.name||'Employee'):'Meeting note'});
 }
 data.presenter=pres;
 return {data,changes};
}
async function saveRequest(env,user,body){
 const create=body.action==='request',canManage=can(user,'manpower','edit');
 if(!create&&!canManage)return bad('Manpower edit permission is needed to review requests.',403);
 const types=['more_staff','schedule_change','employee_transfer'];
 const details=String(body.details||'').trim().slice(0,700);
 if(create&&(!types.includes(body.type)||!/^\d{4}-\d{2}-\d{2}$/.test(String(body.date||''))||details.trim().length<6))return bad('Select a valid request type and date, and explain the change needed.');
 if(!create&&(!safe(body.id)||!['open','approved','declined','resolved'].includes(body.status)))return bad('Invalid request update.');
 for(let attempt=0;attempt<6;attempt++){
  const r=await getDoc(env.DB,DOC);if(!r)return bad('Shared Manpower schedule must be published first.',409);
  const doc=JSON.parse(r.payload);doc.presenter??={};const requests=doc.presenter.requests=Array.isArray(doc.presenter.requests)?doc.presenter.requests:[];
  let record;
  if(create){
   const jobId=safe(body.jobId),employeeId=safe(body.employeeId),matchedJob=jobId?doc.jobs?.find(j=>String(j.id)===jobId):null;
   if(jobId&&!matchedJob)return bad('Select a job from the current schedule.');
   if(employeeId&&!doc.employees?.some(e=>String(e.id)===employeeId))return bad('Choose a valid employee.');
   if(requests.length>=500)return bad('The request dashboard is full. Resolve older requests before adding new ones.',409);
   record={id:'mpr_'+crypto.randomUUID(),type:body.type,date:body.date,jobId,employeeId,details:details.trim(),status:'open',by:user.displayName,byId:user.id,createdAt:now()};requests.push(record);
  }else{
   record=requests.find(req=>String(req.id)===String(body.id));if(!record)return bad('Request no longer exists.',404);
   record.status=body.status;record.handledBy=user.displayName;record.updatedAt=now();
  }
  doc.presenter.events=Array.isArray(doc.presenter.events)?doc.presenter.events:[];
  doc.presenter.events.push({kind:'request',id:record.id,label:create?'Requested manpower change':'Updated manpower request',job:doc.jobs?.find(j=>j.id===record.jobId)?.name||'General schedule',by:user.displayName,byId:user.id,at:now()});
  doc.presenter.events=doc.presenter.events.slice(-85);
  const payload=json(doc);if(payload.length>950000)return bad('Schedule is too large to save.',413);
  const saved=await env.DB.prepare("UPDATE workspace_documents SET payload=?,revision=revision+1,updated_by=?,updated_at=datetime('now') WHERE doc_key=? AND revision=?").bind(payload,user.email,DOC,r.revision).run();
  if(saved.meta?.changes)return respond({ok:true,request:record,revision:r.revision+1});
 }
 return bad('Another editor is updating the schedule. Please try again.',409,{retry:true});
}
export async function onRequestGet({request,env}){
 try{
  assertDb(env);const user=await getUser(request,env);
  if(!can(user,'manpower','view'))return bad('Manpower access required.',403);
  const r=await getDoc(env.DB,DOC);if(!r)return bad('The shared schedule has not been initialized. Ask the owner to publish the Manpower schedule first.',409);
  const search=new URL(request.url).searchParams;
  const presence=await getPresence(env.DB);
  if(search.has('since')&&Number(search.get('since'))===Number(r.revision))return respond({ok:true,same:true,revision:r.revision,presence});
  const data=JSON.parse(r.payload),p=data.presenter||{};
  return respond({ok:true,revision:r.revision,data,updatedAt:r.updated_at,updatedByName:await displayName(env.DB,r.updated_by),canEdit:can(user,'manpower','edit'),me:{id:user.id,name:user.displayName},presence,edits:p.edits||{},events:(p.events||[]).slice(-65)});
 }catch(e){return bad('Presenter could not load: '+String(e.message),503)}
}
export async function onRequestPost({request,env}){
 const denied=requireWriteRequest(request);if(denied)return denied;
 try{
  assertDb(env);const user=await getUser(request,env);
  const body=await parseJson(request,450000);
  if(body.action==='request'||body.action==='requestStatus'){
   if(!can(user,'manpower','view'))return bad('Manpower viewing permission required.',403);
   return saveRequest(env,user,body);
  }
  if(!can(user,'manpower','edit'))return bad('Manpower editing permission required.',403);
  if(body.action==='heartbeat'){
   for(let attempt=0;attempt<5;attempt++){
    const existing=await getDoc(env.DB,PRESENCE),ts=Date.now();
    const entries=existing?JSON.parse(existing.payload||'{}'):{};
    for(const [id,p] of Object.entries(entries))if(!p?.at||ts-new Date(p.at).getTime()>60000)delete entries[id];
    entries[user.id]={id:user.id,name:user.displayName,at:now()};
    let result;
    if(!existing)result=await env.DB.prepare('INSERT INTO workspace_documents(doc_key,payload,revision,updated_by) VALUES(?,?,1,?) ON CONFLICT(doc_key) DO NOTHING').bind(PRESENCE,json(entries),user.email).run();
    else result=await env.DB.prepare("UPDATE workspace_documents SET payload=?,revision=revision+1,updated_by=?,updated_at=datetime('now') WHERE doc_key=? AND revision=?").bind(json(entries),user.email,PRESENCE,existing.revision).run();
    if(result.meta?.changes)return respond({ok:true,presence:Object.values(entries).map(({id,name,at})=>({id,name,at}))});
   }
   return bad('Presence will retry on next heartbeat.',503);
  }
  if(body.action!=='change'||!Array.isArray(body.ops)||body.ops.length<1||body.ops.length>150)return bad('Invalid presenter operation.');
  const ops=body.ops;
  if(ops.some(op=>op.kind==='employee')&&!can(user,'manpower','manage'))return bad('Only manpower managers can edit employee records.',403);
  if(!can(user,'manpower','approve')&&ops.some(op=>op.kind==='job'&&json(op.before?.conflictWaivers||[])!==json(op.after?.conflictWaivers||[])))return bad('Only approvers can change conflict waivers.',403);
  for(let attempt=0;attempt<6;attempt++){
   const r=await getDoc(env.DB,DOC);
   if(!r)return bad('Shared schedule has not been published.',409);
   const original=JSON.parse(r.payload);
   if(!Array.isArray(original.jobs)||!Array.isArray(original.employees))return bad('Invalid existing schedule.',503);
   const result=applyOps(original,ops);
   if(result.error)return bad(result.error);
   if(result.conflict)return bad('This item changed on another device. Review the updated item before trying again.',409,{conflict:true,kind:result.kind,id:result.id,revision:r.revision});
   if(!result.changes.length)return respond({ok:true,revision:r.revision,data:original,noChange:true});
   const timestamp=now(),p=result.data.presenter;
   for(const event of result.changes){
    const entry={...event,by:user.displayName,byId:user.id,at:timestamp};
    p.events.push(entry);
    if(event.kind==='job')p.edits[event.id]={by:user.displayName,at:timestamp,label:event.label};
   }
   p.events=p.events.slice(-85);
   if(Object.keys(p.edits).length>550){const ordered=Object.entries(p.edits).sort((a,b)=>String(b[1]?.at).localeCompare(String(a[1]?.at)));p.edits=Object.fromEntries(ordered.slice(0,400))}
   const payload=json(result.data);
   if(payload.length>950000)return bad('Schedule is too large to save.',413);
   const saved=await env.DB.prepare("UPDATE workspace_documents SET payload=?,revision=revision+1,updated_by=?,updated_at=datetime('now') WHERE doc_key=? AND revision=?").bind(payload,user.email,DOC,r.revision).run();
   if(saved.meta?.changes)return respond({ok:true,revision:r.revision+1,data:result.data,changes:result.changes,updatedByName:user.displayName});
  }
  return bad('Other editors are saving. Retry in a moment.',409,{conflict:true,retry:true});
 }catch(e){return bad('Unable to save presenter change: '+String(e.message),503)}
}
