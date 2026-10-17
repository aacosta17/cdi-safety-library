import {respond,getUser,can,assertDb} from '../../src/workspace-security.js';
export async function onRequestGet({request,env}){
 try{
  assertDb(env);
  const user=await getUser(request,env);
  if(!(can(user,'production','view')||can(user,'manpower','view')||can(user,'safety','view')))return respond({error:'Workspace access required.'},403);
  const record=await env.DB.prepare("SELECT payload FROM workspace_documents WHERE doc_key='manpower'").first();
  if(!record)return respond({ok:true,employees:[],source:'unpublished'});
  const doc=JSON.parse(record.payload||'{}');
  const unique=new Map();
  for(const e of Array.isArray(doc.employees)?doc.employees:[]){
   if(!e||e.archived||e.isArchived||e.active===false)continue;
   const name=String(e.name||e.fullName||[e.firstName,e.lastName].filter(Boolean).join(' ')).trim().slice(0,120);
   if(!name)continue;
   const id=String(e.id||e.employeeNumber||'').slice(0,80);
   unique.set(id||name.toLowerCase(),{id,name,department:String(e.division||e.department||'').slice(0,60),classification:String(e.classification||e.role||'').slice(0,60)});
  }
  return respond({ok:true,employees:[...unique.values()].sort((a,b)=>a.name.localeCompare(b.name))});
 }catch(_){return respond({error:'Unable to load shared employee directory.'},503)}
}
