// Pure business rules, shared by the API and regression tests.
export class FeatureError extends Error { constructor(message,status=400){super(message);this.status=status;} }
export const fail=(condition,message,status=400)=>{if(!condition)throw new FeatureError(message,status)};
export const clean=(v,n=300)=>String(v??'').trim().slice(0,n);
export const date=v=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const d=new Date(v+'T12:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===v;};
export function weekDays(week){fail(date(week),'Choose a valid week.');const start=new Date(week+'T12:00:00Z');fail(start.getUTCDay()===1,'Week must begin on Monday.');return Array.from({length:5},(_,i)=>{const d=new Date(start);d.setUTCDate(d.getUTCDate()+i);return d.toISOString().slice(0,10)});}
export function eligibility(record){if(!record)return {status:'Awaiting approval',hours:0};const days=weekDays(record.week),approved=days.every(d=>record.days?.some(x=>x.date===d&&x.status==='present'&&x.approved&&x.hours>0)),hours=(record.days||[]).reduce((sum,d)=>sum+(d.approved&&d.status==='present'?Number(d.hours)||0:0),0);return {status:approved&&hours>=40?'Eligible':approved?'Below 40 hours':'Awaiting full-week approval',hours};}
export const initial=group=>({version:1,records:[],events:[],receipts:[],...(group==='people'?{owners:{},projects:{}}:group==='ppe'?{items:[],checkouts:[],requests:[]}:group==='fleet'?{vehicles:[],inspections:[],maintenance:[]}:group==='attendance'?{approvals:[]}:group==='alerts'?{alerts:[]}: {})});
export function centralDate(time) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date(time));
}

export function resolveReleases(people, now) {
  const today = centralDate(now);
  for (const [employeeId, owner] of Object.entries(people.owners)) {
    if (owner.pmId && owner.releaseOn && owner.releaseOn <= today) {
      people.owners[employeeId] = {
        pmId: null, availableFrom: owner.releaseOn, releasedBy: owner.scheduledBy
      };
    }
  }
  return people;
}

function approveRoster(doc, body, ctx) {
  const { user, can, employees, owners, now } = ctx;
  fail(can(user, 'manpower', 'approve') || can(user, 'production', 'approve'), 'PM permission required.', 403);
  fail(body.confirm === true, 'Confirm the selected attendance entries.');
  fail(Array.isArray(body.employeeIds) && body.employeeIds.length > 0, 'Select at least one employee.');
  const ids = [...new Set(body.employeeIds)];
  const roster = employees.filter(e => ids.includes(e.id) && !e.archived && !e.isArchived && owners[e.id]?.pmId === user.id);
  fail(roster.length === ids.length, 'The roster changed. Refresh and review your selection.', 409);
  const weekdays = weekDays(body.week);
  fail(Array.isArray(body.dates) && body.dates.length > 0 && body.dates.every(d => weekdays.includes(d) && d <= centralDate(now)), 'Select completed workdays in this week.');
  const hours = Number(body.hours);
  fail(['present', 'absent'].includes(body.status) && Number.isFinite(hours) && (body.status === 'present' ? hours > 0 && hours <= 24 : hours === 0), 'Check the attendance status and hours.');
  const updates = roster.map(employee => {
    const id = employee.id + '|' + body.week;
    const prior = doc.approvals.find(record => record.id === id);
    const days = weekdays.map(date => {
      const saved = prior?.days.find(day => day.date === date);
      if (!body.dates.includes(date)) return saved || {date, status:'pending', hours:0, approved:false};
      fail(!saved?.approved || body.replace === true, 'Some selected entries are already approved. Review them and enable replacement to continue.', 409);
      return {date, status:body.status, hours, approved:true, by:user.displayName, userId:user.id, at:now};
    });
    return {...prior, id, employeeId:employee.id, employeeName:employee.name, week:body.week, days, updatedAt:now, updatedBy:user.displayName};
  });
  const updatedIds = new Set(updates.map(record => record.id));
  doc.approvals = doc.approvals.filter(record => !updatedIds.has(record.id)).concat(updates);
}

export function applyFeature(group,doc,b,ctx){
 const {user,can,id,now,employees=[],managers=[],projects=[]}=ctx;const need=(module,level)=>fail(can(user,module,level),'This action requires '+module+' '+level+' permission.',403);const pm=()=>fail(user.owner||can(user,'manpower','approve')||can(user,'production','approve'),'PM approval permission required.',403);const employee=()=>{const e=employees.find(e=>String(e.id)===String(b.employeeId)&&!e.archived&&!e.isArchived);fail(e,'Select an active employee.');return e};
 const event=(text)=>{doc.events.unshift({id:id(),text,by:user.displayName,userId:user.id,at:now});doc.events=doc.events.slice(0,1000)};
 if(group==='people'){
  pm();
  resolveReleases(doc, now);
  if (b.action === 'scheduleRelease' || b.action === 'cancelRelease') {
    const person = employee();
    const current = doc.owners[person.id];
    fail(current?.pmId && (user.owner || current.pmId === user.id), 'Only the assigned PM or owner may change this release.', 403);
    if (b.action === 'scheduleRelease') {
      fail(date(b.releaseOn) && b.releaseOn > centralDate(now), 'Choose a future release date.');
      current.releaseOn = b.releaseOn;
      current.scheduledBy = user.displayName;
      event('Scheduled release of ' + person.name + ' for ' + b.releaseOn);
    } else {
      fail(current.releaseOn, 'There is no scheduled release to cancel.', 409);
      delete current.releaseOn;
      delete current.scheduledBy;
      event('Canceled scheduled release for ' + person.name);
    }
  } else
  if(b.action==='assign'||b.action==='claim'||b.action==='release'){
   const e=employee(),current=doc.owners[e.id];
   if(b.action==='release'){fail(user.owner||current?.pmId===user.id,'Only the assigned PM or owner can release this employee.',403);doc.owners[e.id]={pmId:null,releasedAt:now,releasedBy:user.displayName,note:clean(b.note),availableFrom:date(b.availableFrom||'')?b.availableFrom:null};event('Released '+e.name+' to the available pool');}
   else {const target=b.action==='claim'?user.id:clean(b.pmId,100);fail(managers.some(m=>m.id===target),'Select an active PM.');if(b.action==='assign')fail(user.owner,'Only the owner can set another PM’s roster.',403);else fail(!current?.pmId,'This employee already belongs to a PM. Refresh the pool.',409);doc.owners[e.id]={pmId:target,assignedAt:now,assignedBy:user.displayName};event('Assigned '+e.name+' to '+managers.find(m=>m.id===target).displayName);}
  }else if(b.action==='projectTeam'){fail(user.owner,'Only the owner can assign project dashboard access.',403);fail(projects.some(p=>p.id===b.projectId),'Select an existing production project.');fail(!b.pmId||managers.some(m=>m.id===b.pmId),'Select an active PM.');const leads=[...new Set(b.leadIds||[])];fail(leads.length<=30&&leads.every(id=>ctx.leads.some(u=>u.id===id)),'Select active job leads.');doc.projects[b.projectId]={pmId:b.pmId||null,leadIds:leads,updatedBy:user.displayName,updatedAt:now};event('Updated project dashboard assignments');}else throw new FeatureError('Unknown roster action.');
 }else if(group==='attendance' && b.action==='approveRoster'){
  approveRoster(doc,b,ctx);
  event('Approved roster attendance for '+b.employeeIds.length+' employees · '+b.week);
 }else if(group==='attendance'){
  fail(user.owner||can(user,'production','edit')||can(user,'manpower','approve'),'PM or job-lead permission required.',403);const e=employee(),days=weekDays(b.week);
  fail(Array.isArray(b.days)&&b.days.length===5,'Enter all five weekdays.');fail(new Set(b.days.map(d=>d.date)).size===5,'Dates must be unique.');
  const values=b.days.map(d=>{fail(days.includes(d.date)&&['present','absent','pending'].includes(d.status),'Invalid attendance day.');const hours=Number(d.hours);fail(Number.isFinite(hours)&&hours>=0&&hours<=24,'Daily hours must be between 0 and 24.');fail(d.status==='present'||hours===0,'Only days present can have approved hours.');return {date:d.date,status:d.status,hours,approved:b.action==='approve'&&d.status!=='pending',by:user.displayName,userId:user.id,at:now}});
  fail(['approve','revoke'].includes(b.action),'Unknown attendance action.');fail(b.action==='revoke'||b.confirm===true,'Confirm that you verified attendance and hours.');const key=e.id+'|'+b.week,record={id:key,employeeId:e.id,employeeName:e.name,week:b.week,days:values,note:clean(b.note,1200),updatedAt:now,updatedBy:user.displayName};doc.approvals=doc.approvals.filter(a=>a.id!==key);doc.approvals.push(record);event((b.action==='approve'?'Approved':'Revoked')+' attendance for '+e.name+' · '+b.week);
 }else if(group==='ppe'){
  if(b.action==='item'){need('ppe','approve');fail(clean(b.name),'Item name required.');const qty=Number(b.quantity),threshold=Number(b.threshold||0);fail(Number.isInteger(qty)&&qty>=0&&qty<=100000&&Number.isInteger(threshold)&&threshold>=0,'Enter valid whole quantities.');fail(!b.id,'Use stock adjustment for existing items.');doc.items.push({id:id(),name:clean(b.name,140),size:clean(b.size,80),standard:clean(b.standard,160),quantity:qty,threshold});event('Added PPE item '+clean(b.name));}
  else if(b.action==='stock'){need('ppe','approve');const item=doc.items.find(i=>i.id===b.itemId),delta=Number(b.quantity);fail(item&&Number.isInteger(delta)&&delta!==0&&item.quantity+delta>=0&&Math.abs(delta)<=100000&&clean(b.note),'Select an item, valid stock adjustment and reason.');item.quantity+=delta;event('Adjusted '+item.name+' stock by '+delta+' · '+clean(b.note));}
  else if(b.action==='request'){fail(can(user,'ppe','edit')||can(user,'production','edit'),'Request permission required.',403);fail(doc.items.some(i=>i.id===b.itemId),'Select PPE.');const qty=Number(b.quantity);fail(Number.isInteger(qty)&&qty>0&&qty<=1000,'Enter a valid quantity.');const e=employee();doc.requests.unshift({id:id(),itemId:b.itemId,employeeId:e.id,employeeName:e.name,quantity:qty,reason:clean(b.note,1000),status:'requested',by:user.displayName,userId:user.id,at:now});event('Requested PPE for '+e.name);}
  else if(b.action==='issue'||b.action==='fulfill'){need('ppe','approve');const request=b.action==='fulfill'?doc.requests.find(r=>r.id===b.requestId):null;fail(b.action!=='fulfill'||request?.status==='requested','Request already handled or missing.',409);const item=doc.items.find(i=>i.id===(request?.itemId||b.itemId)),qty=Number(request?.quantity||b.quantity),e=request?employees.find(e=>e.id===request.employeeId):employee();fail(e&&item&&Number.isInteger(qty)&&qty>0&&qty<=item.quantity,'Not enough stock or invalid employee/quantity.',409);item.quantity-=qty;doc.checkouts.unshift({id:id(),itemId:item.id,employeeId:e.id,employeeName:e.name,quantity:qty,remaining:qty,by:user.displayName,at:now});if(request)request.status='fulfilled';event('Issued '+qty+' '+item.name+' to '+e.name);}
  else if(b.action==='return'){need('ppe','approve');const checkout=doc.checkouts.find(c=>c.id===b.checkoutId),qty=Number(b.quantity);fail(checkout&&Number.isInteger(qty)&&qty>0&&qty<=checkout.remaining,'Enter a valid return quantity.');const item=doc.items.find(i=>i.id===checkout.itemId);fail(item,'PPE item unavailable.');checkout.remaining-=qty;item.quantity+=qty;event('Returned '+qty+' '+item.name+' from '+checkout.employeeName);}
  else if(b.action==='decline'){need('ppe','approve');const r=doc.requests.find(r=>r.id===b.requestId);fail(r?.status==='requested','Request already handled.',409);r.status='declined';r.reviewedBy=user.displayName;event('Declined PPE request');}else throw new FeatureError('Unknown PPE action.');
 }else if(group==='fleet'){
  if(b.action==='vehicle'){need('fleet','approve');fail(clean(b.name)&&clean(b.unit),'Unit number and vehicle name required.');fail(!doc.vehicles.some(v=>v.unit.toLowerCase()===clean(b.unit).toLowerCase()&&v.id!==b.id),'Unit number already exists.',409);const miles=Number(b.odometer||0),due=Number(b.serviceMiles||0);fail(Number.isFinite(miles)&&miles>=0&&Number.isFinite(due)&&due>=0,'Enter valid mileage.');fail(!b.serviceDate||date(b.serviceDate),'Enter a valid service date.');const existing=doc.vehicles.find(v=>v.id===b.id);fail(!b.id||existing,'Vehicle not found.');if(existing)fail(miles>=existing.odometer,'Mileage cannot decrease.');const value={id:existing?.id||id(),unit:clean(b.unit,60),name:clean(b.name,140),plate:clean(b.plate,30),driver:clean(b.driver,140),location:clean(b.location,240),odometer:miles,serviceMiles:due,serviceDate:b.serviceDate||'',status:['active','service','out_of_service'].includes(b.status)?b.status:'active'};if(existing)Object.assign(existing,value);else doc.vehicles.push(value);event('Updated vehicle '+value.unit);}
  else {need('fleet',b.action==='inspection'?'edit':'approve');const v=doc.vehicles.find(v=>v.id===b.vehicleId);fail(v,'Select a vehicle.');fail(date(b.date),'Choose a valid date.');const miles=Number(b.odometer);fail(Number.isFinite(miles)&&miles>=v.odometer,'Odometer cannot be less than the current reading.');v.odometer=miles;
   if(b.action==='inspection'){const checks=['tires','lights','brakes','fluids','belts','equipment'];fail(checks.every(k=>['pass','fail','na'].includes(b.checks?.[k])),'Complete every inspection item.');const failed=checks.some(k=>b.checks[k]==='fail');fail(!failed||clean(b.note),'Describe the defects found.');doc.inspections.unshift({id:id(),vehicleId:v.id,date:b.date,odometer:miles,checks:b.checks,result:failed?'fail':'pass',note:clean(b.note,1800),by:user.displayName,at:now});if(failed)v.status='out_of_service';event('Recorded inspection for '+v.unit+' · '+(failed?'defects found':'passed'));}
   else if(b.action==='maintenance'){fail(clean(b.work),'Describe completed maintenance.');const cost=Number(b.cost||0);fail(Number.isFinite(cost)&&cost>=0,'Enter valid cost.');doc.maintenance.unshift({id:id(),vehicleId:v.id,date:b.date,odometer:miles,work:clean(b.work,2000),cost,by:user.displayName,at:now});if(b.returnToService===true)v.status='active';event('Recorded maintenance for '+v.unit);}else throw new FeatureError('Unknown fleet action.');
  }
 }else if(group==='alerts'){
  need('safety','edit');fail(b.action==='draft','Unknown alert action.');fail(clean(b.title)&&clean(b.message),'Alert title and message required.');doc.alerts.unshift({id:id(),title:clean(b.title,160),message:clean(b.message,5000),category:['weather','emergency','general'].includes(b.category)?b.category:'general',area:clean(b.area,200),status:'draft',createdBy:user.displayName,userId:user.id,createdAt:now});event('Drafted safety alert '+clean(b.title));
 }else throw new FeatureError('Unknown module.');
 fail(JSON.stringify(doc).length<1800000,'This module has reached its storage limit. Contact the owner before adding more records.',413);
 return doc;
}
