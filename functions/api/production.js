import {respond,getUser,can,requireWriteRequest,parseJson,assertDb,newId} from '../../src/workspace-security.js';
const clean=(x,n=1500)=>String(x??'').trim().slice(0,n);
const nonnegative=x=>Number.isFinite(+x)&&+x>=0?+x:null;
const goodId=x=>typeof x==='string'&&x.length>0&&x.length<100;
const date=x=>/^\d{4}-\d{2}-\d{2}$/.test(x||'');
const fail=(error,status=400)=>respond({error},status);
const allowed=u=>can(u,'manpower','view')||can(u,'lookahead','view');
const editor=u=>can(u,'manpower','edit')||can(u,'lookahead','edit');
export async function onRequestGet({request,env}){
 try{assertDb(env);const u=await getUser(request,env);if(!allowed(u))return fail('Production access required',403);
 const jobs=(await env.DB.prepare('SELECT * FROM production_jobs ORDER BY created_at DESC').all()).results;
 const materials=(await env.DB.prepare('SELECT * FROM production_materials ORDER BY item').all()).results;
 const reports=(await env.DB.prepare('SELECT * FROM production_reports ORDER BY report_date DESC, created_at DESC LIMIT 350').all()).results.map(r=>({...r,attendance:JSON.parse(r.attendance_json),photos:JSON.parse(r.photos_json)}));
 const requests=(await env.DB.prepare('SELECT * FROM production_requests ORDER BY created_at DESC LIMIT 300').all()).results;
 const lookaheads=(await env.DB.prepare('SELECT * FROM production_lookaheads ORDER BY week_of DESC LIMIT 300').all()).results;
 const notes=can(u,'manpower','manage')?(await env.DB.prepare('SELECT * FROM production_private_notes ORDER BY created_at DESC LIMIT 200').all()).results:[];
 return respond({ok:true,jobs,materials,reports,requests,lookaheads,notes,canEdit:editor(u),canManage:can(u,'manpower','manage')});
 }catch(e){return fail(e.message,503)}
}
export async function onRequestPost({request,env}){
 const deny=requireWriteRequest(request);if(deny)return deny;
 try{assertDb(env);const u=await getUser(request,env);if(!editor(u))return fail('Edit permission required',403);
 const b=await parseJson(request,150000);const action=clean(b.action,40);const job=goodId(b.jobId)?await env.DB.prepare('SELECT id FROM production_jobs WHERE id=?').bind(b.jobId).first():null;
 if(action==='job'){
  if(!can(u,'manpower','manage'))return fail('Manager access required',403);
  const name=clean(b.name,150),budget=nonnegative(b.budgetHours);if(!name||budget===null)return fail('Job name and valid budget required');
  await env.DB.prepare('INSERT INTO production_jobs(id,name,code,manager,description,budget_hours,created_by) VALUES(?,?,?,?,?,?,?)').bind(newId(),name,clean(b.code,60),clean(b.manager,120),clean(b.description,2000),budget,u.email).run();
 }else if(action==='jobUpdate'){
  if(!can(u,'manpower','manage')||!job)return fail('Manager and existing job required',403);
  const budget=nonnegative(b.budgetHours),progress=nonnegative(b.progress);if(budget===null||progress===null||progress>100)return fail('Invalid budget or progress');
  await env.DB.prepare('UPDATE production_jobs SET budget_hours=?,progress=?,status=? WHERE id=?').bind(budget,progress,['active','paused','completed'].includes(b.status)?b.status:'active',b.jobId).run();
 }else if(action==='material'){
  if(!can(u,'manpower','manage')||!job)return fail('Manager and job required',403);
  const ordered=nonnegative(b.ordered),item=clean(b.item,150);if(!item||ordered===null)return fail('Item and ordered quantity required');
  await env.DB.prepare('INSERT INTO production_materials(id,job_id,item,unit,ordered) VALUES(?,?,?,?,?)').bind(newId(),b.jobId,item,clean(b.unit,20)||'ea',ordered).run();
 }else if(action==='movement'){
  if(!job||!goodId(b.materialId))return fail('Job and material required');
  const m=await env.DB.prepare('SELECT * FROM production_materials WHERE id=? AND job_id=?').bind(b.materialId,b.jobId).first();if(!m)return fail('Material not found');
  const qty=nonnegative(b.quantity),type=clean(b.type,20);if(!qty||!['received','used'].includes(type))return fail('Valid positive quantity required');
  if(type==='received'&&!can(u,'manpower','manage'))return fail('Only a manager may receive material',403);
  const column=type==='received'?'received':'consumed';
  const condition=type==='used'?' AND received-consumed>=?':'';
  const args=type==='used'?[qty,b.materialId,qty]:[qty,b.materialId];
  const update=env.DB.prepare(`UPDATE production_materials SET ${column}=${column}+?,updated_at=datetime('now') WHERE id=?${condition}`).bind(...args);
  // D1 batch provides transactional behavior for the update + movement log.
  const results=await env.DB.batch([update,env.DB.prepare('INSERT INTO production_material_movements(id,material_id,job_id,movement_type,quantity,reason,actor) SELECT ?,?,?,?,?,?,? WHERE changes()>0').bind(newId(),b.materialId,b.jobId,type,qty,clean(b.reason,300),u.email)]);
  if(!results[0]?.meta?.changes) return fail('Insufficient on-site inventory for usage',409);
 }else if(action==='report'){
  if(!job||!date(b.date)||!clean(b.work,3000))return fail('Job, date and work completed required');
  const attendance=Array.isArray(b.attendance)?b.attendance.slice(0,120).map(x=>({name:clean(x.name,120),hours:nonnegative(x.hours)})):[];
  if(attendance.some(x=>!x.name||x.hours===null||x.hours>24))return fail('Invalid attendance or hours');
  const photos=Array.isArray(b.photos)?b.photos.filter(x=>typeof x==='string'&&/^https:\/\//.test(x)).slice(0,12):[];
  if(JSON.stringify(photos).length>16000)return fail('Photo URLs too long');
  const reportId=newId();await env.DB.prepare('INSERT INTO production_reports(id,job_id,report_date,work_completed,blockers,attendance_json,photos_json,created_by) VALUES(?,?,?,?,?,?,?,?)').bind(reportId,b.jobId,b.date,clean(b.work,3000),clean(b.blockers,2000),JSON.stringify(attendance),JSON.stringify(photos),u.email).run();
  if(clean(b.employeeNote)&&can(u,'manpower','manage'))await env.DB.prepare('INSERT INTO production_private_notes(id,report_id,job_id,employee,category,observation,created_by) VALUES(?,?,?,?,?,?,?)').bind(newId(),reportId,b.jobId,clean(b.employee,120),clean(b.employeeCategory,50)||'production',clean(b.employeeNote,2000),u.email).run();
 }else if(action==='request'){
  if(!job||!clean(b.item,150)||!nonnegative(b.quantity))return fail('Job, item, and quantity required');
  await env.DB.prepare('INSERT INTO production_requests(id,job_id,item,quantity,unit,needed_by,reason,created_by) VALUES(?,?,?,?,?,?,?,?)').bind(newId(),b.jobId,clean(b.item,150),+b.quantity,clean(b.unit,20)||'ea',date(b.neededBy)?b.neededBy:'',clean(b.reason,1200),u.email).run();
 }else if(action==='requestStatus'){
  if(!can(u,'manpower','manage')||!job||!goodId(b.requestId)||!['requested','ordered','received','declined'].includes(b.status))return fail('Manager, job and valid status required',403);
  await env.DB.prepare('UPDATE production_requests SET status=? WHERE id=? AND job_id=?').bind(b.status,b.requestId,b.jobId).run();
 }else if(action==='lookahead'){
  if(!job||!date(b.weekOf)||!clean(b.tasks,3000))return fail('Job, week date and planned tasks required');
  await env.DB.prepare('INSERT INTO production_lookaheads(id,job_id,week_of,tasks,resources,crew,blockers,readiness,created_by) VALUES(?,?,?,?,?,?,?,?,?)').bind(newId(),b.jobId,b.weekOf,clean(b.tasks,3000),clean(b.resources,1800),clean(b.crew,1200),clean(b.blockers,1800),['ready','attention','blocked'].includes(b.readiness)?b.readiness:'attention',u.email).run();
 }else return fail('Unsupported action');
 return respond({ok:true});
 }catch(e){return fail(e.message,503)}
}
