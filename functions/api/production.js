
import {respond,getUser,can,newId,assertDb,parseJson,requireWriteRequest} from '../../src/workspace-security.js';
const err=(message,status=400)=>respond({error:message},status);
const short=(v,max=300)=>String(v??'').trim().slice(0,max);
const number=(v)=>Number(v);
const positive=(v)=>Number.isFinite(Number(v))&&Number(v)>0&&Number(v)<=100000000;
const nonnegative=(v)=>Number.isFinite(Number(v))&&Number(v)>=0&&Number(v)<=100000000;
const dateOk=(v)=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||'')) && !Number.isNaN(Date.parse(v+'T12:00:00Z'));
const asArray=(a,max=200)=>Array.isArray(a)?a.slice(0,max):[];
const json=(s)=>{try{return JSON.parse(s||'[]')}catch{return []}};
const run=(env,sql,...args)=>env.DB.prepare(sql).bind(...args).run();
async function requiredJob(env,id){return env.DB.prepare('SELECT * FROM production_jobs WHERE id=?').bind(id).first();}
function errorStatus(e){const s=String(e?.message||e);if(/UNIQUE/i.test(s))return [409,'An entry already exists for this job, lead, and date, or that job number is already used.'];if(/CHECK|FOREIGN KEY|constraint/i.test(s))return [409,'Cannot save: please check quantities, dates, and remaining on-site inventory.'];return [500,'Unable to save this operation. Check the deployment logs.'];}
export async function onRequestGet({request,env}){
 try{
  assertDb(env);const u=await getUser(request,env);if(!can(u,'production','view'))return err('Production viewing permission required.',403);
  const q=new URL(request.url).searchParams,id=short(q.get('jobId'),80);
  const jobs=await env.DB.prepare(`SELECT j.*,COALESCE(h.hours,0) AS actual_hours,COALESCE(h.days,0) AS reported_days
   FROM production_jobs j LEFT JOIN (SELECT job_id, SUM(total_hours) hours,COUNT(DISTINCT report_date) days FROM production_reports GROUP BY job_id) h ON h.job_id=j.id ORDER BY CASE j.status WHEN 'active' THEN 0 WHEN 'on_hold' THEN 1 ELSE 2 END,j.updated_at DESC`).all();
  if(!id)return respond({ok:true,jobs:jobs.results||[],user:u});
  const job=jobs.results?.find(j=>j.id===id);if(!job)return err('Job not found.',404);
  const all=async(sql)=> (await env.DB.prepare(sql).bind(id).all()).results||[];
  const [materials,requests,reports,lookaheads,ledger]=await Promise.all([
   all('SELECT *, (received_qty-used_qty) AS on_site, (ordered_qty-received_qty) AS pending_delivery FROM production_materials WHERE job_id=? ORDER BY name COLLATE NOCASE'),
   all('SELECT * FROM production_requests WHERE job_id=? ORDER BY created_at DESC LIMIT 150'),
   all('SELECT * FROM production_reports WHERE job_id=? ORDER BY report_date DESC,submitted_at DESC LIMIT 250'),
   all('SELECT * FROM production_lookaheads WHERE job_id=? ORDER BY week_of DESC LIMIT 100'),
   all('SELECT l.*,m.name AS material_name,m.unit AS material_unit FROM production_material_ledger l JOIN production_materials m ON m.id=l.material_id WHERE l.job_id=? ORDER BY l.at DESC LIMIT 100')
  ]);
  const notes=can(u,'production','approve')?await all('SELECT * FROM production_personnel_notes WHERE job_id=? ORDER BY created_at DESC LIMIT 150'):[];
  return respond({ok:true,job,materials,requests,reports:reports.map(x=>({...x,attendance:json(x.attendance_json),materialsUsed:json(x.material_json),photos:json(x.photos_json)})),lookaheads:lookaheads.map(x=>({...x,activities:json(x.activities_json),photos:json(x.photos_json)})),ledger,personnelNotes:notes,user:u});
 }catch(e){return err(String(e?.message||e),503);}
}
export async function onRequestPost({request,env}){
 const denied=requireWriteRequest(request);if(denied)return denied;
 try{
  assertDb(env);const u=await getUser(request,env);
  if(!can(u,'production','edit'))return err('Production edit permission required.',403);
  const b=await parseJson(request,170000),action=short(b.action,50),jobId=short(b.jobId,80);
  if(action==='createJob'){
   if(!can(u,'production','manage'))return err('Management permission required to create jobs.',403);
   if(!short(b.title,160)||!short(b.code,50)||!nonnegative(b.budgetHours))return err('Job number, title, and valid budgeted hours required.');
   const id=newId();await run(env,`INSERT INTO production_jobs(id,code,title,location,project_manager,budget_hours,description,created_by) VALUES(?,?,?,?,?,?,?,?)`,id,short(b.code,50),short(b.title,160),short(b.location,250),short(b.projectManager,120),number(b.budgetHours),short(b.description,3000),u.email);return respond({ok:true,id});
  }
  if(!jobId||!(await requiredJob(env,jobId)))return err('Select a valid job.',404);
  if(action==='updateJob'){
   if(!can(u,'production','manage'))return err('Management permission required.',403);
   if(!nonnegative(b.budgetHours)||!nonnegative(b.progressPercent)||number(b.progressPercent)>100)return err('Hours and progress are invalid.');
   if(!['active','on_hold','complete'].includes(b.status))return err('Invalid status.');
   await run(env,`UPDATE production_jobs SET title=?,location=?,project_manager=?,budget_hours=?,progress_percent=?,status=?,description=?,updated_at=datetime('now') WHERE id=?`,short(b.title,160),short(b.location,250),short(b.projectManager,120),number(b.budgetHours),number(b.progressPercent),b.status,short(b.description,3000),jobId);return respond({ok:true});
  }
  if(action==='orderMaterial'){
   if(!can(u,'production','approve'))return err('Project manager permission required to record purchases.',403);
   if(!positive(b.qty))return err('Enter a positive quantity.');
   let materialId=short(b.materialId,80);
   if(materialId){const exists=await env.DB.prepare('SELECT id FROM production_materials WHERE id=? AND job_id=?').bind(materialId,jobId).first();if(!exists)return err('Material not found in this job.',404);
    await env.DB.batch([
     env.DB.prepare(`UPDATE production_materials SET ordered_qty=ordered_qty+?,updated_at=datetime('now') WHERE id=?`).bind(number(b.qty),materialId),
     env.DB.prepare(`INSERT INTO production_material_ledger(id,job_id,material_id,operation,qty,note,user_email) VALUES(?,?,?,'order',?,?,?)`).bind(newId(),jobId,materialId,number(b.qty),short(b.note,300),u.email)
    ]);
   }else{
    materialId=newId();if(!short(b.name,150)||!short(b.unit,30))return err('Material name and unit are required.');
    await env.DB.batch([
     env.DB.prepare(`INSERT INTO production_materials(id,job_id,name,unit,ordered_qty,reorder_threshold) VALUES(?,?,?,?,?,?)`).bind(materialId,jobId,short(b.name,150),short(b.unit,30),number(b.qty),nonnegative(b.threshold)?number(b.threshold):0),
     env.DB.prepare(`INSERT INTO production_material_ledger(id,job_id,material_id,operation,qty,note,user_email) VALUES(?,?,?,'order',?,?,?)`).bind(newId(),jobId,materialId,number(b.qty),short(b.note,300),u.email)
    ]);
   }
   return respond({ok:true,materialId});
  }
  if(action==='receiveMaterial'||action==='correctMaterial'){
   if(!can(u,'production','approve'))return err('Project manager permission required.',403);
   const materialId=short(b.materialId,80),m=await env.DB.prepare('SELECT * FROM production_materials WHERE id=? AND job_id=?').bind(materialId,jobId).first();if(!m)return err('Material not found.',404);
   if(action==='receiveMaterial'){
    if(!positive(b.qty))return err('Enter a positive received quantity.');
    await env.DB.batch([
      env.DB.prepare(`UPDATE production_materials SET received_qty=received_qty+?,updated_at=datetime('now') WHERE id=?`).bind(number(b.qty),materialId),
      env.DB.prepare(`INSERT INTO production_material_ledger(id,job_id,material_id,operation,qty,note,user_email) VALUES(?,?,?,'receive',?,?,?)`).bind(newId(),jobId,materialId,number(b.qty),short(b.note,300),u.email)
    ]);
   }else{
    const n=number(b.qty);if(!Number.isFinite(n)||n===0||Math.abs(n)>100000000||!short(b.note,300))return err('Enter a nonzero signed adjustment and a reason.');
    await env.DB.batch([
      env.DB.prepare(`UPDATE production_materials SET received_qty=received_qty+?,updated_at=datetime('now') WHERE id=?`).bind(n,materialId),
      env.DB.prepare(`INSERT INTO production_material_ledger(id,job_id,material_id,operation,qty,note,user_email) VALUES(?,?,?,'correction',?,?,?)`).bind(newId(),jobId,materialId,n,short(b.note,300),u.email)
    ]);
   }
   return respond({ok:true});
  }
  if(action==='materialRequest'){
   if(!short(b.item,150)||!short(b.unit,30)||!positive(b.qty))return err('Item, unit, and positive quantity required.');
   if(b.needBy&&!dateOk(b.needBy))return err('Invalid needed-by date.');
   await run(env,`INSERT INTO production_requests(id,job_id,item,unit,qty,need_by,reason,requested_by) VALUES(?,?,?,?,?,?,?,?)`,newId(),jobId,short(b.item,150),short(b.unit,30),number(b.qty),b.needBy||null,short(b.reason,1000),u.email);
   return respond({ok:true});
  }
  if(action==='requestStatus'){
   if(!can(u,'production','approve'))return err('Project manager permission required.',403);
   if(!['requested','ordered','received','declined'].includes(b.status))return err('Invalid request status.');
   const r=await run(env,`UPDATE production_requests SET status=?,updated_at=datetime('now') WHERE id=? AND job_id=?`,b.status,short(b.requestId,80),jobId);
   return r.meta?.changes?respond({ok:true}):err('Request not found.',404);
  }
  if(action==='dailyReport'){
   if(!dateOk(b.reportDate)||!short(b.completedWork,5000))return err('A valid report date and completed-work description are required.');
   const attend=asArray(b.attendance,100).map(a=>({name:short(a.name,100),hours:number(a.hours),status:['present','absent','pto','other'].includes(a.status)?a.status:'present'}));
   if(!attend.length||attend.some(a=>!a.name||!nonnegative(a.hours)||a.hours>24||((a.status!=='present')&&a.hours!==0)))return err('Add employees with valid actual hours; absent/PTO hours must be zero.');
   if(new Set(attend.map(a=>a.name.toLowerCase())).size!==attend.length)return err('Each employee should appear only once on a report.');
   const hours=Math.round(attend.reduce((a,x)=>a+x.hours,0)*100)/100;
   const uses=asArray(b.materialsUsed,100).filter(m=>number(m.qty)>0).map(m=>({id:short(m.id,80),qty:number(m.qty)}));
   if(uses.some(m=>!m.id||!positive(m.qty))||new Set(uses.map(m=>m.id)).size!==uses.length)return err('Material use entries must be unique and positive.');
   const mids=uses.map(m=>m.id);
   if(mids.length){const rows=(await env.DB.prepare(`SELECT id FROM production_materials WHERE job_id=?`).bind(jobId).all()).results||[];const allowed=new Set(rows.map(r=>r.id));if(mids.some(id=>!allowed.has(id)))return err('A selected material does not belong to this job.');}
   const notes=asArray(b.personnelNotes,30).map(n=>({employee:short(n.employee,100),category:short(n.category,40),observation:short(n.observation,1200)})).filter(n=>n.employee&&n.observation);
   const photos=asArray(b.photos,8).map(p=>short(p,280)).filter(p=>p.startsWith(`production/${jobId}/`));
   const reportId=newId(),statements=[env.DB.prepare(`INSERT INTO production_reports(id,job_id,report_date,lead_id,lead_name,attendance_json,total_hours,completed_work,blockers,material_json,photos_json,progress_percent) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).bind(reportId,jobId,b.reportDate,u.id,u.displayName,JSON.stringify(attend),hours,short(b.completedWork,5000),short(b.blockers,2500),JSON.stringify(uses),JSON.stringify(photos),nonnegative(b.progressPercent)&&number(b.progressPercent)<=100?number(b.progressPercent):null)];
   for(const m of uses){statements.push(env.DB.prepare(`UPDATE production_materials SET used_qty=used_qty+?,updated_at=datetime('now') WHERE id=? AND job_id=?`).bind(m.qty,m.id,jobId));statements.push(env.DB.prepare(`INSERT INTO production_material_ledger(id,job_id,material_id,operation,qty,note,report_id,user_email) VALUES(?,?,?,'consume',?,?,?,?)`).bind(newId(),jobId,m.id,m.qty,'Daily report '+b.reportDate,reportId,u.email));}
   for(const n of notes){statements.push(env.DB.prepare(`INSERT INTO production_personnel_notes(id,report_id,job_id,employee,category,observation,created_by) VALUES(?,?,?,?,?,?,?)`).bind(newId(),reportId,jobId,n.employee,n.category,n.observation,u.email));}
   if(nonnegative(b.progressPercent)&&number(b.progressPercent)<=100)statements.push(env.DB.prepare(`UPDATE production_jobs SET progress_percent=?,updated_at=datetime('now') WHERE id=?`).bind(number(b.progressPercent),jobId));
   await env.DB.batch(statements);return respond({ok:true,reportId,totalHours:hours});
  }
  if(action==='lookahead'){
   if(!dateOk(b.weekOf))return err('Valid start-of-week date required.');
   const tasks=asArray(b.activities,30).map(t=>({task:short(t.task,240),area:short(t.area,120),readiness:['ready','attention','blocked'].includes(t.readiness)?t.readiness:'attention'})).filter(t=>t.task);
   if(!tasks.length)return err('Add at least one upcoming task.');
   const photos=asArray(b.photos,8).map(p=>short(p,280)).filter(p=>p.startsWith(`production/${jobId}/`));
   await run(env,`INSERT INTO production_lookaheads(id,job_id,week_of,lead_id,lead_name,activities_json,material_needs,manpower_needs,equipment_needs,prerequisites,risks,pm_actions,photos_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(job_id,week_of,lead_id) DO UPDATE SET activities_json=excluded.activities_json,material_needs=excluded.material_needs,manpower_needs=excluded.manpower_needs,equipment_needs=excluded.equipment_needs,prerequisites=excluded.prerequisites,risks=excluded.risks,pm_actions=excluded.pm_actions,photos_json=excluded.photos_json,submitted_at=datetime('now')`,newId(),jobId,b.weekOf,u.id,u.displayName,JSON.stringify(tasks),short(b.materialNeeds,2000),short(b.manpowerNeeds,2000),short(b.equipmentNeeds,2000),short(b.prerequisites,2000),short(b.risks,2000),short(b.pmActions,2000),JSON.stringify(photos));return respond({ok:true});
  }
  return err('Unsupported production operation.');
 }catch(e){const [status,msg]=errorStatus(e);return err(msg,status);}
}
