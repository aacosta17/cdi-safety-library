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
const app={user:null,canEdit:false,doc:null,revision:0,week:weekStart(new Date()),zoom:85,filter:'all',division:'all',presence:[],events:[],edits:{},editing:null,draft:null,original:null,saveBusy:false,fetchBusy:false,undo:[],redo:[],rosterDate:dateKey(new Date()),rosterSearch:'',lastOnline:0,bulk:false,selected:new Set(),copySource:null};
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
function divisionForEmployee(e){return e?.department||e?.division||'unassigned'}
function employeeUnion(e){return e?.unionStatus||((e?.classificationDetail||'').toLowerCase().includes('nonunion')?'nonunion':'union')}
function issueSignature(job,empId,jobSet=app.doc?.jobs||[]){
 const compared=jobSet.filter(j=>j.date===job.date&&j.id!==job.id&&(j.assignments||[]).some(a=>String(a.employeeId)===String(empId))).concat([job]);
 const parts=compared.map(j=>[String(j.id),(j.assignments||[]).filter(a=>String(a.employeeId)===String(empId)).reduce((n,a)=>n+(Number(a.hours)||0),0),j.dayType||'regular']).sort((a,b)=>a[0].localeCompare(b[0]));
 return JSON.stringify([job.date,availability(userFor(empId),job.date),parts]);
}
function waiverValid(j,employeeId){return(j.conflictWaivers||[]).some(w=>String(w.employeeId)===String(employeeId)&&w.date===j.date&&w.active!==false&&w.signature===issueSignature(j,employeeId));}
function assignmentIssues(empId,date,jobId,withHours=null,jobOverride=null,jobSet=app.doc?.jobs||[]){
 const emp=userFor(empId),status=availability(emp,date);
 const current=jobOverride||jobSet.find(j=>String(j.id)===String(jobId));
 const other=jobSet.filter(j=>j.date===date&&String(j.id)!==String(jobId)).flatMap(j=>(j.assignments||[]).filter(a=>String(a.employeeId)===String(empId)).map(a=>({hours:Number(a.hours)||0,job:j})));
 const warnings=[];if(status!=='available')warnings.push(`${emp?.name||'Employee'}: ${status.toUpperCase()} on ${date}`);
 const own=withHours===null?(current?.assignments||[]).filter(a=>String(a.employeeId)===String(empId)).reduce((n,a)=>n+(Number(a.hours)||0),0):Number(withHours)||0;
 const total=other.reduce((n,a)=>n+a.hours,own);
 if(total>8)warnings.push(`${emp?.name||'Employee'}: ${total}h scheduled across ${other.length+1} job(s) on ${date}`);
 return warnings;
}
function allIssues(jobs){const issues=new Set(),empMap=new Map();for(const j of jobs)for(const a of j.assignments||[]){const e=userFor(a.employeeId),key=a.employeeId+'|'+j.date;if(!empMap.has(key))empMap.set(key,[]);empMap.get(key).push({job:j,hours:Number(a.hours)||0});if(availability(e,j.date)!=='available')issues.add(key+'|unavailable');}
 for(const [key,items] of empMap){const sum=items.reduce((n,x)=>n+x.hours,0);if(sum>8)issues.add(key+'|hours');}return issues.size}
function groupedAssignments(job){
 const items=job.assignments||[],leads=items.filter(a=>a.lead),others=items.filter(a=>!a.lead);
 const piece=a=>{const e=userFor(a.employeeId),title=esc(e?.name||'Unknown employee');return `<span class="person ${a.lead?'lead':''}" draggable="${app.canEdit}" data-drag-assignment="${esc(job.id)}|${esc(a.id||a.employeeId)}" title="${title} · ${Number(a.hours)||0} hours">${a.lead?'★ ':''}${title} · ${Number(a.hours)||0}h</span>`};
 let html=leads.map(l=>`<div class="mp-lead-group">${piece(l)}${others.filter(a=>String(a.underLead||'')===String(l.employeeId)).map(a=>`<div class="mp-crew-member">${piece(a)}</div>`).join('')}</div>`).join('');
 const unpaired=others.filter(a=>!leads.some(l=>String(l.employeeId)===String(a.underLead||'')));
 html+=unpaired.map(piece).join('');return html;
}
const weekDates=()=>Array.from({length:7},(_,i)=>{const d=new Date(app.week);d.setDate(d.getDate()+i);return dateKey(d)});
function visibleJobs(date){return(app.doc?.jobs||[]).filter(j=>j.date===date&&(app.filter==='all'||app.filter==='priority'&&j.priority==='high'||app.filter==='behind'&&j.status==='behind')&&(app.division==='all'||displayDivision(j)===app.division)).sort((a,b)=>(b.assignments||[]).length-(a.assignments||[]).length||String(a.name).localeCompare(String(b.name)))}
function renderMetrics(){const days=weekDates(),jobs=(app.doc?.jobs||[]).filter(j=>days.includes(j.date)),assigned=new Set(jobs.flatMap(j=>(j.assignments||[]).map(a=>a.employeeId))),hours=jobs.reduce((n,j)=>n+(j.assignments||[]).reduce((k,a)=>k+(Number(a.hours)||0),0),0),conflicts=allIssues(jobs);
 $('metrics').innerHTML=[[new Set(jobs.map(j=>j.number||j.name)).size,'Distinct jobs'],[jobs.length,'Scheduled job-days'],[assigned.size,'Employees assigned'],[hours.toFixed(hours%1?1:0),'Scheduled hours'],[conflicts,'Potential conflicts']].map(([v,k])=>`<div class="metric"><b>${esc(v)}</b><span>${esc(k)}</span></div>`).join('');}
function jobHTML(j){const p=app.edits?.[j.id],changed=p&&Date.now()-new Date(p.at).getTime()<60*60*1000;const issue=(j.assignments||[]).flatMap(a=>assignmentIssues(a.employeeId,j.date,j.id)).length;const waived=(j.conflictWaivers||[]).filter(w=>w.active!==false).length;
 const crew=groupedAssignments(j);
 return `<article class="job ${changed?'recent':''} ${issue?'problem':''}" data-job-id="${esc(j.id)}"><div class="job-head"><input class="bulk-check" type="checkbox" data-bulk-id="${esc(j.id)}" ${app.selected.has(String(j.id))?'checked':''} aria-label="Select ${esc(j.name)} on ${esc(j.date)}"><div><h3>${esc(j.name)}</h3><div class="meta">${esc(j.number||'No job number')} · ${esc(displayDivision(j))} · ${Number(j.percent)||0}%</div></div><button class="job-actions" data-edit-job="${esc(j.id)}">Edit</button></div>${j.priority==='high'?'<span class="pill warn">High priority</span>':''}${j.status==='behind'?'<span class="pill warn">Behind</span>':''}${j.dayType==='ot'?'<span class="pill">Overtime</span>':''}${issue?`<div class="problem-text">⚠ ${issue} scheduling warning(s) · <button data-edit-job="${esc(j.id)}" type="button" class="mp-inline-waive">Review / waive</button></div>`:''}${waived?`<div class="meta">✓ ${waived} recorded waiver(s) (only valid for unchanged schedules)</div>`:''}<div class="staff">${crew||'<small>No crew assigned</small>'}</div>${j.notes?`<div class="meta">${esc(j.notes).slice(0,130)}</div>`:''}<div class="job-footer"><span>${p?`Edited by ${esc(p.by)} · ${time(p.at)}`:'No recent edit'}</span><strong>${(j.assignments||[]).length} staff</strong></div></article>`;}
function renderCalendar(){const today=dateKey(new Date());$('calendar').innerHTML=weekDates().map(date=>{const jobs=visibleJobs(date);return `<section class="day ${today===date?'today':''}" data-drop-date="${date}"><div class="day-header"><strong>${esc(short(date))}</strong><span class="subtle">${jobs.length} jobs · ${jobs.reduce((n,j)=>n+(j.assignments||[]).length,0)} placements</span></div><div class="day-body">${jobs.map(jobHTML).join('')}<button class="add" data-add-day="${date}">+ Add job</button></div></section>`}).join('');applyCalendarZoom();}
function applyCalendarZoom(){
 const calendar=$('calendar'),scroll=$('calendarScroll');
 if($('zoomValue'))$('zoomValue').textContent=app.zoom+'%';
 calendar.style.transform='none';calendar.style.width='';scroll.style.height='';
 document.documentElement.style.setProperty('--scale',String(app.zoom/100));
}
function renderRoster(){const date=app.rosterDate||dateKey(new Date());const people=(app.doc?.employees||[]).filter(e=>!e.archived&&!e.isArchived&&(e.status||'available')==='available'&&availability(e,date)==='available');const assigned=new Set((app.doc?.jobs||[]).filter(j=>j.date===date).flatMap(j=>(j.assignments||[]).map(a=>String(a.employeeId))));const free=people.filter(e=>!assigned.has(String(e.id))&&(e.name||'').toLowerCase().includes(app.rosterSearch.toLowerCase())).sort((a,b)=>String(a.name).localeCompare(String(b.name)));
 $('rosterCount').textContent=`${free.length} free`;$('roster').innerHTML=free.length?free.map(e=>`<div class="roster-item" draggable="${app.canEdit}" data-roster-id="${esc(e.id)}"><strong>${esc(e.name)}</strong><small>${esc(e.classificationDetail||e.classification||'Employee')} · ${esc(e.division||'Unassigned')}</small></div>`).join(''):'<div class="empty">No available employees match this date or search.</div>';
}
function renderNotes(){const selected=$('noteJob').value;const projectOptions=(app.doc?.jobs||[]).filter(j=>weekDates().includes(j.date));$('noteJob').innerHTML='<option value="">General meeting</option>'+projectOptions.map(j=>`<option value="${esc(j.id)}">${esc(j.name)} · ${esc(short(j.date))}</option>`).join('');if(projectOptions.some(j=>j.id===selected))$('noteJob').value=selected;const notes=(app.doc?.presenter?.notes||[]).filter(n=>weekDates().includes(n.date));$('notes').innerHTML=notes.length?notes.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(n=>`<div class="note ${n.done?'done':''}"><strong>${esc(short(n.date))}${n.jobId?' · '+esc((app.doc?.jobs||[]).find(j=>j.id===n.jobId)?.name||'Project'):''}</strong> · ${esc(n.text)}<div class="note-actions"><button data-note-toggle="${esc(n.id)}">${n.done?'Reopen':'Mark done'}</button><button data-note-delete="${esc(n.id)}">Delete</button></div></div>`).join(''):'<div class="empty">No meeting notes this week.</div>'}
function renderRequests(){
 const requests=Array.isArray(app.doc?.presenter?.requests)?app.doc.presenter.requests:[],open=requests.filter(r=>r.status==='open').length;
 $('requestCount').textContent=`${open} open · ${requests.length} total`;
 const jobSelect=$('requestJob'),chosenJob=jobSelect.value,jobOptions=(app.doc?.jobs||[]).filter(j=>weekDates().includes(j.date));
 jobSelect.innerHTML='<option value="">General request</option>'+jobOptions.map(j=>`<option value="${esc(j.id)}">${esc(j.name)} · ${esc(short(j.date))}</option>`).join('');
 if(jobOptions.some(j=>j.id===chosenJob))jobSelect.value=chosenJob;
 const employeeSelect=$('requestEmployee'),chosenEmployee=employeeSelect.value,people=(app.doc?.employees||[]).filter(e=>!e.archived&&!e.isArchived);
 employeeSelect.innerHTML='<option value="">No specific employee</option>'+people.map(e=>`<option value="${esc(e.id)}">${esc(e.name)}</option>`).join('');
 if(people.some(e=>String(e.id)===chosenEmployee))employeeSelect.value=chosenEmployee;
 const ordered=requests.slice().sort((a,b)=>(a.status==='open'?0:1)-(b.status==='open'?0:1)||String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,60);
 const types={more_staff:'Additional manpower',schedule_change:'Schedule change',employee_transfer:'Assigned employee request'};
 $('requests').innerHTML=ordered.length?ordered.map(r=>`<article class="request-row"><h3>${esc(types[r.type]||'Manpower request')} · ${esc(r.date)}</h3><p>${esc(r.details)}</p><small>${esc(r.by||'Manager')} · ${esc((app.doc.jobs||[]).find(j=>j.id===r.jobId)?.name||'General')} · ${esc(r.status||'open')}</small>${app.canEdit?`<label style="display:block;font-size:11px;margin-top:6px">Review status<select data-request-status="${esc(r.id)}">${['open','approved','declined','resolved'].map(s=>`<option value="${s}" ${s===r.status?'selected':''}>${s[0].toUpperCase()+s.slice(1)}</option>`).join('')}</select></label>`:''}</article>`).join(''):'<div class="empty">No manager requests yet. Submit the first request using the form.</div>';
 renderRequestEmployeeStatus();
}
function renderRequestEmployeeStatus(){
 const id=$('requestEmployee').value,date=$('requestDate').value,notice=$('requestEmployeeStatus');if(!notice)return;
 if(!id){notice.textContent='';return}
 const scheduled=(app.doc?.jobs||[]).filter(j=>j.date===date&&(j.assignments||[]).some(a=>String(a.employeeId)===id));
 notice.textContent=scheduled.length?'Currently assigned on '+date+': '+scheduled.map(j=>j.name).join(', ')+'. This request will not move them automatically.':'No existing job assignment found for that employee on the selected date.';
}
function renderActivity(){const entries=app.events.slice(-9).reverse();$('activity').innerHTML=entries.length?entries.map(e=>`<div class="note"><b>${esc(e.by||'Team member')}</b><br>${esc(e.label||'Updated')} · ${esc(e.job||'Calendar')}<br><small>${time(e.at)}</small></div>`).join(''):'<div class="empty">No recent meeting edits.</div>'}
function renderPresence(){const n=app.presence.length;$('editors').textContent=n?`${n} editor${n===1?'':'s'} active · ${app.presence.map(p=>p.name).join(', ')}`:'No active editors detected';}
function render(){if(!app.doc)return;const end=weekDates()[6];$('weekRange').textContent=`${short(weekDates()[0])} – ${short(end)}`;$('viewNote').textContent=app.canEdit?'Click any job to edit. Changes save for everyone.':'View-only account · editing disabled.';$('addJob').disabled=!app.canEdit;$('addNote').disabled=!app.canEdit;document.documentElement.style.setProperty('--scale',app.zoom/100);renderMetrics();renderCalendar();renderRoster();renderNotes();renderRequests();renderActivity();renderPresence();updateUndo();if(!$('workforceOverlay').classList.contains('hidden'))renderDirectory();}
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
 $('jobTitle').textContent=found?'Edit job and crew':'Create job';$('jName').value=j.name||'';$('jNumber').value=j.number||'';$('jDate').value=j.date||dateKey(new Date());$('jScope').value=['auto','electrical','security','data','fire_alarm','service'].includes(j.scope)?j.scope:'auto';$('jPriority').value=j.priority||'normal';$('jStatus').value=j.status||'normal';$('jPercent').value=Number(j.percent)||0;$('jDayType').value=j.dayType==='ot'?'ot':'regular';$('jOT').value=Number(j.otHours)||0;$('jLocation').value=j.location||'';$('jNotes').value=j.notes||'';$('jFinish').value=j.finish||'';$('jPTP').checked=!!j.ptp;$('jApplyWeek').checked=false;$('jApplyWeekLabel').hidden=!found;
 $('newEmployeeSearch').value='';$('editorError').classList.add('hidden');$('deleteJob').hidden=!found;$('copyJob').hidden=!found;$('waiveConflict').checked=false;$('waiverReason').value='';renderAssignments();$('jobOverlay').classList.remove('hidden');$('jName').focus();}
function closeJob(){$('jobOverlay').classList.add('hidden');app.editing=null;app.original=null;app.draft=null}
function renderAssignments(){const job=app.draft;if(!job)return;const items=job.assignments||[],leads=items.filter(a=>a.lead);
 $('assignments').innerHTML=items.length?items.map((a,i)=>{const e=userFor(a.employeeId);return `<div class="assignment-row" data-assign-index="${i}"><span><strong>${esc(e?.name||'Unknown employee')}</strong><br><small>${esc(e?.classificationDetail||e?.classification||'')}</small></span><input type="number" min="0.5" max="24" step="0.5" value="${Number(a.hours)||8}" data-assign-hours="${i}" aria-label="Scheduled hours for ${esc(e?.name||'employee')}"><label><input type="checkbox" data-assign-lead="${i}" ${a.lead?'checked':''}> Lead</label><select data-assign-under="${i}" aria-label="Lead for ${esc(e?.name||'employee')}" ${a.lead?'disabled':''}><option value="">No specific lead</option>${leads.filter(l=>String(l.employeeId)!==String(a.employeeId)).map(l=>`<option value="${esc(l.employeeId)}" ${String(a.underLead||'')===String(l.employeeId)?'selected':''}>${esc(userFor(l.employeeId)?.name||'Lead')}</option>`).join('')}</select><button class="remove" data-remove-assign="${i}" aria-label="Remove employee">✕</button></div>`}).join(''):'<div class="empty">No crew assigned. Search for an employee below.</div>';
 renderEmployeeOptions();renderEditorWarnings();}
function renderEmployeeOptions(){const q=($('newEmployeeSearch')?.value||'').trim().toLowerCase(),chosen=$('newEmployee')?.value||'';
 const items=app.draft?.assignments||[];
 const emp=(app.doc?.employees||[]).filter(e=>!e.archived&&!e.isArchived&&!items.some(a=>String(a.employeeId)===String(e.id))&&(e.name+' '+(e.employeeNumber||'')+' '+(e.classificationDetail||'')).toLowerCase().includes(q)).sort((a,b)=>String(a.name).localeCompare(String(b.name))).slice(0,75);
 $('newEmployee').innerHTML='<option value="">'+(emp.length?'Select an employee…':'No matching employees')+'</option>'+emp.map(e=>`<option value="${esc(e.id)}">${esc(e.name)}${e.employeeNumber?' · '+esc(e.employeeNumber):''} — ${esc(e.classificationDetail||e.classification||'Employee')}</option>`).join('');
 if(emp.some(e=>String(e.id)===chosen))$('newEmployee').value=chosen;
}
function renderEditorWarnings(){const j=app.draft;if(!j)return;const day=$('jDate').value||j.date,issues=[];
 for(const a of j.assignments||[])issues.push(...assignmentIssues(a.employeeId,day,j.id,Number(a.hours)||0,{...j,date:day}));
 const warnings=[...new Set(issues)];$('availabilityWarning').textContent=warnings.length?'Scheduling warnings (you can still save): '+warnings.join('; '):'No scheduling conflicts found. Employees may work on multiple projects when their total hours are planned.';
 $('waiverBox').hidden=!app.canApprove||(!warnings.length&&!(j.conflictWaivers||[]).length);
 const history=(j.conflictWaivers||[]).filter(w=>w.active!==false);$('waiverHistory').textContent=history.length?history.map(w=>'Approved '+time(w.at)+' by '+(w.by||'editor')+': '+w.reason).join(' | '):'';
}
function fillDraft(){const j=app.draft;if(!j)return;j.name=$('jName').value.trim();j.number=$('jNumber').value.trim();j.date=$('jDate').value;j.scope=$('jScope').value;j.priority=$('jPriority').value;j.status=$('jStatus').value;j.percent=Math.min(100,Math.max(0,Number($('jPercent').value)||0));j.dayType=$('jDayType').value;j.otHours=j.dayType==='ot'?Number($('jOT').value)||0:0;j.location=$('jLocation').value.trim();j.notes=$('jNotes').value.trim();j.finish=$('jFinish').value;j.ptp=$('jPTP').checked;}
async function saveJob(){if(!allow()||!app.draft)return;fillDraft();const j=app.draft;if(!j.name||!j.date){$('editorError').textContent='Enter a job name and scheduled date.';$('editorError').classList.remove('hidden');return}
 if($('waiveConflict').checked){if(!app.canApprove){$('editorError').textContent='Approver permission is required to waive a conflict.';$('editorError').classList.remove('hidden');return;}const reason=$('waiverReason').value.trim();if(!reason){$('editorError').textContent='Enter a reason for waiving the scheduling conflicts.';$('editorError').classList.remove('hidden');return;}const existing=j.conflictWaivers||[];const affected=(j.assignments||[]).filter(a=>assignmentIssues(a.employeeId,j.date,j.id,Number(a.hours)||0,j).length);j.conflictWaivers=[...existing,...affected.filter(a=>!waiverValid(j,a.employeeId)).map(a=>({employeeId:a.employeeId,date:j.date,reason,by:app.user?.displayName||'Editor',at:new Date().toISOString(),signature:issueSignature(j,a.employeeId),active:true}))];}
 const ops=[{kind:'job',id:j.id,before:app.original,after:copy(j),label:app.original?'Edited job / crew':'Created job'}];
 if(app.original&&$('jApplyWeek').checked){
   const days=new Set(weekDates()),old=app.original;
   const match=x=>String(x.name||'').trim().toLowerCase()===String(old.name||'').trim().toLowerCase()&&String(x.number||'').trim().toLowerCase()===String(old.number||'').trim().toLowerCase();
   for(const original of app.doc.jobs){
     if(original.id===old.id||!days.has(original.date)||!match(original))continue;
     const after=copy(original);
     for(const field of ['name','number','scope','priority','status','percent','finish','location','notes'])after[field]=copy(j[field]);
     ops.push({kind:'job',id:original.id,before:copy(original),after,label:'Updated weekly project details'});
   }
 }
 $('saveJob').disabled=true;const ok=await change(ops,{label:app.original?'Edited job / crew':'Created job'});$('saveJob').disabled=false;if(ok)closeJob();else{$('editorError').textContent='This job may have been changed by another editor. Your draft remains open. Cancel and reopen the job to review the latest schedule.';$('editorError').classList.remove('hidden')}}
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
  const moving=[sa,...(sa.lead?(source.assignments||[]).filter(a=>String(a.underLead||'')===String(sa.employeeId)):[])];
  if(moving.some(a=>after.assignments.some(t=>String(t.employeeId)===String(a.employeeId)))){notify('A crew member is already assigned to the destination job. Review the crew before moving.',true);return}
  const movedIds=new Set(moving.map(a=>String(a.id||a.employeeId)));
  const newSource=copy(source);newSource.assignments=newSource.assignments.filter(a=>!movedIds.has(String(a.id||a.employeeId)));
  op.push({kind:'job',id:source.id,before:beforeSource,after:newSource,label:'Moved crew from job'});
  after.assignments.push(...moving.map(copy));
 }
 op.push({kind:'job',id:target.id,before:copy(target),after,label:'Changed crew assignment'});
 await change(op,{label:'Changed crew assignment'});
}
function reportCrew(job){const all=job.assignments||[],leads=all.filter(a=>a.lead),standalone=all.filter(a=>!a.lead&&!leads.some(l=>String(l.employeeId)===String(a.underLead||'')));
 const line=(a,depth)=>{const e=userFor(a.employeeId),warnings=assignmentIssues(a.employeeId,job.date,job.id),ack=waiverValid(job,a.employeeId);return `<tr><td>${depth?'↳ ':''}${esc(e?.name||'Unknown employee')}${a.lead?' <b>(Lead)</b>':''}</td><td>${esc(e?.employeeNumber||'')}</td><td>${esc(e?.classificationDetail||e?.classification||'')}</td><td>${esc(divisionForEmployee(e))}</td><td>${(Number(a.hours)||0).toFixed(1)}</td><td>${job.dayType==='ot'?(Number(a.hours)||0).toFixed(1):'0'}</td><td>${warnings.length?`<span class="${ack?'report-ack':'report-warn'}">${ack?'Acknowledged — ':'Warning — '}${esc(warnings.join('; '))}</span>`:'—'}</td></tr>`};
 return leads.map(l=>line(l,0)+all.filter(a=>!a.lead&&String(a.underLead||'')===String(l.employeeId)).map(a=>line(a,1)).join('')).join('')+standalone.map(a=>line(a,0)).join('')||'<tr><td colspan="7">No employees assigned</td></tr>';
}
function reportData(){const days=weekDates(),jobs=(app.doc?.jobs||[]).filter(j=>days.includes(j.date)).sort((a,b)=>a.date.localeCompare(b.date)||String(a.name).localeCompare(String(b.name)));
 const employees=[...new Set(jobs.flatMap(j=>(j.assignments||[]).map(a=>a.employeeId)))];
 const hours=jobs.reduce((n,j)=>n+(j.assignments||[]).reduce((z,a)=>z+Number(a.hours||0),0),0);
 const ot=jobs.filter(j=>j.dayType==='ot').reduce((n,j)=>n+(j.assignments||[]).reduce((z,a)=>z+Number(a.hours||0),0),0);
 return {days,jobs,employees,hours,ot,issues:allIssues(jobs)};
}
function makeWorkReport(){const d=reportData(),notes=(app.doc?.presenter?.notes||[]).filter(n=>d.days.includes(n.date));
 let output=`<div class="report-brand"><small>FIELD MANAGEMENT WORKSPACE · OPERATIONS / LABOR PLANNING</small><h1>Weekly Manpower Work Report</h1><p class="subtle">${esc(short(d.days[0]))} – ${esc(short(d.days[6]))} · Generated ${esc(new Date().toLocaleString())}</p></div><div class="report-stats">${[[d.jobs.length,'Scheduled job-days'],[new Set(d.jobs.map(j=>j.number||j.name)).size,'Distinct jobs'],[d.employees.length,'Employees scheduled'],[d.hours.toFixed(1)+'h','Scheduled labor hours']].map(([v,t])=>`<div><b>${esc(v)}</b>${esc(t)}</div>`).join('')}</div><p><b>Overtime-job hours:</b> ${d.ot.toFixed(1)} h &nbsp; <b>Potential conflict groups:</b> ${d.issues}. Warnings acknowledged by a waiver remain in the count.</p>`;
 for(const date of d.days){const dayJobs=d.jobs.filter(j=>j.date===date),dayHours=dayJobs.reduce((n,j)=>n+(j.assignments||[]).reduce((z,a)=>z+Number(a.hours||0),0),0);
 output+=`<section class="report-day"><h2>${esc(short(date))} · ${dayJobs.length} job(s) · ${dayHours.toFixed(1)} hours</h2>`;
 for(const j of dayJobs){const tally=(j.assignments||[]).reduce((n,a)=>n+Number(a.hours||0),0),warnings=[...new Set((j.assignments||[]).flatMap(a=>assignmentIssues(a.employeeId,j.date,j.id)))];
 output+=`<h3>${esc(j.name)}${j.number?' · '+esc(j.number):''} — ${esc(displayDivision(j))}</h3><p class="subtle">Location: ${esc(j.location||'Not recorded')} · ${esc(j.priority||'Normal')} priority · ${esc(j.status||'On track')} · ${Number(j.percent)||0}% complete · ${esc(j.dayType||'regular')} day · ${tally.toFixed(1)} labor h · PTP: ${j.ptp?'submitted':'pending'}</p>`;
 if(j.notes)output+=`<p class="subtle"><b>Job notes:</b> ${esc(j.notes)}</p>`;
 if(warnings.length)output+=`<p class="report-warn"><b>Scheduling warnings:</b> ${warnings.map(esc).join('; ')}</p>`;
 if((j.conflictWaivers||[]).length)output+=`<p class="subtle"><b>Waiver history:</b> ${(j.conflictWaivers||[]).map(w=>`${esc(w.by||'Editor')} (${esc(time(w.at))}): ${esc(w.reason||'')} — ${waiverValid(j,w.employeeId)?'currently applicable':'historical / expired'}`).join('; ')}</p>`;
 output+=`<table><thead><tr><th>Employee / crew</th><th>Employee ID</th><th>Classification</th><th>Division</th><th>Hours</th><th>OT-job hours</th><th>Availability / conflict</th></tr></thead><tbody>${reportCrew(j)}</tbody></table>`;
 }output+='</section>'}
 output+=`<h2>Meeting notes and action items</h2>${notes.map(n=>`<p>${n.done?'☑':'☐'} ${esc(short(n.date))}${n.jobId?' · '+esc(d.jobs.find(j=>j.id===n.jobId)?.name||'Job'):''}: ${esc(n.text)}</p>`).join('')||'<p>No notes recorded this week.</p>'}`;
 if($('reportIncludeRoster')?.checked){output+='<h2>Employee directory (active)</h2><table><thead><tr><th>Name</th><th>Employee #</th><th>Classification</th><th>Division</th><th>Union</th><th>Availability</th><th>School days</th></tr></thead><tbody>'+(app.doc?.employees||[]).filter(e=>!e.archived&&!e.isArchived).sort((a,b)=>String(a.name).localeCompare(String(b.name))).map(e=>`<tr><td>${esc(e.name)}</td><td>${esc(e.employeeNumber||'')}</td><td>${esc(e.classificationDetail||e.classification||'')}</td><td>${esc(divisionForEmployee(e))}</td><td>${esc(employeeUnion(e))}</td><td>${esc(e.status||'available')}</td><td>${esc((e.schoolDays||[]).map(i=>['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i]).join(', '))}</td></tr>`).join('')+'</tbody></table>'}
 return output;
}
function printReport(){$('reportSheet').innerHTML=makeWorkReport();$('reportOverlay').classList.remove('hidden')}
function exportWorkCsv(){const d=reportData(),lines=[['Date','Project','Job number','Division','Employee','Employee number','Classification','Lead','Crew lead','Regular hours','OT hours','Conflicts','Waiver status']];
 for(const j of d.jobs)for(const a of j.assignments||[]){const e=userFor(a.employeeId),warnings=assignmentIssues(a.employeeId,j.date,j.id);lines.push([j.date,j.name,j.number||'',displayDivision(j),e?.name||'Unknown',e?.employeeNumber||'',e?.classificationDetail||e?.classification||'',a.lead?'Yes':'No',a.underLead?userFor(a.underLead)?.name||'':'',j.dayType==='ot'?0:Number(a.hours)||0,j.dayType==='ot'?Number(a.hours)||0:0,warnings.join('; '),waiverValid(j,a.employeeId)?'Acknowledged':warnings.length?'Outstanding':'None']);}
 const csv=lines.map(line=>line.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='Manpower-Work-Report-'+d.days[0]+'-to-'+d.days[6]+'.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function bootstrap(){try{
 const status=await api('/api/workspace-auth');const u=status.user;
 if(!u){$('gateMessage').textContent='Please sign in to Field Management Workspace first.';$('gateBack').hidden=false;return}
 if(!u.owner&&!['view','edit','approve','manage'].includes(u.permissions?.manpower)){$('gateMessage').textContent='Your account does not have Manpower access.';$('gateBack').hidden=false;return}
 app.user=u;app.canEdit=!!(u.owner||['edit','approve','manage'].includes(u.permissions?.manpower));app.canManageRoster=!!(u.owner||u.permissions?.manpower==='manage');app.canApprove=!!(u.owner||['approve','manage'].includes(u.permissions?.manpower));app.canManageRoster=!!(u.owner||u.permissions?.manpower==='manage');app.canApprove=!!(u.owner||['approve','manage'].includes(u.permissions?.manpower));
 const r=await api('/api/manpower-presenter');app.doc=r.data;app.revision=r.revision;app.edits=r.edits||{};app.events=r.events||[];app.presence=r.presence||[];
 $('authGate').hidden=true;$('app').hidden=false;$('rosterDate').value=app.rosterDate;$('requestDate').value=app.rosterDate;
 if(new URLSearchParams(location.search).get('requests')==='1'){$('requestContent').hidden=false;$('toggleRequests').setAttribute('aria-expanded','true');$('toggleRequests').textContent='Hide requests';}
 setStatus('Shared · ready','ok');render();heartbeat();setInterval(()=>refresh(),3500);setInterval(()=>heartbeat(),15000);
 }catch(e){$('gateMessage').textContent=e.message;$('gateBack').hidden=false;}}

function updateBulk(){document.body.classList.toggle('bulk-active',app.bulk);$('bulkToggle').textContent=app.bulk?'Selecting jobs':'Select jobs';$('bulkDelete').classList.toggle('hidden',!app.bulk);$('bulkCancel').classList.toggle('hidden',!app.bulk);$('bulkCount').textContent=app.selected.size;$('bulkScope').classList.toggle('hidden',!app.bulk);document.querySelectorAll('[data-bulk-id]').forEach(el=>el.checked=app.selected.has(String(el.dataset.bulkId)));}
async function deleteBulk(){if(!allow()||!app.selected.size)return;let chosen=(app.doc?.jobs||[]).filter(j=>app.selected.has(String(j.id)));
 if($('bulkScope').value==='week'){
  const days=new Set(weekDates()),keys=new Set(chosen.map(j=>String(j.name||'').trim().toLowerCase()+'|'+String(j.number||'').trim().toLowerCase()));
  chosen=(app.doc?.jobs||[]).filter(j=>days.has(j.date)&&keys.has(String(j.name||'').trim().toLowerCase()+'|'+String(j.number||'').trim().toLowerCase()));
 }
 if(!confirm('Delete '+chosen.length+' job-day(s), including assigned crews?\nThis can only be undone in this browser session.'))return;const ops=chosen.map(j=>({kind:'job',id:j.id,before:copy(j),after:null,label:'Bulk deleted job'}));if(await change(ops,{label:'Bulk deleted '+chosen.length+' jobs'})){app.selected.clear();app.bulk=false;updateBulk()}}
function openCopy(){if(!app.draft||!app.original)return;fillDraft();app.copySource=copy(app.draft);$('copyDates').innerHTML=weekDates().filter(d=>d!==app.copySource.date).map(d=>'<label><input type="checkbox" data-copy-date="'+esc(d)+'"> '+esc(short(d))+'</label>').join('');$('copyPreview').classList.add('hidden');$('copyOverlay').classList.remove('hidden')}
function closeCopy(){$('copyOverlay').classList.add('hidden');app.copySource=null}
async function confirmCopy(){if(!allow()||!app.copySource)return;
 const dates=[...document.querySelectorAll('[data-copy-date]:checked')].map(e=>e.dataset.copyDate);
 if(!dates.length)return notify('Select at least one date.',true);
 const source=app.copySource,ops=[],warnings=[];
 for(const date of dates){
  const existing=(app.doc?.jobs||[]).find(j=>j.date===date&&String(j.name).trim().toLowerCase()===String(source.name).trim().toLowerCase()&&String(j.number||'')===String(source.number||''));
  const target=existing?{...copy(existing),...copy(source),id:existing.id,date,assignments:copy(existing.assignments||[]),conflictWaivers:copy(existing.conflictWaivers||[])}:{...copy(source),id:makeId('jpres'),date,assignments:[]};
  // Preserve existing extra employees on that day, while updating EVERY copied crew member.
  for(const a of source.assignments||[]){
   const old=(target.assignments||[]).find(x=>String(x.employeeId)===String(a.employeeId));
   if(old){Object.assign(old,{hours:Number(a.hours)||8,lead:!!a.lead,underLead:a.underLead||''});}
   else{target.assignments.push({...copy(a),id:makeId('apres')})}
  }
  // Old approvals must never authorize a changed schedule.
  target.conflictWaivers=(target.conflictWaivers||[]).map(w=>({...w,active:false}));
  const jobHours=new Set(target.assignments.map(a=>String(a.employeeId)));
  for(const employeeId of jobHours){
   const a=target.assignments.find(a=>String(a.employeeId)===employeeId);
   const issues=assignmentIssues(employeeId,date,target.id,Number(a.hours)||0,target);
   if(issues.length)warnings.push(short(date)+': '+issues.join('; '));
  }
  ops.push({kind:'job',id:target.id,before:existing?copy(existing):null,after:target,label:'Copied entire job crew'});
 }
 if(warnings.length&&!confirm('All employees will still be copied. Please review these scheduling warnings:\n\n'+[...new Set(warnings)].slice(0,12).join('\n')+(warnings.length>12?'\n… and more':'')+'\n\nContinue and keep these conflicts flagged?'))return;
 $('copyConfirm').disabled=true;
 const ok=await change(ops,{label:'Copied full crew and hours to '+dates.length+' days'});
 $('copyConfirm').disabled=false;
 if(ok){closeCopy();closeJob();notify('Crew copied to every selected day. Scheduling conflicts remain visible.');}
}

// Employee directory lives in the SAME calendar application / document — no second planner iframe.
let employeeDraft=null,employeeOriginal=null;
function openWorkforceTools(){
 $('workforceOverlay').classList.remove('hidden');$('directoryNew').disabled=!app.canManageRoster;
 $('employeeEditPane').hidden=true;employeeDraft=null;employeeOriginal=null;renderDirectory();
}
function closeWorkforceTools(){$('workforceOverlay').classList.add('hidden');employeeDraft=null;employeeOriginal=null}
function renderDirectory(){
 const q=($('directorySearch').value||'').trim().toLowerCase(),dept=$('directoryDept').value,union=$('directoryUnion').value;
 const arr=(app.doc?.employees||[]).filter(e=>{
  const archived=!!(e.archived||e.isArchived);
  if(union==='archived'?!archived:archived)return false;
  if(union==='union'||union==='nonunion')if(employeeUnion(e)!==union)return false;
  if(dept!=='all'&&divisionForEmployee(e)!==dept)return false;
  return (e.name+' '+(e.employeeNumber||'')+' '+(e.classificationDetail||'')).toLowerCase().includes(q);
 }).sort((a,b)=>String(a.name).localeCompare(String(b.name)));
 $('directoryCount').textContent=arr.length+' matching employees';
 $('directoryResults').innerHTML=arr.map(e=>`<button type="button" data-edit-employee="${esc(e.id)}" class="${employeeDraft?.id===e.id?'active':''}"><b>${esc(e.name)}</b><small>${esc(e.employeeNumber||'No employee ID')} · ${esc(e.classificationDetail||e.classification||'')} · ${esc(divisionForEmployee(e))} · ${esc(employeeUnion(e))}</small></button>`).join('')||'<div class="empty">No matching employees.</div>';
}
function renderEmployeeExceptions(){if(!employeeDraft)return;
 $('eSchoolDays').innerHTML=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((day,i)=>`<label><input type="checkbox" data-school-day="${i}" ${(employeeDraft.schoolDays||[]).includes(i)?'checked':''}> ${day}</label>`).join('');
 $('eExceptionsList').innerHTML=Object.entries(employeeDraft.exceptions||{}).sort((a,b)=>a[0].localeCompare(b[0])).map(([date,status])=>`<span class="mp-exception-chip">${esc(date)}: ${esc(status)} <button type="button" data-clear-exception="${esc(date)}" aria-label="Remove exception">×</button></span>`).join('')||'<p class="help">No date-specific exceptions recorded.</p>';
}
function openEmployee(id=null){if(!app.canManageRoster)return notify('Only Manpower managers can edit employee records.',true);
 const e=id?(app.doc?.employees||[]).find(e=>String(e.id)===String(id)):null;
 employeeOriginal=copy(e);employeeDraft=copy(e||{id:makeId('emp'),name:'',employeeNumber:'',division:'unassigned',department:'unassigned',classification:'Other',classificationDetail:'Other',role:'Other',unionStatus:'union',status:'available',schoolDays:[],exceptions:{},archived:false});
 $('employeeEditPane').hidden=false;$('employeeEditTitle').textContent=e?'Edit employee · '+e.name:'Add new employee';
 $('eName').value=employeeDraft.name||'';$('eNumber').value=employeeDraft.employeeNumber||'';
 $('eDepartment').value=divisionForEmployee(employeeDraft);$('eRole').value=employeeDraft.role||employeeDraft.classificationDetail||employeeDraft.classification||'';
 $('eUnion').value=employeeUnion(employeeDraft);$('eStatus').value=['available','unavailable','absent','training','pto','school'].includes(employeeDraft.status)?employeeDraft.status:'available';
 $('eEvaluation').value=['elite','good','needs_work','critical','unrated'].includes(employeeDraft.evaluation)?employeeDraft.evaluation:'unrated';
 $('eArchived').value=employeeDraft.archived?'archived':'active';$('eExceptionDate').value=app.rosterDate||dateKey(new Date());
 $('employeeStatus').textContent='';renderEmployeeExceptions();renderDirectory();
}
async function saveEmployee(){if(!employeeDraft||!allow()||!app.canManageRoster)return;
 const e=employeeDraft;e.name=$('eName').value.trim().replace(/\s+/g,' ');e.employeeNumber=$('eNumber').value.trim();e.division=e.department=$('eDepartment').value;
 const newRole=$('eRole').value.trim()||'Other';
 if(newRole!==String(employeeOriginal?.role||employeeOriginal?.classificationDetail||employeeOriginal?.classification||'Other')){
   e.classificationDetail=newRole;
   e.classification=/apprentice/i.test(newRole)?'Apprentice':/electrician|journeyman/i.test(newRole)?'Electrician':/technician|installer/i.test(newRole)?'Technician':/foreman|lead/i.test(newRole)?'Foreman':'Other';
 }
 e.role=newRole;e.unionStatus=$('eUnion').value;
 e.status=$('eStatus').value;e.evaluation=$('eEvaluation').value;e.archived=$('eArchived').value==='archived';
 if(!e.name)return $('employeeStatus').textContent='Enter the employee name.';
 if(e.employeeNumber&&(app.doc?.employees||[]).some(x=>x.id!==e.id&&x.employeeNumber===e.employeeNumber&&!x.archived))return $('employeeStatus').textContent='Employee number is already in use.';
 $('employeeSave').disabled=true;const ok=await change([{kind:'employee',id:e.id,before:copy(employeeOriginal),after:copy(e),label:employeeOriginal?'Updated employee directory':'Added employee'}],{label:employeeOriginal?'Updated employee profile':'Added employee'});
 $('employeeSave').disabled=false;
 if(ok){employeeOriginal=copy(e);renderDirectory();$('employeeStatus').textContent='Saved to the shared schedule.';}
 else $('employeeStatus').textContent='Unable to save. Review recent changes and try again.';
}
$('bulkToggle').onclick=()=>{app.bulk=!app.bulk;app.selected.clear();renderCalendar();updateBulk()};$('bulkCancel').onclick=()=>{app.bulk=false;app.selected.clear();renderCalendar();updateBulk()};$('bulkDelete').onclick=deleteBulk;
$('copyJob').onclick=openCopy;$('copyClose').onclick=closeCopy;$('copyCancel').onclick=closeCopy;$('copyConfirm').onclick=confirmCopy;
$('calendar').addEventListener('change',e=>{if(e.target.matches('[data-bulk-id]')){const id=String(e.target.dataset.bulkId);if(e.target.checked)app.selected.add(id);else app.selected.delete(id);updateBulk()}});
if(new URLSearchParams(location.search).get('embedded')==='1')document.documentElement.classList.add('embedded');
$('previous').onclick=()=>{app.week.setDate(app.week.getDate()-7);app.rosterDate=weekDates()[0];$('rosterDate').value=app.rosterDate;render()};
$('next').onclick=()=>{app.week.setDate(app.week.getDate()+7);app.rosterDate=weekDates()[0];$('rosterDate').value=app.rosterDate;render()};
$('current').onclick=()=>{app.week=weekStart(new Date());app.rosterDate=dateKey(new Date());$('rosterDate').value=app.rosterDate;render()};
$('divisionFilter').onchange=e=>{app.division=e.target.value;renderCalendar()};$('jobFilter').onchange=e=>{app.filter=e.target.value;renderCalendar()};
$('zoom').oninput=e=>{app.zoom=Number(e.target.value)||100;applyCalendarZoom()};
$('toggleRequests').onclick=()=>{const hidden=$('requestContent').hidden;$('requestContent').hidden=!hidden;$('toggleRequests').textContent=hidden?'Hide requests':'View requests / make a request';$('toggleRequests').setAttribute('aria-expanded',String(hidden))};
const employeeRequestHint=document.createElement('p');employeeRequestHint.id='requestEmployeeStatus';employeeRequestHint.className='help';employeeRequestHint.style.margin='2px 0';$('requestEmployee').closest('label').after(employeeRequestHint);
$('requestEmployee').onchange=renderRequestEmployeeStatus;$('requestDate').onchange=renderRequestEmployeeStatus;
$('requestForm').onsubmit=async e=>{e.preventDefault();const button=$('sendRequest');button.disabled=true;try{await post({action:'request',type:$('requestType').value,date:$('requestDate').value,jobId:$('requestJob').value,employeeId:$('requestEmployee').value,details:$('requestDetails').value});$('requestDetails').value='';await refresh({force:true});notify('Manpower request submitted. It is now on the shared request dashboard.');}catch(error){notify(error.message,true)}finally{button.disabled=false}};
$('requests').addEventListener('change',async e=>{if(!e.target.matches('[data-request-status]')||!app.canEdit)return;try{await post({action:'requestStatus',id:e.target.dataset.requestStatus,status:e.target.value});await refresh({force:true});notify('Request status updated.')}catch(error){notify(error.message,true);await refresh({force:true})}});
$('rosterDate').onchange=e=>{app.rosterDate=e.target.value;renderRoster()};$('searchRoster').oninput=e=>{app.rosterSearch=e.target.value;renderRoster()};
$('addJob').onclick=()=>openJob(null,app.rosterDate||weekDates()[0]);$('addNote').onclick=addNote;
$('undo').onclick=()=>undoOrRedo('undo');$('redo').onclick=()=>undoOrRedo('redo');
$('report').onclick=printReport;
$('workforceTools').onclick=openWorkforceTools;
$('workforceClose').onclick=closeWorkforceTools;
$('directorySearch').oninput=renderDirectory;$('directoryDept').onchange=renderDirectory;$('directoryUnion').onchange=renderDirectory;
$('directoryNew').onclick=()=>openEmployee();
$('directoryResults').addEventListener('click',e=>{const b=e.target.closest('[data-edit-employee]');if(b)openEmployee(b.dataset.editEmployee)});
$('employeeSave').onclick=saveEmployee;$('employeeCancel').onclick=()=>{$('employeeEditPane').hidden=true;employeeDraft=null;renderDirectory()};
$('eSchoolDays').addEventListener('change',e=>{if(!employeeDraft||!e.target.matches('[data-school-day]'))return;const n=Number(e.target.dataset.schoolDay);employeeDraft.schoolDays=employeeDraft.schoolDays||[];employeeDraft.schoolDays=e.target.checked?[...new Set([...employeeDraft.schoolDays,n])]:employeeDraft.schoolDays.filter(x=>x!==n)});
$('eAddException').onclick=()=>{if(!employeeDraft)return;const date=$('eExceptionDate').value,status=$('eExceptionType').value;if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return;employeeDraft.exceptions??={};if(status==='clear')delete employeeDraft.exceptions[date];else employeeDraft.exceptions[date]=status;renderEmployeeExceptions()};
$('eExceptionsList').addEventListener('click',e=>{const b=e.target.closest('[data-clear-exception]');if(!b||!employeeDraft)return;delete employeeDraft.exceptions[b.dataset.clearException];renderEmployeeExceptions()});
$('reportClose').onclick=()=>{$('reportOverlay').classList.add('hidden')};$('reportPrint').onclick=()=>window.print();$('reportCSV').onclick=exportWorkCsv;
$('reportIncludeRoster').onchange=()=>{if(!$('reportOverlay').classList.contains('hidden'))$('reportSheet').innerHTML=makeWorkReport()};

$('toggleSide').onclick=()=>{const area=document.querySelector('.workarea'),shown=area.classList.toggle('show-side');$('toggleSide').textContent=shown?'Hide workforce & notes':'Show workforce & notes';$('toggleSide').setAttribute('aria-pressed',String(shown));};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch(_){notify('Fullscreen is not available in this browser. Use your browser’s full-screen or presentation controls.',true)}};
$('closeJob').onclick=closeJob;$('cancelJob').onclick=closeJob;$('saveJob').onclick=saveJob;$('deleteJob').onclick=deleteJob;
$('newEmployeeSearch').addEventListener('input',renderEmployeeOptions);$('addEmployee').onclick=()=>{const id=$('newEmployee').value,hrs=Number($('newHours').value)||8;if(!id||!app.draft)return;app.draft.assignments??=[];if(app.draft.assignments.some(a=>String(a.employeeId)===String(id)))return;app.draft.assignments.push({id:makeId('a_pres'),employeeId:id,hours:Math.max(.5,Math.min(24,hrs)),lead:false,underLead:''});renderAssignments()};
$('jDate').onchange=renderEditorWarnings;
$('assignments').addEventListener('change',e=>{
 if(!app.draft)return;
 const input=e.target,raw=input.dataset.assignHours??input.dataset.assignLead??input.dataset.assignUnder;
 if(raw===undefined)return;
 const i=Number(raw),a=app.draft.assignments?.[i];if(!a)return;
 if(input.matches('[data-assign-hours]'))a.hours=Math.max(.5,Math.min(24,Number(input.value)||8));
 if(input.matches('[data-assign-under]')){a.underLead=input.value||'';a.lead=false;}
 if(input.matches('[data-assign-lead]')){a.lead=input.checked;if(a.lead)a.underLead='';if(!a.lead)for(const c of app.draft.assignments||[])if(String(c.underLead||'')===String(a.employeeId))c.underLead='';}
 if(input.matches('[data-assign-under],[data-assign-lead]'))renderAssignments();else renderEditorWarnings();
});
$('assignments').addEventListener('click',e=>{const b=e.target.closest('[data-remove-assign]');if(!b||!app.draft)return;app.draft.assignments.splice(Number(b.dataset.removeAssign),1);renderAssignments()});
$('calendar').addEventListener('click',e=>{const edit=e.target.closest('[data-edit-job]');if(edit)return openJob(edit.dataset.editJob);const add=e.target.closest('[data-add-day]');if(add)return openJob(null,add.dataset.addDay)});
$('notes').addEventListener('click',e=>{const toggle=e.target.closest('[data-note-toggle]'),del=e.target.closest('[data-note-delete]');if(toggle)updateNote(toggle.dataset.noteToggle);if(del)updateNote(del.dataset.noteDelete,true)});
$('calendar').addEventListener('dragstart',e=>{const a=e.target.closest('[data-drag-assignment]');if(!a||!app.canEdit)return;const [source,assignment]=a.dataset.dragAssignment.split('|');e.dataTransfer.setData('text/plain',JSON.stringify({type:'assignment',source,assignment}));e.dataTransfer.effectAllowed='move'});
$('roster').addEventListener('dragstart',e=>{const a=e.target.closest('[data-roster-id]');if(!a||!app.canEdit)return;e.dataTransfer.setData('text/plain',JSON.stringify({type:'roster',id:a.dataset.rosterId}));e.dataTransfer.effectAllowed='copy'});
$('calendar').addEventListener('dragover',e=>{if(e.target.closest('[data-job-id]')&&app.canEdit)e.preventDefault()});
$('calendar').addEventListener('drop',e=>{const target=e.target.closest('[data-job-id]');if(!target||!app.canEdit)return;e.preventDefault();try{const p=JSON.parse(e.dataTransfer.getData('text/plain'));if(['roster','assignment'].includes(p.type))dragDrop(p,target.dataset.jobId)}catch(_){notify('Could not read the employee being moved.',true)}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('jobOverlay').classList.contains('hidden'))closeJob();else if(!$('workforceOverlay').classList.contains('hidden'))closeWorkforceTools();else if(!$('reportOverlay').classList.contains('hidden'))$('reportOverlay').classList.add('hidden');else if(!$('copyOverlay').classList.contains('hidden'))closeCopy();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)){e.preventDefault();undoOrRedo(e.shiftKey?'redo':'undo')}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)){e.preventDefault();undoOrRedo('redo')}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){refresh();heartbeat()}});
// Presenter defaults to meeting notes above the employee roster, with the notes visible on larger screens.
const side=document.querySelector('.side');if(side?.children.length>1)side.insertBefore(side.children[1],side.children[0]);
for(const [value,label] of [['data','Data'],['fire_alarm','Fire Alarm']]){
 for(const id of ['divisionFilter','jScope']){
  const select=$(id);if(select&&!select.querySelector(`option[value="${value}"]`))select.add(new Option(label,value));
 }
}
const initialZoom=$('zoom');initialZoom.min='65';initialZoom.max='115';initialZoom.value=String(app.zoom);
$('report').textContent='Detailed work report / PDF';
if(window.matchMedia('(min-width:1100px)').matches){document.querySelector('.workarea').classList.add('show-side');$('toggleSide').textContent='Hide workforce & notes';$('toggleSide').setAttribute('aria-pressed','true');}
window.addEventListener('resize',()=>requestAnimationFrame(applyCalendarZoom));
window.__mpDiagnostics=()=>({ready:!!app.doc,days:weekDates().length,jobs:app.doc?.jobs?.length||0,employees:app.doc?.employees?.length||0,revision:app.revision,canEdit:app.canEdit,reportAvailable:!!$('reportSheet')});
bootstrap();
})();
