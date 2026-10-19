/* Full-screen Manpower Presenter — protected D1 entity-level collaboration.
 * In-memory Undo/Redo only. Does not store schedule snapshots.
 */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const copy=v=>v==null?null:JSON.parse(JSON.stringify(v));
const dateKey=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const dateObj=s=>new Date((s||dateKey(new Date()))+'T12:00:00');
const weekStart=d=>{const v=new Date(d);v.setHours(12,0,0,0);v.setDate(v.getDate()-(v.getDay()+6)%7);return v};
const short=s=>dateObj(s).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
const time=s=>s?new Date(s).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'';
const makeId=p=>p+'_'+(crypto?.randomUUID?.()||Date.now()+'_'+Math.random().toString(36).slice(2));
const app={user:null,canEdit:false,doc:null,revision:0,week:weekStart(new Date()),zoom:100,filter:'all',division:'all',presence:[],events:[],edits:{},editing:null,draft:null,original:null,saveBusy:false,fetchBusy:false,undo:[],redo:[],rosterDate:dateKey(new Date()),rosterSearch:'',lastOnline:0};
async function api(url,opts={}){
 const response=await fetch(url,{credentials:'same-origin',cache:'no-store',...opts,headers:{'Accept':'application/json',...(opts.body?{'Content-Type':'application/json','X-Field-Request':'1'}:{}),...opts.headers}});
 let data;try{data=await response.json()}catch(_){throw Error('The server returned an unreadable response. Try again.')}
 if(!response.ok) {const err=Error(data?.error||`Request failed (${response.status})`);err.status=response.status;err.details=data;throw err}
 return data;
}
const post=data=>api('/api/manpower-presenter',{method:'POST',body:JSON.stringify(data)});
function notify(message,error=false){const el=$('notice');el.textContent=message;el.className='notice'+(error?' error':'');el.classList.remove('hidden');if(!error){clearTimeout(notify.timer);notify.timer=setTimeout(()=>el.classList.add('hidden'),5200)}}
function setStatus(s,kind=''){const el=$('connection');el.textContent=s;el.style.color=kind==='err'?'#ffc0b7':kind==='ok'?'#c8f7d9':'#dfebf2'}
function userFor(id){return(app.doc?.employees||[]).find(e=>String(e.id)===String(id))}
function displayDivision(job){if(job.scope&&job.scope!=='auto')return job.scope;const types=new Set((job.assignments||[]).map(a=>userFor(a.employeeId)?.division).filter(Boolean));return types.size>1?'mixed':types.values().next().value||'unspecified'}
function availability(emp,date){if(!emp)return 'missing';const override=emp.exceptions?.[date];if(override)return override;const weekday=(dateObj(date).getDay()+6)%7;if((emp.schoolDays||[]).includes(weekday))return 'school';return emp.status||'available'}
function assignmentIssues(empId,date,jobId,withHours=null){const emp=userFor(empId),status=availability(emp,date),other=(app.doc?.jobs||[]).filter(j=>j.date===date&&j.id!==jobId).flatMap(j=>(j.assignments||[]).filter(a=>String(a.employeeId)===String(empId)).map(a=>({hours:Number(a.hours)||0,job:j})));
 const warnings=[];if(status!=='available')warnings.push(`${emp?.name||'Employee'}: ${status.toUpperCase()}`);
 const same=(app.doc?.jobs||[]).find(j=>j.id===jobId),own=withHours===null?(same?.assignments||[]).filter(a=>String(a.employeeId)===String(empId)).reduce((n,a)=>n+(Number(a.hours)||0),0):Number(withHours)||0;
 const total=other.reduce((n,a)=>n+a.hours,own);const permitsOT=[same,...other.map(x=>x.job)].some(j=>j?.dayType==='ot');
 if(total>8&&!permitsOT)warnings.push(`${emp?.name||'Employee'}: ${total}h scheduled across ${other.length+1} job(s)`);
 return warnings;}
function allIssues(jobs){const issues=new Set(),empMap=new Map();for(const j of jobs)for(const a of j.assignments||[]){const e=userFor(a.employeeId),key=a.employeeId+'|'+j.date;if(!empMap.has(key))empMap.set(key,[]);empMap.get(key).push({job:j,hours:Number(a.hours)||0});if(availability(e,j.date)!=='available')issues.add(key+'|unavailable');}
 for(const [key,items] of empMap){const sum=items.reduce((n,x)=>n+x.hours,0);if(sum>8&&!items.some(x=>x.job.dayType==='ot'))issues.add(key+'|hours');}return issues.size}
const weekDates=()=>Array.from({length:7},(_,i)=>{const d=new Date(app.week);d.setDate(d.getDate()+i);return dateKey(d)});
function visibleJobs(date){return(app.doc?.jobs||[]).filter(j=>j.date===date&&(app.filter==='all'||app.filter==='priority'&&j.priority==='high'||app.filter==='behind'&&j.status==='behind')&&(app.division==='all'||displayDivision(j)===app.division)).sort((a,b)=>(b.assignments||[]).length-(a.assignments||[]).length||String(a.name).localeCompare(String(b.name)))}
function renderMetrics(){const days=weekDates(),jobs=(app.doc?.jobs||[]).filter(j=>days.includes(j.date)),assigned=new Set(jobs.flatMap(j=>(j.assignments||[]).map(a=>a.employeeId))),hours=jobs.reduce((n,j)=>n+(j.assignments||[]).reduce((k,a)=>k+(Number(a.hours)||0),0),0),conflicts=allIssues(jobs);
 $('metrics').innerHTML=[[new Set(jobs.map(j=>j.number||j.name)).size,'Distinct jobs'],[jobs.length,'Scheduled job-days'],[assigned.size,'Employees assigned'],[hours.toFixed(hours%1?1:0),'Scheduled hours'],[conflicts,'Potential conflicts']].map(([v,k])=>`<div class="metric"><b>${esc(v)}</b><span>${esc(k)}</span></div>`).join('');}
function jobHTML(j){const p=app.edits?.[j.id],changed=p&&Date.now()-new Date(p.at).getTime()<60*60*1000;const issue=(j.assignments||[]).flatMap(a=>assignmentIssues(a.employeeId,j.date,j.id)).length;
 const crew=(j.assignments||[]).map(a=>{const emp=userFor(a.employeeId);return `<span class="person ${a.lead?'lead':''}" draggable="${app.canEdit}" data-drag-assignment="${esc(j.id)}|${esc(a.id||a.employeeId)}" title="${esc(emp?.name||'Unknown employee')} · ${Number(a.hours)||0} hours">${a.lead?'★ ':''}${esc(emp?.name||'Unknown')} · ${Number(a.hours)||0}h</span>`}).join('');
 return `<article class="job ${changed?'recent':''} ${issue?'problem':''}" data-job-id="${esc(j.id)}"><div class="job-head"><div><h3>${esc(j.name)}</h3><div class="meta">${esc(j.number||'No job number')} · ${esc(displayDivision(j))} · ${Number(j.percent)||0}%</div></div><button class="job-actions" data-edit-job="${esc(j.id)}">Edit</button></div>${j.priority==='high'?'<span class="pill warn">High priority</span>':''}${j.status==='behind'?'<span class="pill warn">Behind</span>':''}${j.dayType==='ot'?'<span class="pill">Overtime</span>':''}${issue?`<div class="problem-text">⚠ ${issue} scheduling warning(s)</div>`:''}<div class="staff">${crew||'<small>No crew assigned</small>'}</div>${j.notes?`<div class="meta">${esc(j.notes).slice(0,130)}</div>`:''}<div class="job-footer"><span>${p?`Edited by ${esc(p.by)} · ${time(p.at)}`:'No recent edit'}</span><strong>${(j.assignments||[]).length} staff</strong></div></article>`;}
function renderCalendar(){const today=dateKey(new Date());$('calendar').innerHTML=weekDates().map(date=>{const jobs=visibleJobs(date);return `<section class="day ${today===date?'today':''}" data-drop-date="${date}"><div class="day-header"><strong>${esc(short(date))}</strong><span class="subtle">${jobs.length} jobs · ${jobs.reduce((n,j)=>n+(j.assignments||[]).length,0)} placements</span></div><div class="day-body">${jobs.map(jobHTML).join('')}<button class="add" data-add-day="${date}">+ Add job</button></div></section>`}).join('');}
function renderRoster(){const date=app.rosterDate||dateKey(new Date());const people=(app.doc?.employees||[]).filter(e=>!e.archived&&!e.isArchived&&(e.status||'available')==='available'&&availability(e,date)==='available');const assigned=new Set((app.doc?.jobs||[]).filter(j=>j.date===date).flatMap(j=>(j.assignments||[]).map(a=>String(a.employeeId))));const free=people.filter(e=>!assigned.has(String(e.id))&&(e.name||'').toLowerCase().includes(app.rosterSearch.toLowerCase())).sort((a,b)=>String(a.name).localeCompare(String(b.name)));
 $('rosterCount').textContent=`${free.length} free`;$('roster').innerHTML=free.length?free.map(e=>`<div class="roster-item" draggable="${app.canEdit}" data-roster-id="${esc(e.id)}"><strong>${esc(e.name)}</strong><small>${esc(e.classificationDetail||e.classification||'Employee')} · ${esc(e.division||'Unassigned')}</small></div>`).join(''):'<div class="empty">No available employees match this date or search.</div>';
}
function renderNotes(){const selected=$('noteJob').value;const projectOptions=(app.doc?.jobs||[]).filter(j=>weekDates().includes(j.date));$('noteJob').innerHTML='<option value="">General meeting</option>'+projectOptions.map(j=>`<option value="${esc(j.id)}">${esc(j.name)} · ${esc(short(j.date))}</option>`).join('');if(projectOptions.some(j=>j.id===selected))$('noteJob').value=selected;const notes=(app.doc?.presenter?.notes||[]).filter(n=>weekDates().includes(n.date));$('notes').innerHTML=notes.length?notes.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(n=>`<div class="note ${n.done?'done':''}"><strong>${esc(short(n.date))}${n.jobId?' · '+esc((app.doc?.jobs||[]).find(j=>j.id===n.jobId)?.name||'Project'):''}</strong> · ${esc(n.text)}<div class="note-actions"><button data-note-toggle="${esc(n.id)}">${n.done?'Reopen':'Mark done'}</button><button data-note-delete="${esc(n.id)}">Delete</button></div></div>`).join(''):'<div class="empty">No meeting notes this week.</div>'}
function renderActivity(){const entries=app.events.slice(-9).reverse();$('activity').innerHTML=entries.length?entries.map(e=>`<div class="note"><b>${esc(e.by||'Team member')}</b><br>${esc(e.label||'Updated')} · ${esc(e.job||'Calendar')}<br><small>${time(e.at)}</small></div>`).join(''):'<div class="empty">No recent meeting edits.</div>'}
function renderPresence(){const n=app.presence.length;$('editors').textContent=n?`${n} editor${n===1?'':'s'} active · ${app.presence.map(p=>p.name).join(', ')}`:'No active editors detected';}
function render(){if(!app.doc)return;const end=weekDates()[6];$('weekRange').textContent=`${short(weekDates()[0])} – ${short(end)}`;$('viewNote').textContent=app.canEdit?'Click any job to edit. Changes save for everyone.':'View-only account · editing disabled.';$('addJob').disabled=!app.canEdit;$('addNote').disabled=!app.canEdit;document.documentElement.style.setProperty('--scale',app.zoom/100);renderMetrics();renderCalendar();renderRoster();renderNotes();renderActivity();renderPresence();updateUndo();}
function updateUndo(){$('undo').disabled=!app.canEdit||app.saveBusy||!app.undo.length;$('redo').disabled=!app.canEdit||app.saveBusy||!app.redo.length}
async function refresh({force=false}={}){if(app.fetchBusy||app.saveBusy)return;app.fetchBusy=true;try{const r=await api('/api/manpower-presenter'+(force?'':'?since='+encodeURIComponent(app.revision)));if(!r.same&&(force||r.revision!==app.revision)){app.doc=r.data;app.revision=r.revision;app.edits=r.edits||{};app.events=r.events||[];render();if(!force)setStatus(`Synced · ${r.updatedByName||'team member'}`,'ok')}app.presence=r.presence||[];renderPresence();app.lastOnline=Date.now();}catch(e){setStatus('Connection interrupted · retrying','err');if(force)notify(e.message,true)}finally{app.fetchBusy=false}}
async function heartbeat(){if(!app.canEdit)return;try{const r=await post({action:'heartbeat'});app.presence=r.presence||[];renderPresence()}catch(_){/* next heartbeat retry */}}
async function change(ops,{record=true,label='Updated schedule'}={}){
 if(!app.canEdit||app.saveBusy)return false;
 app.saveBusy=true;setStatus('Saving…');updateUndo();
 try{
  const r=await post({action:'change',ops:ops.map(op=>({...op,label:op.label||label}))});
  app.doc=r.data;app.revision=r.revision;app.edits=r.data?.presenter?.edits||{};app.events=r.data?.presenter?.events||[];
  if(record){app.undo.push({ops:copy(ops),label});app.undo=app.undo.slice(-35);app.redo=[]}
  render();setStatus(`Saved · ${app.user.displayName}`,'ok');return true;
 }catch(e){setStatus('Change not saved','err');notify(e.message,true);await refresh({force:true});return false;
 }finally{app.saveBusy=false;updateUndo()}}
async function undoOrRedo(which){const input=which==='undo'?app.undo:app.redo,output=which==='undo'?app.redo:app.undo;const record=input.at(-1);if(!record)return;const ops=record.ops.map(op=>({...op,before:which==='undo'?copy(op.after):copy(op.before),after:which==='undo'?copy(op.before):copy(op.after),label:(which==='undo'?'Undid: ':'Redid: ')+record.label}));
 const ok=await change(ops,{record:false,label:(which==='undo'?'Undo':'Redo')});if(ok){input.pop();output.push(record);updateUndo()}}
function allow(){if(app.canEdit)return true;notify('Your account has view-only Manpower access.',true);return false}
const blankJob=date=>({id:makeId('jpres'),name:'',number:'',date,scope:'auto',priority:'normal',status:'normal',percent:0,finish:'',dayType:'regular',otHours:0,location:'',notes:'',ptp:false,assignments:[]});
function openJob(id=null,date=null){if(!allow())return;const found=id?(app.doc?.jobs||[]).find(j=>j.id===id):null;if(id&&!found){notify('Job not found. Refresh the schedule.',true);return}
 app.editing=id||null;app.original=copy(found);app.draft=copy(found||blankJob(date||weekDates()[0]));const j=app.draft;
 $('jobTitle').textContent=found?'Edit job and crew':'Create job';$('jName').value=j.name||'';$('jNumber').value=j.number||'';$('jDate').value=j.date||dateKey(new Date());$('jScope').value=['auto','electrical','security'].includes(j.scope)?j.scope:'auto';$('jPriority').value=j.priority||'normal';$('jStatus').value=j.status||'normal';$('jPercent').value=Number(j.percent)||0;$('jDayType').value=j.dayType==='ot'?'ot':'regular';$('jOT').value=Number(j.otHours)||0;$('jLocation').value=j.location||'';$('jNotes').value=j.notes||'';
 $('editorError').classList.add('hidden');$('deleteJob').hidden=!found;renderAssignments();$('jobOverlay').classList.remove('hidden');$('jName').focus();}
function closeJob(){$('jobOverlay').classList.add('hidden');app.editing=null;app.original=null;app.draft=null}
function renderAssignments(){const job=app.draft;if(!job)return;const items=job.assignments||[];
 $('assignments').innerHTML=items.length?items.map((a,i)=>{const e=userFor(a.employeeId);return `<div class="assignment-row" data-assign-index="${i}"><span><strong>${esc(e?.name||'Unknown employee')}</strong><br><small>${esc(e?.classification||'')}</small></span><input type="number" min="0.5" max="24" step="0.5" value="${Number(a.hours)||8}" data-assign-hours="${i}" aria-label="Scheduled hours for ${esc(e?.name||'employee')}"><label><input type="checkbox" data-assign-lead="${i}" ${a.lead?'checked':''}> Lead</label><button class="remove" data-remove-assign="${i}" aria-label="Remove employee">✕</button></div>`}).join(''):'<div class="empty">No crew assigned. Choose an employee below.</div>';
 const emp=(app.doc?.employees||[]).filter(e=>!e.archived&&!e.isArchived&&!(items||[]).some(a=>String(a.employeeId)===String(e.id))).sort((a,b)=>String(a.name).localeCompare(String(b.name)));
 $('newEmployee').innerHTML='<option value="">Select an employee…</option>'+emp.map(e=>`<option value="${esc(e.id)}">${esc(e.name)} — ${esc(e.classification||'Employee')}</option>`).join('');renderEditorWarnings();}
function renderEditorWarnings(){const j=app.draft;if(!j)return;const out=[];for(const a of j.assignments||[]){out.push(...assignmentIssues(a.employeeId,$('jDate').value||j.date,j.id,Number(a.hours)||0))}const text=[...new Set(out)];$('availabilityWarning').textContent=text.length?'Potential conflicts: '+text.join('; '):'Employees may work on multiple jobs if their combined scheduled hours fit their availability.';}
function fillDraft(){const j=app.draft;if(!j)return;j.name=$('jName').value.trim();j.number=$('jNumber').value.trim();j.date=$('jDate').value;j.scope=$('jScope').value;j.priority=$('jPriority').value;j.status=$('jStatus').value;j.percent=Math.min(100,Math.max(0,Number($('jPercent').value)||0));j.dayType=$('jDayType').value;j.otHours=j.dayType==='ot'?Number($('jOT').value)||0:0;j.location=$('jLocation').value.trim();j.notes=$('jNotes').value.trim();}
async function saveJob(){if(!allow()||!app.draft)return;fillDraft();const j=app.draft;if(!j.name||!j.date){$('editorError').textContent='Enter a job name and scheduled date.';$('editorError').classList.remove('hidden');return}
 $('saveJob').disabled=true;const ok=await change([{kind:'job',id:j.id,before:app.original,after:copy(j),label:app.original?'Edited job / crew':'Created job'}],{label:app.original?'Edited job / crew':'Created job'});$('saveJob').disabled=false;if(ok)closeJob();else{$('editorError').textContent='This job may have been changed by another editor. Your draft remains open. Cancel and reopen the job to review the latest schedule.';$('editorError').classList.remove('hidden')}}
async function deleteJob(){if(!allow()||!app.original)return;if(!confirm(`Delete ${app.original.name} on ${short(app.original.date)}? Other editors will see this immediately.`))return;const j=app.original;const ok=await change([{kind:'job',id:j.id,before:j,after:null,label:'Deleted job'}],{label:'Deleted job'});if(ok)closeJob();}
async function addNote(){if(!allow())return;const text=$('noteText').value.trim();if(!text)return;const note={id:makeId('note'),date:app.rosterDate||weekDates()[0],jobId:$('noteJob').value||'',text,done:false};const ok=await change([{kind:'note',id:note.id,before:null,after:note,label:'Added meeting note'}],{label:'Added meeting note'});if(ok)$('noteText').value='';}
async function updateNote(id,remove=false){if(!allow())return;const n=(app.doc?.presenter?.notes||[]).find(x=>x.id===id);if(!n)return;const changed=remove?null:{...copy(n),done:!n.done};await change([{kind:'note',id,before:copy(n),after:changed,label:remove?'Deleted meeting note':'Updated action item'}],{label:remove?'Deleted meeting note':'Updated action item'});}
async function dragDrop(payload,jobId){if(!allow())return;const target=app.doc.jobs.find(j=>j.id===jobId);if(!target){notify('Choose a job to assign an employee.',true);return}const after=copy(target);const op=[];
 if(payload.type==='roster'){
  const emp=userFor(payload.id);if(!emp||after.assignments.some(a=>String(a.employeeId)===String(emp.id))){notify('Employee is already assigned to this job.',true);return}
  after.assignments.push({id:makeId('a_pres'),employeeId:emp.id,hours:8,lead:false,underLead:''});
 }else if(payload.type==='assignment'){
  if(payload.source===target.id)return;
  const source=app.doc.jobs.find(j=>j.id===payload.source),beforeSource=copy(source);
  if(!source)return;
  const sa=source.assignments.find(a=>String(a.id||a.employeeId)===String(payload.assignment));if(!sa)return;
  if(after.assignments.some(a=>a.employeeId===sa.employeeId)){notify('Employee is already assigned to the destination job.',true);return}
  const newSource=copy(source);newSource.assignments=newSource.assignments.filter(a=>String(a.id||a.employeeId)!==String(payload.assignment));
  op.push({kind:'job',id:source.id,before:beforeSource,after:newSource,label:'Moved employee from job'});after.assignments.push(copy(sa));
 }
 op.push({kind:'job',id:target.id,before:copy(target),after,label:'Changed crew assignment'});
 await change(op,{label:'Changed crew assignment'});
}
function printReport(){if(!app.doc)return;const dates=weekDates(),all=app.doc.jobs.filter(j=>dates.includes(j.date)),issueCount=allIssues(all);const notes=(app.doc.presenter?.notes||[]).filter(n=>dates.includes(n.date));
 $('printReport').innerHTML=`<h2>Manpower Meeting Summary · ${esc(short(dates[0]))} – ${esc(short(dates[6]))}</h2><p>Generated ${esc(new Date().toLocaleString())} · ${all.length} job entries · ${issueCount} scheduling warning(s)</p><table><thead><tr><th>Day</th><th>Project / Job</th><th>Assigned crew (hours)</th><th>Notes / status</th></tr></thead><tbody>${all.map(j=>`<tr><td>${esc(short(j.date))}</td><td>${esc(j.name)}${j.number?' · '+esc(j.number):''}</td><td>${(j.assignments||[]).map(a=>esc(userFor(a.employeeId)?.name||'Unknown')+' ('+(Number(a.hours)||0)+'h)').join('<br>')||'Unassigned'}</td><td>${esc(j.notes||'')}<br>${esc(j.status||'On track')}</td></tr>`).join('')}</tbody></table><h2>Meeting notes & action items</h2>${notes.map(n=>`<p>${n.done?'✓':'☐'} ${esc(short(n.date))}${n.jobId?' ('+esc((app.doc.jobs||[]).find(j=>j.id===n.jobId)?.name||'Project')+')':''}: ${esc(n.text)}</p>`).join('')||'<p>No notes recorded.</p>'}`;
 window.print();}
async function bootstrap(){try{
 const status=await api('/api/workspace-auth');const u=status.user;
 if(!u){$('gateMessage').textContent='Please sign in to Field Management Workspace first.';$('gateBack').hidden=false;return}
 if(!u.owner&&!['view','edit','approve','manage'].includes(u.permissions?.manpower)){$('gateMessage').textContent='Your account does not have Manpower access.';$('gateBack').hidden=false;return}
 app.user=u;app.canEdit=!!(u.owner||['edit','approve','manage'].includes(u.permissions?.manpower));
 const r=await api('/api/manpower-presenter');app.doc=r.data;app.revision=r.revision;app.edits=r.edits||{};app.events=r.events||[];app.presence=r.presence||[];
 $('authGate').hidden=true;$('app').hidden=false;$('rosterDate').value=app.rosterDate;
 setStatus('Shared · ready','ok');render();heartbeat();setInterval(()=>refresh(),3500);setInterval(()=>heartbeat(),15000);
 }catch(e){$('gateMessage').textContent=e.message;$('gateBack').hidden=false;}}
$('previous').onclick=()=>{app.week.setDate(app.week.getDate()-7);app.rosterDate=weekDates()[0];$('rosterDate').value=app.rosterDate;render()};
$('next').onclick=()=>{app.week.setDate(app.week.getDate()+7);app.rosterDate=weekDates()[0];$('rosterDate').value=app.rosterDate;render()};
$('current').onclick=()=>{app.week=weekStart(new Date());app.rosterDate=dateKey(new Date());$('rosterDate').value=app.rosterDate;render()};
$('divisionFilter').onchange=e=>{app.division=e.target.value;renderCalendar()};$('jobFilter').onchange=e=>{app.filter=e.target.value;renderCalendar()};
$('zoom').oninput=e=>{app.zoom=Number(e.target.value)||100;renderCalendar();document.documentElement.style.setProperty('--scale',app.zoom/100)};
$('rosterDate').onchange=e=>{app.rosterDate=e.target.value;renderRoster()};$('searchRoster').oninput=e=>{app.rosterSearch=e.target.value;renderRoster()};
$('addJob').onclick=()=>openJob(null,app.rosterDate||weekDates()[0]);$('addNote').onclick=addNote;
$('undo').onclick=()=>undoOrRedo('undo');$('redo').onclick=()=>undoOrRedo('redo');
$('report').onclick=printReport;
$('toggleSide').onclick=()=>{const area=document.querySelector('.workarea'),shown=area.classList.toggle('show-side');$('toggleSide').textContent=shown?'Hide workforce & notes':'Show workforce & notes';$('toggleSide').setAttribute('aria-pressed',String(shown));};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch(_){notify('Fullscreen is not available in this browser. Use your browser’s full-screen or presentation controls.',true)}};
$('closeJob').onclick=closeJob;$('cancelJob').onclick=closeJob;$('saveJob').onclick=saveJob;$('deleteJob').onclick=deleteJob;
$('addEmployee').onclick=()=>{const id=$('newEmployee').value,hrs=Number($('newHours').value)||8;if(!id||!app.draft)return;app.draft.assignments??=[];if(app.draft.assignments.some(a=>String(a.employeeId)===String(id)))return;app.draft.assignments.push({id:makeId('a_pres'),employeeId:id,hours:Math.max(.5,Math.min(24,hrs)),lead:false,underLead:''});renderAssignments()};
$('jDate').onchange=renderEditorWarnings;
$('assignments').addEventListener('change',e=>{if(!app.draft)return;const i=Number(e.target.dataset.assignHours??e.target.dataset.assignLead);if(!Number.isInteger(i)||i<0||!app.draft.assignments[i])return;if(e.target.matches('[data-assign-hours]'))app.draft.assignments[i].hours=Math.max(.5,Math.min(24,Number(e.target.value)||8));else if(e.target.matches('[data-assign-lead]'))app.draft.assignments[i].lead=e.target.checked;renderEditorWarnings()});
$('assignments').addEventListener('click',e=>{const b=e.target.closest('[data-remove-assign]');if(!b||!app.draft)return;app.draft.assignments.splice(Number(b.dataset.removeAssign),1);renderAssignments()});
$('calendar').addEventListener('click',e=>{const edit=e.target.closest('[data-edit-job]');if(edit)return openJob(edit.dataset.editJob);const add=e.target.closest('[data-add-day]');if(add)return openJob(null,add.dataset.addDay)});
$('notes').addEventListener('click',e=>{const toggle=e.target.closest('[data-note-toggle]'),del=e.target.closest('[data-note-delete]');if(toggle)updateNote(toggle.dataset.noteToggle);if(del)updateNote(del.dataset.noteDelete,true)});
$('calendar').addEventListener('dragstart',e=>{const a=e.target.closest('[data-drag-assignment]');if(!a||!app.canEdit)return;const [source,assignment]=a.dataset.dragAssignment.split('|');e.dataTransfer.setData('text/plain',JSON.stringify({type:'assignment',source,assignment}));e.dataTransfer.effectAllowed='move'});
$('roster').addEventListener('dragstart',e=>{const a=e.target.closest('[data-roster-id]');if(!a||!app.canEdit)return;e.dataTransfer.setData('text/plain',JSON.stringify({type:'roster',id:a.dataset.rosterId}));e.dataTransfer.effectAllowed='copy'});
$('calendar').addEventListener('dragover',e=>{if(e.target.closest('[data-job-id]')&&app.canEdit)e.preventDefault()});
$('calendar').addEventListener('drop',e=>{const target=e.target.closest('[data-job-id]');if(!target||!app.canEdit)return;e.preventDefault();try{const p=JSON.parse(e.dataTransfer.getData('text/plain'));if(['roster','assignment'].includes(p.type))dragDrop(p,target.dataset.jobId)}catch(_){notify('Could not read the employee being moved.',true)}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('jobOverlay').classList.contains('hidden'))closeJob();if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)){e.preventDefault();undoOrRedo(e.shiftKey?'redo':'undo')}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)){e.preventDefault();undoOrRedo('redo')}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){refresh();heartbeat()}});
bootstrap();
})();
