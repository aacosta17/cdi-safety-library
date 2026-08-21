// BUILD v45 — embedded visor agreement so the Forms library works from the single HTML file
const VISOR_AGREEMENT_PDF_URL='forms/CDI_Z87_Visor_Agreement.pdf';
function getVisorAgreementUrl(){return VISOR_AGREEMENT_PDF_URL}
function openVisorAgreement(){openFormReader(getVisorAgreementUrl(),'Z87 Visor Agreement')}
function openVisorAgreementPrint(){window.open(getVisorAgreementUrl(),'_blank','noopener')}

// BUILD v21 — reusable in-page Forms reader
let formPdfDoc=null,formPageNum=1,formRendering=false,formPendingPage=null,formCurrentFile='';
async function openFormReader(file,title){
  const panel=E('formReaderPanel'),status=E('formStatus');
  panel.classList.remove('hidden');E('formReaderTitle').textContent=title;E('formReaderOpen').href=file;formCurrentFile=file;formPdfDoc=null;formPageNum=1;E('formPageCount').textContent='—';E('formPageInput').value=1;status.style.display='block';status.textContent='Loading form…';
  panel.scrollIntoView({behavior:'smooth',block:'start'});
  try{if(typeof pdfjsLib==='undefined')throw new Error('PDF reader unavailable');pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';formPdfDoc=await pdfjsLib.getDocument(file).promise;E('formPageCount').textContent=formPdfDoc.numPages;status.style.display='none';renderFormPage(1)}catch(err){status.textContent='This form could not load here. Use Open / Print above.';console.error(err)}
}
async function renderFormPage(num){if(!formPdfDoc)return;if(formRendering){formPendingPage=num;return}formRendering=true;formPageNum=Math.max(1,Math.min(Number(num)||1,formPdfDoc.numPages));const page=await formPdfDoc.getPage(formPageNum);const wrap=document.querySelector('#formReaderPanel .manual-canvas-wrap');const base=page.getViewport({scale:1});const maxWidth=Math.min(wrap.clientWidth||900,1000);const scale=Math.max(.5,maxWidth/base.width);const viewport=page.getViewport({scale});const canvas=E('formCanvas'),ctx=canvas.getContext('2d');const dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.floor(viewport.width*dpr);canvas.height=Math.floor(viewport.height*dpr);canvas.style.width=Math.floor(viewport.width)+'px';canvas.style.height=Math.floor(viewport.height)+'px';ctx.setTransform(dpr,0,0,dpr,0,0);await page.render({canvasContext:ctx,viewport}).promise;E('formPageInput').value=formPageNum;E('formPrev').disabled=formPageNum<=1;E('formNext').disabled=formPageNum>=formPdfDoc.numPages;formRendering=false;if(formPendingPage!==null){const p=formPendingPage;formPendingPage=null;renderFormPage(p)}}
function formPrevPage(){if(formPdfDoc&&formPageNum>1)renderFormPage(formPageNum-1)}function formNextPage(){if(formPdfDoc&&formPageNum<formPdfDoc.numPages)renderFormPage(formPageNum+1)}function formJumpPage(v){if(formPdfDoc)renderFormPage(v)}function closeFormReader(){E('formReaderPanel').classList.add('hidden')}

const __BUILD_MARKER__="v21";
const SAFETY_HUB_BUILD="v21";
const BG1="assets/ptp-page-1.png";
const BG2="assets/ptp-page-2.png";
const BG3="assets/ptp-page-3.png";
const PREVIEW_BG1="assets/ptp-preview-page-1.jpg";
const PREVIEW_BG2="assets/ptp-preview-page-2.jpg";
const PREVIEW_BG3="assets/ptp-preview-page-3.jpg";
const crew=[];const selections={};const answers={};let sid=0;let currentPTPStep=1;let _restoredDraft=null;
function E(id){return document.getElementById(id)}function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]))}function xml(s){return esc(s)}
function showView(v){["home","alerts","ptp","library","forms"].forEach(x=>E(x)?.classList.add("hidden"));document.querySelectorAll(".nav button").forEach(b=>b.classList.remove("active"));E(v).classList.remove("hidden");const navMap={home:"nHome",alerts:"nAlerts",ptp:"nPTP",library:"nLibrary",forms:"nForms"};if(navMap[v]&&E(navMap[v]))E(navMap[v]).classList.add("active");if(v==="ptp")go(currentPTPStep||1);if(v==="library")renderLibrary();schedulePTPDraftSave();window.scrollTo({top:0,behavior:"smooth"})}
function go(n){captureChecklistTextState();currentPTPStep=n;for(let i=1;i<=5;i++){E("s"+i).classList.toggle("hidden",i!==n);E("pr"+i).classList.toggle("active",i===n);E("pr"+i).classList.toggle("done",i<n)}E("output").classList.add("hidden");if(n===4){renderChecklist()}schedulePTPDraftSave();window.scrollTo({top:0,behavior:"smooth"})}
E("dateStarted").valueAsDate=new Date();
E("addCrew").onclick=()=>{const v=E("crewInput").value.trim();if(!v)return;if(crew.length>=16){alert("The CDI form has room for 16 crew members.");return}crew.push(v);E("crewInput").value="";renderCrew()};E("crewInput").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();E("addCrew").click()}});
function renderCrew(){E("crewChips").innerHTML=crew.map((n,i)=>`<span class="chip">${esc(n)} <button onclick="crew.splice(${i},1);renderCrew()">×</button></span>`).join("")}
function stepCards(){return [...document.querySelectorAll("#steps .step")]}function getSteps(){return stepCards().map(c=>({id:c.dataset.id,text:c.querySelector("textarea").value.trim()})).filter(x=>x.text)}
function createStep(text="",before=null){sid++;const id=String(sid);selections[id]=[];const d=document.createElement("div");d.className="step";d.dataset.id=id;d.innerHTML=`<div class="stephead"><b>Step</b><div class="stepcontrols"><span class="drag-handle" title="Press and drag this step">☰ DRAG</span><button class="btn secondary small" onclick="insert(this,'before')">+ Above</button><button class="btn secondary small" onclick="insert(this,'after')">+ Below</button><button class="btn danger small" onclick="removeStep(this)">Remove</button></div></div><div class="stepbody"><textarea placeholder="Example: Label cables at both ends" oninput="changed('${id}');markSequenceChanged()">${esc(text)}</textarea><div class="stepactions"><button class="btn primary small" onclick="findHazards('${id}')">Find Hazards</button><button class="btn ghost small" onclick="addCustom('${id}')">+ Custom Hazard</button><span id="status_${id}" class="stepstatus"></span></div><div id="haz_${id}" class="hazards"></div></div>`;const list=E("steps");before?list.insertBefore(d,before):list.appendChild(d);renumber();return id}

let sequenceConfirmed=false,sequenceTouched=false,stepSorter=null,expectedSequence=[];
function toggleQ(input){const cat=input.closest('.qcat');if(!cat)return;const open=input.value==='applies'||input.value==='unsure';cat.classList.toggle('open',open);if(!open)cat.querySelectorAll('.qdetail input[type="checkbox"]').forEach(x=>x.checked=false)}
function initQuestionnaire(){document.querySelectorAll('.qcat').forEach(cat=>{const checked=cat.querySelector('.qseg input:checked');if(checked)toggleQ(checked)});const loc=document.querySelector('.qcat[data-q="location"]');if(loc)loc.classList.add('open')}
function qValues(){return [...document.querySelectorAll('#questionnaire .qdetail input[type="checkbox"]:checked')].map(x=>x.value)}
function qStates(){const out={};document.querySelectorAll('#questionnaire .qcat').forEach(c=>{out[c.dataset.q]=c.querySelector('.qseg input:checked')?.value||'na'});return out}
function sequenceOrderAnalysis(){
 const cards=stepCards(),rows=cards.map((card,index)=>({card,index,text:(card.querySelector('textarea')?.value||'').trim()}));
 const issues=window.CDISequence?window.CDISequence.analyze(rows):[];
 return {cards,issues};
}
function sequenceIsCorrect(){const a=sequenceOrderAnalysis();return a.cards.length>0&&a.issues.length===0}
function updateSequenceHighlights(){
 const a=sequenceOrderAnalysis(),bad=new Set(a.issues.map(x=>x.card));
 a.cards.forEach(c=>{c.classList.toggle('needs-reorder',bad.has(c));c.classList.toggle('order-correct',!bad.has(c))});
 const ok=a.cards.length>0&&!a.issues.length,st=E('sequenceStatus'),b=E('confirmSequenceBtn'),box=E('sequenceIssues');
 if(st){st.textContent=ok?'✓ Sequence looks logical — confirm it below':`⚠ ${a.issues.length} clear order issue${a.issues.length===1?'':'s'} found`;st.classList.toggle('ok',ok);st.classList.toggle('warn',!ok)}
 if(box){box.classList.toggle('show',a.issues.length>0);box.innerHTML=a.issues.length?`<b>Move the red step${a.issues.length===1?'':'s'}:</b><ul>${a.issues.map(x=>`<li>${esc(x.message)}</li>`).join('')}</ul>`:''}
 if(b)b.disabled=!ok;
 return ok;
}
function markSequenceChanged(){sequenceTouched=true;sequenceConfirmed=false;updateSequenceHighlights()}
function initStepSorting(){
 if(stepSorter){stepSorter.destroy();stepSorter=null}
 if(typeof Sortable!=='undefined'&&E('steps'))stepSorter=new Sortable(E('steps'),{
   animation:180,
   handle:'.stephead',
   filter:'button,textarea,input,label,.hazards,.stepactions',
   preventOnFilter:false,
   ghostClass:'sortable-ghost',
   chosenClass:'sortable-chosen',
   forceFallback:true,
   fallbackOnBody:true,
   fallbackTolerance:4,
   touchStartThreshold:2,
   onEnd:()=>{renumber();markSequenceChanged()}
 });
}
function scrambleRequiredSteps(){
 // v222: never scramble a generated sequence just to create a drag exercise.
 expectedSequence=[];sequenceConfirmed=false;sequenceTouched=false;
 updateSequenceHighlights();
}
function shuffleMiddle(arr){return arr}

let confirmedMajorTasks=[];
let majorTaskOrderConfirmed=false;
function splitMajorTasks(raw){
  const txt=String(raw||'').trim();
  if(!txt)return [];
  const verb='install|mount|pull|route|terminate|test|label|remove|replace|relocate|repair|inspect|survey|walk|drill|cut|firestop|splice|connect|program|configure|demo|demolish|set|stage|measure|troubleshoot|diagnose|commission|secure';
  return txt
    .replace(/\s+(?:and\s+then|then)\s+/gi,' | ')
    .replace(/[,;\n]+/g,' | ')
    .replace(new RegExp('\\s+and\\s+(?=(?:'+verb+')\\b)','gi'),' | ')
    .split('|').map(x=>x.trim()).filter(Boolean);
}
function majorTaskStage(task){
 const low=String(task||'').toLowerCase();
 if(/\b(?:stage|deliver|move|position|inspect|survey|walk ?through|lay ?out|measure)\b/.test(low))return 10;
 if(/j[- ]?hooks?|cable supports?|cable tray|pathway|conduit|emt|raceway/.test(low))return 20;
 if(/\b(?:pull|route|feed)\b.*(?:cable|wire|fiber)|(?:cable|wire|fiber).*\b(?:pull|route|feed)\b/.test(low))return 30;
 if(/\b(?:dress|label|terminate|splice|crimp|punch)\b/.test(low))return 40;
 if(/\b(?:install|mount|secure|replace|relocate|repair)\b/.test(low)&&/(?:monitor|display|screen|camera|speaker|device|reader|panel|rack|cabinet|hardware)/.test(low))return 50;
 if(/\b(?:connect|program|configure|aim)\b/.test(low))return 60;
 if(/\b(?:test|commission|verify)\b/.test(low))return 70;
 if(/\b(?:firestop|close|restore|clean|housekeeping)\b/.test(low))return 90;
 return 45;
}
function suggestMajorTaskOrder(parts){return parts.map((task,index)=>({task,index,stage:majorTaskStage(task)})).sort((a,b)=>a.stage-b.stage||a.index-b.index).map(x=>x.task)}
function refreshMajorTaskOrder(force=false){
  const raw=(E('taskName')?.value||'').trim();
  const typedParts=splitMajorTasks(raw),parts=suggestMajorTaskOrder(typedParts),suggestedChanged=parts.join('\n')!==typedParts.join('\n');
  const box=E('majorTaskOrder'),list=E('majorTaskList'),status=E('majorTaskStatus'),btn=E('confirmMajorTaskOrderBtn');
  if(!box||!list)return;
  if(parts.length<2){
    confirmedMajorTasks=parts.length?parts:[raw].filter(Boolean);majorTaskOrderConfirmed=true;box.classList.add('hidden');
    if(E('buildWorkPlanBtn'))E('buildWorkPlanBtn').disabled=false;return;
  }
  const current=[...list.querySelectorAll('.major-task-card')].map(x=>x.dataset.task);
  if(!force&&current.join('\n')===parts.join('\n'))return;
  confirmedMajorTasks=parts.slice();majorTaskOrderConfirmed=false;box.classList.remove('hidden');
  list.innerHTML='';
  parts.forEach((t,i)=>{const d=document.createElement('div');d.className='major-task-card';d.dataset.task=t;d.innerHTML=`<span class="major-drag">☰</span><span class="major-num">${i+1}</span><span class="major-text">${esc(t)}</span>`;list.appendChild(d)});
  if(status){status.textContent=suggestedChanged?'Suggested logical order — review it, drag anything that needs to move, then confirm.':'Confirm this order before building the detailed work sequence.';status.classList.remove('ok')}
  if(btn)btn.disabled=false;
  if(E('buildWorkPlanBtn'))E('buildWorkPlanBtn').disabled=true;
  if(window.Sortable){if(list._majorSortable)list._majorSortable.destroy();list._majorSortable=new Sortable(list,{animation:150,handle:'.major-drag',ghostClass:'sortable-ghost',chosenClass:'sortable-chosen',onEnd:()=>{majorTaskOrderConfirmed=false;confirmedMajorTasks=[...list.querySelectorAll('.major-task-card')].map(x=>x.dataset.task);[...list.querySelectorAll('.major-num')].forEach((n,i)=>n.textContent=i+1);if(status){status.textContent='Order changed — confirm it before building the detailed sequence.';status.classList.remove('ok')}if(E('buildWorkPlanBtn'))E('buildWorkPlanBtn').disabled=true;if(btn)btn.disabled=false;}})}
}
function confirmMajorTaskOrder(){
  const list=E('majorTaskList');if(!list)return;
  confirmedMajorTasks=[...list.querySelectorAll('.major-task-card')].map(x=>x.dataset.task).filter(Boolean);
  majorTaskOrderConfirmed=true;
  const status=E('majorTaskStatus');if(status){status.textContent='✓ Major-task order confirmed';status.classList.add('ok')}
  const btn=E('confirmMajorTaskOrderBtn');if(btn)btn.disabled=true;
  if(E('buildWorkPlanBtn'))E('buildWorkPlanBtn').disabled=false;
  schedulePTPDraftSave?.();
}
function addTypedScopeSteps(scopeText,m){
 const low=String(scopeText||'').toLowerCase();
 const has=(...words)=>words.some(w=>low.includes(w));
 let installingMonitor=false,installingCamera=false,installingSpeaker=false,installingJHook=false,recognized=false;
 if(has('walk through','walkthrough','walk thru','site walk','survey','inspect area','inspection')){recognized=true;m('Meet with the people involved and confirm the area to be checked');m('Walk the work area and check the planned route');m('Write down access issues, conflicts or conditions that need follow-up');m('Review what was found before leaving the area')}
 if(has('conduit','emt','raceway')){recognized=true;m('Check the conduit route and support locations');m('Measure and mark the conduit route');m('Install the anchors, hangers and supports');m('Measure, cut, ream and bend the conduit as needed');m('Install and secure the conduit and fittings');m('Check the conduit for support, alignment and clearance')}
 installingJHook=has('j hook','j-hook','jhook','j hooks','j-hooks','jhooks','cable support','cable supports')&&has('install','installing','mount','mounting','secure','securing');
 if(installingJHook){recognized=true;m('Lay out the J-hook or cable-support locations');m('Install the anchors and secure the J-hooks or cable supports');m('Check the J-hooks for spacing and secure attachment')}
 if(has('pull cable','pulling cable','cable pull','pull wire','pulling wire','pull fiber','pulling fiber')||(/^pull\b/.test(low)&&has('cable','wire','fiber'))){recognized=true;m('Confirm the cable route and pull points');m('Pull and route the cable through the approved pathway');m('Dress, support and label the cable')}
 installingMonitor=has('monitor','monitors','display','displays','screen','screens','television',' tv ')&&has('install','installing','mount','mounting');
 if(installingMonitor){recognized=true;m('Lay out and mark the monitor locations');m('Install the monitor mounts or brackets');m('Mount, secure and connect the monitors');m('Turn on and test each monitor')}
 installingCamera=has('camera','cameras')&&has('install','installing','mount','mounting');
 if(installingCamera){recognized=true;m('Check and mark each camera location');m('Install the camera mounts or brackets');m('Mount and secure the cameras');m('Connect the camera cables');m('Aim and test the cameras')}
 installingSpeaker=has('speaker','speakers','intercom')&&has('install','installing','mount','mounting');
 if(installingSpeaker){recognized=true;m('Check and mark each speaker or intercom location');m('Install the mounts or supports');m('Mount and secure the devices');m('Connect the cables');m('Test the devices')}
 if(has('measure','measurement','layout','lay out')&&!has('conduit','emt','raceway')){recognized=true;m('Go to the work locations');m('Take the needed measurements');m('Write down and double-check the measurements')}
 if(has('troubleshoot','diagnose','service call')){recognized=true;m('Check the reported problem and affected equipment');m('Inspect and test the affected system');m('Find the cause and make the approved repair');m('Test the system again and make sure it works properly')}
 const specificInstallCovered=installingMonitor||installingCamera||installingSpeaker||installingJHook||has('conduit','emt','raceway');
 if(has('install','installing','mount','mounting','replace','remove','relocate','repair')&&!specificInstallCovered&&!has('troubleshoot','diagnose','service call')){recognized=true;m('Check where this work will be done');m('Get the mounting or connection points ready');m('Complete this task: '+scopeText);m('Secure and connect the equipment as needed');m('Check the finished work')}
 if(!recognized){m('Complete this task: '+scopeText);m('Check the finished work for this task')}
 return {installingMonitor,installingCamera,installingSpeaker,installingJHook};
}
function buildWorkPlan(){
 const task=(E("taskName").value||"").trim();
 const scopes=plannerValues("scopePicks"),acts=plannerValues("activityPicks"),q=qValues(),states=qStates();
 if(!task && !scopes.length && !acts.length){alert("Describe the actual work first.");return}

 const steps=[],criticalSetup=[],workPrep=[],middle=[],closeout=[],testing=[];
 const push=x=>{if(x&&!steps.includes(x))steps.push(x)},critical=x=>{if(x&&!criticalSetup.includes(x))criticalSetup.push(x)},prep=x=>{if(x&&!workPrep.includes(x))workPrep.push(x)},m=x=>{if(x&&!middle.includes(x))middle.push(x)},close=x=>{if(x&&!closeout.includes(x))closeout.push(x)},test=x=>{if(x&&!testing.includes(x))testing.push(x)};
 const low=task.toLowerCase();
 const has=(...words)=>words.some(w=>low.includes(w));
 if(splitMajorTasks(task).length>1&&!majorTaskOrderConfirmed){refreshMajorTaskOrder(true);E('majorTaskOrder')?.scrollIntoView({behavior:'smooth',block:'center'});alert('Confirm the order of the major tasks before building the detailed work sequence.');return}
 const orderedTasks=(confirmedMajorTasks.length?confirmedMajorTasks:splitMajorTasks(task));
 let installingMonitor=false,installingCamera=false,installingSpeaker=false,installingJHook=false;
 (orderedTasks.length?orderedTasks:[task]).filter(Boolean).forEach(part=>{
   const r=addTypedScopeSteps(part,m);installingMonitor=installingMonitor||r.installingMonitor;installingCamera=installingCamera||r.installingCamera;installingSpeaker=installingSpeaker||r.installingSpeaker;installingJHook=installingJHook||r.installingJHook;
 });

 // Routine setup is deliberately consolidated into two crew-friendly steps.
 const usesLadder=q.some(x=>['step-ladder','extension-ladder','platform-ladder'].includes(x));
 const usesLift=q.some(x=>['scissor-lift','boom-lift'].includes(x));
 const movesMaterial=acts.includes('material-move')||states.material==='applies';
 if(acts.includes('above-ceiling')||states.ceiling==='applies')prep("Open the ceiling area and protect the area below");
 if((acts.includes('drill')||states.penetration==='applies') && !has("conduit","emt","raceway"))prep("Mark the drill or anchor locations, then drill or cut as needed");
 // Do not add a generic connection/testing step when the typed scope already created
 // specific device steps. This keeps the sequence natural and avoids duplicate work.
 if(acts.includes('terminate') && !installingMonitor && !installingCamera && !installingSpeaker)close("Terminate and connect the cable or devices");
 if(acts.includes('splice'))close("Prepare, splice and protect the fiber");
 if(acts.includes('firestop'))close("Install firestop at the finished penetrations");
 if(acts.includes('test') && !installingMonitor && !installingCamera && !installingSpeaker)test("Test the finished work");
 if(states.loto==='applies'||states.loto==='unsure')critical("Shut down, lock out hazardous energy and verify zero energy before starting the affected work");
 if(acts.includes('excavation')||states.excavation==='applies'||states.excavation==='unsure')prep("Set the required controls, then complete the excavation or ground work");

 push("Review today's work with the crew; inspect the route and work area; establish the needed barricades and controls");
 let setupText="Stage the materials; inspect and set up the tools and access equipment needed for the job";
 if(usesLadder&&usesLift)setupText="Stage the materials; inspect and set up the ladder, lift, tools and access controls needed for the job";
 else if(usesLadder)setupText="Stage the materials; inspect and set up the ladder and tools needed for the job";
 else if(usesLift)setupText="Stage the materials; inspect the lift, set the barricade and position the tools and equipment for the job";
 if(movesMaterial)setupText=setupText.replace("Stage the materials","Move and stage the materials");
 push(setupText);
 criticalSetup.forEach(push);
 workPrep.forEach(push);
 middle.forEach(push);
 closeout.forEach(push);
 testing.forEach(push);
 const housekeepingStep="Housekeeping: clean the work area, put back anything that was moved and remove the barricades";
 push(housekeepingStep);

 E("steps").innerHTML="";if(typeof sid!=="undefined")sid=0;if(typeof stepCounter!=="undefined")stepCounter=0;
 Object.keys(selections).forEach(k=>delete selections[k]);
 steps.forEach(x=>createStep(x));
 sequenceConfirmed=false;sequenceTouched=false;E('sequencePanel')?.classList.add('show');
 const oldNote=E('sequenceStepCountNote');if(oldNote)oldNote.remove();
 if(steps.length>17){const note=document.createElement('div');note.id='sequenceStepCountNote';note.className='step-limit-note';note.textContent=`This plan contains ${steps.length} steps. No steps were discarded. Review the wording and combine only work that can be performed safely as one step.`;E('sequencePanel')?.appendChild(note)}
 initStepSorting();
 expectedSequence=[];
 updateSequenceHighlights();
 const cb=E('confirmSequenceBtn');if(cb)cb.disabled=!sequenceIsCorrect();
 findAll();
 E('sequencePanel')?.scrollIntoView({behavior:'smooth',block:'start'});
}

function confirmSequence(){
 if(!sequenceIsCorrect()){alert("Fix the clear order issue shown above, then confirm the sequence.");return}
 sequenceConfirmed=true;
 const st=E('sequenceStatus');if(st){st.textContent='✓ Work sequence confirmed';st.classList.add('ok')}
 const b=E('confirmSequenceBtn');if(b)b.disabled=true;
 stepCards().forEach(c=>c.classList.remove('needs-reorder'));
 findAll()
}
function addBlankStep(){const id=createStep("");expectedSequence=[];document.querySelector(`.step[data-id="${id}"] textarea`)?.focus();markSequenceChanged();initStepSorting()}
function continueFromWorkPlan(){if(!stepCards().length){alert("Build the work sequence first.");return}if(!sequenceConfirmed){alert("Confirm the work sequence before continuing. This verifies the steps match what the crew will actually perform.");return}go(4)}

function addStep(){addBlankStep()}function insert(btn,where){const card=btn.closest(".step");const before=where==="before"?card:card.nextElementSibling;const id=createStep("",before&&before.classList.contains("step")?before:null);document.querySelector(`.step[data-id="${id}"] textarea`)?.focus();markSequenceChanged();initStepSorting()}function move(btn,dir){const c=btn.closest(".step"),list=E("steps");if(dir<0){const p=c.previousElementSibling;if(p)list.insertBefore(c,p)}else{const n=c.nextElementSibling;if(n)list.insertBefore(n,c)}renumber();markSequenceChanged()}function removeStep(btn){const c=btn.closest(".step");if(stepCards().length===1){alert("Keep at least one step.");return}delete selections[c.dataset.id];c.remove();renumber();markSequenceChanged()}function renumber(){stepCards().forEach((c,i)=>c.querySelector(".stephead b").textContent=`Step ${i+1}`)}function changed(id){selections[id]=(selections[id]||[]).filter(x=>x.custom);renderHazards(id)}
function contexts(){return [...plannerValues("conditionPicks"),...(typeof qValues==="function"?qValues():[])]}
function selectedContexts(){return contexts()}
function plannerValues(id){return [...document.querySelectorAll(`#${id} input:checked`)].map(x=>x.value)}
function plannerAll(){return [...plannerValues("scopePicks"),...plannerValues("activityPicks"),...plannerValues("equipmentPicks"),...plannerValues("conditionPicks"),...(typeof qValues==="function"?qValues():[])]}function tokens(t){return String(t||"").toLowerCase().replace(/[^a-z0-9]+/g," ").split(/\s+/).filter(Boolean)}const SYN={scissor:["lift","mewp"],boom:["lift","mewp"],camera:["security","surveillance"],cat6:["cable","data"],cat6a:["cable","data"],fiber:["optical","cable"],ceiling:["overhead"],panel:["electrical"],drilling:["drill","penetration"],concrete:["silica","drill"],pulling:["pull","cable"],rack:["cabinet"],outside:["osp","weather"],label:["labeling"],housekeeping:["cleanup"]};
function conceptSet(text){const s=new Set(tokens(text+" "+E("taskName").value+" "+plannerAll().join(" ")));[...s].forEach(w=>(SYN[w]||[]).forEach(x=>s.add(x)));return s}
function scoreEntry(e,c,raw){let s=0;(e.tags||[]).forEach(t=>{if(c.has(t))s+=5;if(raw.includes(t))s+=1.5});if(e.task)tokens(e.task).forEach(w=>{if(c.has(w))s+=.5});if(e.source==="CDI Manual"&&(e.tags||[]).some(t=>c.has(t)))s+=3;return s}
function relevant(e,c,raw){const cat=(e.category||"").toLowerCase(),all=raw+" "+[...c].join(" ");const has=(...x)=>x.some(v=>all.includes(v));const tags=new Set(e.tags||[]);if(cat.includes("ladder")&&!has("ladder"))return false;if((cat.includes("mewp")||cat.includes("aerial"))&&!has("lift","mewp","scissor","boom"))return false;if(cat.includes("forklift")&&!has("forklift"))return false;if(cat.includes("confined")&&!has("confined","manhole"))return false;if(tags.has("cable_pull")&&!has("pull","route","feed","reel"))return false;if(tags.has("security_test")&&!has("test","commission","troubleshoot"))return false;if(tags.has("termination")&&!has("terminate","termination","connect","splice","crimp","punch"))return false;if(tags.has("drill")&&!has("drill","anchor","penetrat","core","mount","hole"))return false;if(tags.has("silica")&&!has("concrete","masonry","silica","core"))return false;return true}
function recommend(text){const raw=text.toLowerCase(),c=conceptSet(text),arr=LIBRARY.map(e=>({...e,_s:scoreEntry(e,c,raw)})).filter(e=>e._s>=5&&relevant(e,c,raw)).sort((a,b)=>b._s-a._s),out=[],seen=new Set();for(const e of arr){const k=e.hazard.toLowerCase().replace(/[^a-z0-9]+/g," ");if(seen.has(k))continue;seen.add(k);out.push(e);if(out.length>=5)break}return out}
function findHazards(id){const c=document.querySelector(`.step[data-id="${id}"]`),text=c?.querySelector("textarea").value.trim();if(!text){alert("Enter the work step first.");return}const custom=(selections[id]||[]).filter(x=>x.custom);const base=recommend(text).map((x,i)=>({...x,selected:i<3,custom:false}));selections[id]=[...custom,...mergeWeatherHazards(base,text)];renderHazards(id)}
function addCustom(id){
 const hazard=prompt("Enter the hazard:");
 if(!hazard)return;
 const control=prompt("Enter the control / mitigation:");
 if(!control)return;
 selections[id]=selections[id]||[];
 selections[id].push({hazard,control,source:"Crew Added",selected:true,custom:true,tags:[]});
 renderHazards(id);
}
function findAll(){getSteps().forEach(s=>findHazards(s.id))}
function renderHazards(id){
 const box=E("haz_"+id)||E("sugs_"+id),arr=selections[id]||[],status=E("status_"+id);
 if(!box)return;
 const count=arr.filter(x=>x.selected).length;
 if(status)status.innerHTML=count?`${count} hazards selected · <button type="button" class="haztoggle" onclick="toggleHazards('${id}')">View / Edit</button>`:`<button type="button" class="haztoggle" onclick="findHazards('${id}')">Find Hazards</button>`;
 box.classList.add("collapsed");
 box.innerHTML=arr.map((h,i)=>`<label class="hazard ${h.selected?"selected":""}"><input type="checkbox" ${h.selected?"checked":""} ${h.required?"disabled":""} onchange="selections['${id}'][${i}].selected=this.checked;renderHazards('${id}');toggleHazards('${id}',true)"><div><h4>${esc(h.hazard)}${h.required?'<span class="hazard-required">REQUIRED</span>':''}</h4><p><b>Control:</b> ${esc(h.control)}</p><div class="hazmeta">${esc(h.source||"Crew Added")}</div></div></label>`).join("");
}
function toggleHazards(id,open=false){
 const box=E("haz_"+id)||E("sugs_"+id);if(!box)return;
 if(open)box.classList.remove("collapsed");else box.classList.toggle("collapsed");
}
function ensureHazard(stepId,hazard,control,source="Checklist"){
 selections[stepId]=selections[stepId]||[];
 const key=String(hazard).toLowerCase().trim();
 if(!selections[stepId].some(x=>String(x.hazard||"").toLowerCase().trim()===key)){
   selections[stepId].push({hazard,control,source,selected:true,required:true,custom:false,checklistAdded:true,tags:[]});
 }
}
function findBestStep(wordsNeeded){
 const steps=getSteps();
 if(!steps.length)return null;
 const scored=steps.map(s=>{
   const t=s.text.toLowerCase();
   let score=0;
   wordsNeeded.forEach(w=>{if(t.includes(w))score+=3});
   return {s,score};
 }).sort((a,b)=>b.score-a.score);
 return scored[0]?.s||steps[0];
}
function applyChecklistHazards(){
 const steps=getSteps();
 if(!steps.length)return;

 // Cable / wire pulling
 if(answers.pullinspect==="N" || answers.pullzone==="N"){
   const s=findBestStep(["pull","cable","wire","fiber"]);
   if(s)ensureHazard(s.id,
     "Cable pull equipment / work zone not adequately controlled",
     "Stop and inspect pulling equipment; establish a controlled pull zone; keep personnel out of pinch points, bights, and the line of pull.");
 }
 // Manual handling
 if(answers.heavy==="Y" || answers.lifting==="N"){
   const s=findBestStep(["stage","move","lift","rack","reel","material"]);
   if(s)ensureHazard(s.id,
     "Manual handling load may exceed safe capability",
     "Use team lift or mechanical assistance; plan the route; keep fingers clear of pinch points and maintain clear communication.");
 }
 // Gloves / hand protection
 if(answers.gloves==="N"){
   const s=findBestStep(["cut","terminate","install","drill","mount","cable"]);
   if(s)ensureHazard(s.id,
     "Hand exposure without suitable task-specific gloves",
     "Select task-appropriate gloves before work and keep hands out of cut, pinch, and line-of-fire zones.");
 }
 // Ladder conditions
 if(answers.ladinspect==="N" || answers.ladstable==="N" || answers.ladclear==="N"){
   const s=findBestStep(["ladder","access","mount","ceiling"]);
   if(s)ensureHazard(s.id,
     "Unsafe ladder condition or setup",
     "Stop ladder use until it is inspected, placed on firm level footing, and the surrounding work area is controlled and clear.");
 }
 // Fall protection
 if(answers.fall==="N"){
   const s=findBestStep(["lift","ladder","elevate","overhead","mount"]);
   if(s)ensureHazard(s.id,
     "Fall-protection equipment not confirmed inspected",
     "Do not begin fall-exposure work until required fall-protection equipment is inspected and defective components are removed from service.");
 }
 // LOTO
 if(answers.lotoreq==="Y"){
   const s=findBestStep(["electrical","panel","terminate","connect","power","controller"]);
   if(s)ensureHazard(s.id,
     "Unexpected energization / stored energy",
     "Identify all energy sources; isolate and lock/tag; dissipate stored energy; verify zero energy before beginning the affected work.");
 }
 if(answers.zero==="N" && answers.lotoreq==="Y"){
   const s=findBestStep(["electrical","panel","terminate","connect"]);
   if(s)ensureHazard(s.id,
     "Zero-energy condition not verified",
     "Stop work and verify the isolation by testing/attempting normal controls as required before contact with the equipment.");
 }
 // Extension cords
 if(answers.cords==="N"){
   const s=findBestStep(["drill","tool","setup","install"]);
   if(s)ensureHazard(s.id,
     "Extension cord condition not verified",
     "Inspect cords and plugs before use; remove damaged cords from service and route cords to prevent damage and trip hazards.");
 }
 // SDS / chemical
 if(answers.sds==="N"){
   const s=findBestStep(["firestop","adhesive","chemical","clean","seal"]);
   if(s)ensureHazard(s.id,
     "Chemical product used without SDS review",
     "Stop and review the product label/SDS; identify required ventilation, PPE, handling, and spill controls before use.");
 }
 // Utility location / penetration
 if(answers.utilities==="N" || getSelectedPermits().includes("Ground & Wall Penetration")){
   const s=findBestStep(["drill","penetrat","core","anchor","wall"]);
   if(s)ensureHazard(s.id,
     "Penetration may contact concealed utility or energized service",
     "Verify the penetration location and concealed utilities before drilling or coring; stop if site conditions differ from the approved plan.");
 }
 // Electrical room / energized work
 if(getSelectedPermits().includes("Electrical room work") || getSelectedPermits().includes("Energized elec. Work")){
   const s=findBestStep(["electrical","panel","controller","terminate","connect"]);
   if(s)ensureHazard(s.id,
     "Electrical exposure in or near energized equipment",
     "Maintain required electrical clearances and working space; limit work to qualified/authorized personnel and de-energize/isolate whenever possible.");
 }
 // Hot work
 if(getSelectedPermits().includes("Hot work")){
   const s=findBestStep(["cut","grind","hot","weld"]);
   if(s)ensureHazard(s.id,
     "Fire / burn exposure from hot work",
     "Remove or protect combustibles; contain sparks; provide required fire protection/fire watch and control hot surfaces and fumes.");
 }
 // Confined space
 if(getSelectedPermits().includes("Confined space") || answers.confined==="N"){
   const s=findBestStep(["manhole","confined","space","entry"]);
   if(s)ensureHazard(s.id,
     "Confined-space atmospheric / entry hazard",
     "Determine permit-space requirements; control entry, atmosphere, ventilation, communication, and rescue provisions before entry.");
 }
 // Work communication
 if(answers.communicated==="N"){
   const s=steps[0];
   ensureHazard(s.id,
     "Work not communicated with nearby personnel / trades",
     "Conduct a pre-task huddle and coordinate the work area, sequence, barricades, and interaction with other trades or occupants before starting.");
 }
 // Emergency procedure
 if(answers.emergency==="N"){
   const s=steps[0];
   ensureHazard(s.id,
     "Crew not prepared for site emergency response",
     "Review emergency contacts, alarm/evacuation procedure, muster location, and how to summon medical assistance before starting work.");
 }
 steps.forEach(s=>renderHazards(s.id));
}



function plannerSupplementCandidates(){
 const p=new Set(plannerAll()),out=[];
 const add=(hazard,control,tags=[])=>out.push({hazard,control,tags,source:"Work Plan Review"});

 if(p.has("step-ladder")||p.has("extension-ladder")){
   add("Ladder struck by pedestrian / doorway movement","Control doors and pedestrian traffic; barricade the ladder area and maintain a clear setup zone.",["ladder","traffic"]);
   add("Overreaching or side loading while working from ladder","Keep body centered between rails; descend and reposition instead of leaning or applying uncontrolled side force.",["ladder","fall"]);
 }
 if(p.has("scissor-lift")||p.has("boom-lift")){
   add("MEWP crush / pinch exposure at overhead or side obstruction","Survey overhead and side clearances before movement; keep body inside platform and use a spotter where visibility is restricted.",["lift","crush"]);
   add("MEWP collision with occupants, equipment or structure","Establish travel/exclusion route; use spotter and controlled speed; lower platform for travel when appropriate.",["lift","traffic"]);
   add("Dropped tools or hardware from elevated platform","Secure tools/materials and control the area below; use parts containers or tethering where appropriate.",["lift","dropped"]);
 }
 if(p.has("drill-tool")||p.has("core-drill")||p.has("drill")){
   add("Flying chips / debris during drilling or anchoring","Use eye/face protection and dust/debris capture; keep other personnel outside the immediate drilling zone.",["drill","particles"]);
   add("Drill bind / kickback / awkward body position","Use correct bit and tool; maintain stable footing and two-hand control where designed; reposition rather than overreach.",["drill","kickback"]);
 }
 if(p.has("core-drill")||p.has("hepa")){
   add("Respirable dust from concrete / masonry disturbance","Use effective HEPA or wet dust control as applicable; maintain capture at the source and clean using HEPA/wet methods.",["silica","dust"]);
 }
 if(p.has("cable-reel")||p.has("cable-puller")||p.has("cable-pull")){
   add("Cable reel movement / rotating flange exposure","Set reel on stable rated stands, chock/control movement and keep hands/clothing clear of rotating flanges.",["reel","cable"]);
   add("Stored tension / cable whip during pull","Keep personnel out of bights and recoil path; release tension in a controlled manner and use clear stop/start commands.",["cable","tension"]);
 }
 if(p.has("hand-tools")){
   add("Hand-tool cut / pinch exposure","Inspect tools; use correct tool and controlled hand position; cut away from body and keep free hand out of the line of fire.",["tools","hands"]);
 }
 if(p.has("fiber-tools")||p.has("fiber")){
   add("Fiber shard puncture / eye exposure","Use eye protection and a designated fiber-shard container/work mat; never handle shards with bare fingers and clean the work surface.",["fiber","shard"]);
   add("Optical-source exposure from active fiber","Verify fiber state and never look directly into fiber ends/connectors; use appropriate test equipment.",["fiber","optical"]);
 }
 if(p.has("tester")||p.has("test")){
   add("Unexpected device/system response during testing","Coordinate testing with affected personnel; control moving/locking/alarm outputs and verify restoration after testing.",["testing","commission"]);
 }
 if(p.has("cart")||p.has("forklift")||p.has("material-move")){
   add("Material movement blocks visibility / strikes person or property","Plan the route; keep loads stable and within equipment capacity; maintain visibility or use a spotter.",["material","traffic"]);
 }
 if(p.has("occupied")||p.has("corridor")||p.has("other-trades")){
   add("Public / other-trade interaction with active work zone","Use barricades/signage and coordinate sequencing; maintain required egress and prevent unauthorized entry into the work area.",["occupied","traffic"]);
 }
 if(p.has("ceiling")||p.has("above-ceiling")){
   add("Hidden sharp edges / energized services above ceiling","Use task lighting; inspect before reaching; maintain separation from electrical and other existing services; wear appropriate hand/eye protection.",["ceiling","hidden"]);
   add("Ceiling tile / debris falls during access","Remove and stage tiles securely; control the area below and contain dust/debris during overhead work.",["ceiling","dropped"]);
 }
 if(p.has("data-center")){
   add("Impact to active data-center equipment / critical services","Coordinate exact work area and system with site operations; protect active equipment, airflow and cabling; maintain access and cleanliness.",["data-center","critical"]);
 }
 if(p.has("electrical-room")||p.has("electrical")){
   add("Restricted electrical working space / proximity to energized equipment","Keep electrical working space clear; limit access to authorized/qualified personnel and maintain required separation.",["electrical","room"]);
 }
 if(p.has("outdoor")||p.has("osp")||p.has("parking")){
   add("Vehicle / mobile-equipment exposure in exterior work area","Use high-visibility controls, cones/barricades and spotters as appropriate; maintain separation from moving vehicles.",["traffic","outside"]);
 }
 if(p.has("heat")){
   add("Heat stress / dehydration","Provide water, cooling/rest opportunities and symptom monitoring appropriate to conditions; stop work and respond to heat illness symptoms promptly.",["heat"]);
 }
 if(p.has("wind-weather")){
   add("Weather change affects elevated work, material control or electrical safety","Monitor wind/rain/lightning; secure loose material and stop/reassess work when conditions make the planned controls ineffective.",["weather","wind"]);
 }
 if(p.has("tight-space")){
   add("Restricted access causes awkward posture / limited escape path","Reposition equipment and materials to preserve access/egress; limit congestion and avoid sustained awkward posture.",["access","ergonomics"]);
 }
 if(p.has("label")){
   add("Misidentification of cable / device during labeling","Verify both endpoints/device identity before applying labels; coordinate changes so active or critical systems are not mislabeled.",["labeling","quality"]);
 }
 if(p.has("firestop")){
   add("Firestop chemical / skin / eye exposure","Review product SDS; use required gloves/eye protection and ventilation; control spills and clean excess material.",["firestop","chemical"]);
 }
 return out;
}

const QUESTIONS=[
 ["General Checklist",[
  ["sds","SDS reviewed for task?"],
  ["cords","All extension cords inspected?"],
  ["hotgear","Electrical hot work equipment up-to-date?"],
  ["confined","Confined space procedure / rescue plan?"],
  ["utilities","Utility lines located above / below ground?"],
  ["fall","All fall protection equipment inspected?"],
  ["emergency","Emergency procedure and contacts reviewed?"],
  ["communicated","Work communicated with others in area?"]
 ]],
 ["Material Handling Checklist",[
  ["heavy","Item(s) lifted more than you can handle?"],
  ["stretch","Stretch and flex performed?"],
  ["lifting","Following safe lifting procedures?"],
  ["gloves","Proper gloves being used?"],
  ["pullinspect","If pulling wire/cable, is equipment inspected?"],
  ["pullzone","Is the wire/cable pull area taped or controlled?"]
 ]],
 ["Ladder Safety Checklist",[
  ["ladinspect","Ladder inspected?"],
  ["ladstable","Ladder set on stable ground?"],
  ["ladclear","Work area clear around ladder?"]
 ]],
 ["Lock Out / Tag Out Checklist",[
  ["lotoreq","Is LOTO required?"],
  ["walkdown","System walked down?"],
  ["ownerlock","Owner isolated system and placed lock?"],
  ["yourlock","Your lock placed?"],
  ["teststart","System test-start attempted?"],
  ["zero","Zero energy verified?"]
 ]]
];
function seg(id){
 return `<div class="seg">
   <label><input type="radio" name="${id}" value="Y" onchange="answers['${id}']='Y'"><span>Yes</span></label>
   <label><input type="radio" name="${id}" value="N" onchange="answers['${id}']='N'"><span>No</span></label>
   <label><input type="radio" name="${id}" value="A" onchange="answers['${id}']='A'"><span>N/A</span></label>
 </div>`;
}

const checklistTextState={workHeight:"",ladderHeight:""};
function captureChecklistTextState(){
 const wh=E("workHeight"),lh=E("ladderHeight");
 if(wh)checklistTextState.workHeight=wh.value||"";
 if(lh)checklistTextState.ladderHeight=lh.value||"";
}
function bindChecklistTextState(){
 const wh=E("workHeight"),lh=E("ladderHeight");
 if(wh){wh.value=checklistTextState.workHeight||wh.value||"";wh.addEventListener("input",()=>{checklistTextState.workHeight=wh.value;schedulePTPDraftSave()})}
 if(lh){lh.value=checklistTextState.ladderHeight||lh.value||"";lh.addEventListener("input",()=>{checklistTextState.ladderHeight=lh.value;schedulePTPDraftSave()})}
}
function checklistFieldValue(id){
 const el=E(id);
 if(el)return el.value||"";
 return checklistTextState[id]||"";
}
function renderChecklist(){
 captureChecklistTextState();
 if(!E("checklist"))return;
 E("checklist").innerHTML=QUESTIONS.map(([title,qs])=>`
   <div class="checksection">
     <h3>${title}</h3>
     <div class="checkbody">
       ${title==="Ladder Safety Checklist" ? `
         <div class="grid2" style="margin:8px 0 4px">
           <div><label class="lbl">Height of work</label><input id="workHeight"></div>
           <div><label class="lbl">Height of ladder</label><input id="ladderHeight"></div>
         </div>` : ""}
       ${qs.map(([id,q])=>`<div class="checkrow"><b>${q}</b>${seg(id)}</div>`).join("")}
     </div>
   </div>`).join("");
 Object.entries(answers).forEach(([id,v])=>{
   const r=document.querySelector(`input[name="${id}"][value="${v}"]`);
   if(r)r.checked=true;
 });
 bindChecklistTextState();
}
function getSelectedPermits(){
 return [...document.querySelectorAll("#permits input:checked")].map(x=>x.value);
}
function selectedFor(stepId){ return selected(stepId); }
function selected(stepId){
 return (selections[stepId]||[]).filter(x=>x && x.selected);
}
function checklistCandidates(){
 const out=[];
 const add=(hazard,control,tags=["checklist"])=>out.push({hazard,control,tags,source:"Checklist / PTP Review"});
 const applicable=id=>answers[id] && answers[id]!=="A";

 if(applicable("cords"))add("Temporary power / extension cord trip or damage exposure","Inspect cords and plugs; remove damaged equipment; route/protect cords to prevent trips, pinch damage and contact with wet areas.",["cord","tools"]);
 if(applicable("heavy") || applicable("lifting"))add("Material handling / overexertion exposure","Plan the move; use team or mechanical assistance when needed; keep the route clear and hands out of pinch points.",["material","lifting"]);
 if(applicable("gloves"))add("Cuts, abrasions or pinch-point hand exposure","Use task-appropriate gloves and controlled hand placement; keep hands out of blades, sharp edges and pinch points.",["gloves","hands"]);
 if(applicable("pullinspect") || applicable("pullzone"))add("Cable pulling line-of-fire, pinch and stored-tension exposure","Inspect reels, stands, grips and pulling equipment; control the pull zone; keep workers out of bights and the direct line of pull.",["cable","pull"]);
 if(applicable("ladinspect") || applicable("ladstable") || applicable("ladclear"))add("Ladder fall / unstable setup / traffic exposure","Inspect ladder; use firm level footing; maintain three points of contact; control doors and pedestrian traffic; reposition instead of overreaching.",["ladder","fall"]);
 if(applicable("fall"))add("Fall from elevated work position","Inspect required fall-protection equipment; use approved anchorage/tie-off where required; keep gates/rails in place and maintain safe access.",["fall","height"]);
 if(applicable("lotoreq") || getSelectedPermits().includes("Electrical room work") || getSelectedPermits().includes("Energized elec. Work"))add("Electrical shock / unexpected energization","Identify electrical sources; de-energize and isolate when possible; use required LOTO and qualified personnel; verify safe condition before contact.",["electrical","loto"]);
 if(applicable("utilities") || getSelectedPermits().includes("Ground & Wall Penetration"))add("Drilling or penetration into concealed utility","Verify the penetration path and utilities before drilling/coring; stop if conditions differ from the plan; use suitable dust/debris controls.",["penetration","utility"]);
 if(applicable("sds"))add("Chemical / product exposure","Review label and SDS before use; apply required ventilation, handling, PPE and spill controls.",["chemical","sds"]);
 if(applicable("communicated"))add("Interaction with occupants or other trades","Coordinate sequence and work-zone controls; communicate barricades, overhead work, equipment movement and access restrictions.",["communication","occupied"]);
 if(applicable("emergency"))add("Delayed emergency response due to unclear site procedure","Review alarms, emergency contacts, evacuation/muster route and method for summoning medical assistance before work.",["emergency"]);
 if(getSelectedPermits().includes("Hot work"))add("Fire, sparks, burns and hot-surface exposure","Remove/protect combustibles; contain sparks; provide required extinguisher/fire watch; control hot surfaces and fumes.",["hot-work","fire"]);
 if(getSelectedPermits().includes("Confined space"))add("Confined-space atmospheric / access hazard","Verify entry classification and permit requirements; control atmosphere, ventilation, communication, access and rescue provisions.",["confined"]);
 if(getSelectedPermits().includes("Crane – critical lift"))add("Suspended-load / rigging line-of-fire exposure","Use approved lift plan and rated inspected rigging; establish exclusion zone; use designated signaling and keep personnel clear of suspended loads.",["rigging","crane"]);
 return out;
}

function appPreflight(){
 const checks={
   answerState:typeof answerState==="function",
   selected:typeof selected==="function",
   selectedBlob:typeof selectedBlob==="function",
   hasAny:typeof hasAny==="function",
   getSelectedPermits:typeof getSelectedPermits==="function",
   ensureHazard:typeof ensureHazard==="function",
   renderChecklist:typeof renderChecklist==="function",
   addCustom:typeof addCustom==="function",
   applyChecklistHazards:typeof applyChecklistHazards==="function",
   checklistCandidates:typeof checklistCandidates==="function",
   plannerSupplementCandidates:typeof plannerSupplementCandidates==="function",
   finalHazardRows:typeof finalHazardRows==="function",
   page1HazardFlags:typeof page1HazardFlags==="function",
   page1ControlFlags:typeof page1ControlFlags==="function",
   highRiskFlags:typeof highRiskFlags==="function",
   editablePage1:typeof editablePage1==="function",
   editablePage2:typeof editablePage2==="function",
   generatePTP:typeof generatePTP==="function",
   reviewPTP:typeof reviewPTP==="function"
 };
 const missing=Object.entries(checks).filter(([,ok])=>!ok).map(([name])=>name);
 if(missing.length)console.error("Safety Hub preflight failed:",missing);
 return {ok:missing.length===0,missing};
}

function reviewPTP(){try{const pf=appPreflight();if(!pf.ok)throw new Error("Missing app function(s): "+pf.missing.join(", "));applyChecklistHazards();const steps=getSteps(),issues=[];if(!E("jobNo").value.trim())issues.push("Enter Job No.");if(!E("jobLeader").value.trim())issues.push("Enter Job Leader.");if(!E("foreman").value.trim())issues.push("Enter Job Lead or Foreman.");if(!E("taskName").value.trim())issues.push("Enter Task Name.");if(!crew.length)issues.push("Add at least one crew member.");if(!steps.length)issues.push("Add at least one work step.");steps.forEach((s,i)=>{if(!selected(s.id).length)issues.push(`Step ${i+1} needs at least one selected hazard.`)});let out=issues.length?`<div class="notice warn"><b>${issues.length} item${issues.length===1?"":"s"} need attention:</b><ul>${issues.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div>`:'<div class="notice good"><b>PTP content check passed.</b> Review the sequence below.</div>';out+=steps.map((s,i)=>`<div class="reviewstep"><b class="title">Step ${i+1} — ${esc(s.text)}</b><ul>${selected(s.id).map(h=>`<li><b>${esc(h.hazard)}</b><br>${esc(h.control)}</li>`).join("")||"<li>No selected hazards</li>"}</ul></div>`).join("");E("review").innerHTML=out;go(5)}catch(err){console.error(err);alert("Review could not open: "+err.message)}}

function wrap(text,max){const w=String(text||"").trim().split(/\s+/).filter(Boolean),a=[];let l="";for(const x of w){const t=l?l+" "+x:x;if(t.length>max&&l){a.push(l);l=x}else l=t}if(l)a.push(l);return a}function compact(s,n){
 s=String(s||"").replace(/\s+/g," ").trim();
 if(!s)return "";
 if(s.length<=n)return s;

 // Prefer a complete clause/sentence that fits.
 const clauses=s.split(/(?<=[.;:])\s+|;\s+|,\s+(?=(?:and|but|then|use|keep|maintain|verify|inspect|remove|coordinate|control|plan|wear|secure|avoid)\b)/i);
 let out="";
 for(const c0 of clauses){
   let c=c0.trim().replace(/[;,:\s]+$/,"");
   if(!c)continue;
   const candidate=out?out+"; "+c:c;
   if(candidate.length<=n)out=candidate;
   else break;
 }
 if(out && out.length>=Math.min(18,n*.55)){
   return /[.!?]$/.test(out)?out:out+".";
 }

 // If the first clause itself is too long, shorten at a safe word boundary,
 // then remove dangling connector words so the printed line does not end
 // with "and", "or", "with", "to", etc.
 let cut=s.slice(0,n+1);
 const lastSpace=cut.lastIndexOf(" ");
 if(lastSpace>15)cut=cut.slice(0,lastSpace);
 cut=cut.replace(/[;,:\-–—\s]+$/,"")
        .replace(/\b(and|or|with|to|for|of|the|a|an|while|during|using|from|by|in|on|at)\s*$/i,"")
        .replace(/[;,:\-–—\s]+$/,"");
 return cut+(cut && !/[.!?]$/.test(cut)?".":"");
}
function selectedBlob(){
 const stepText=getSteps().flatMap(s=>selected(s.id))
   .map(x=>[
     x.hazard||"",
     x.control||"",
     ...(x.tags||[])
   ].join(" "))
   .join(" ");
 const plan=(typeof plannerAll==="function"?plannerAll():[]).join(" ");
 return (stepText+" "+plan).toLowerCase();
}
function hasAny(blob,words){
 return words.some(w=>blob.includes(w));
}

function page1HazardFlags(){
 const b=selectedBlob();
 return {
  chemical:hasAny(b,["chemical","sds","solvent","adhesive","corrosive"]),
  thermal:hasAny(b,["thermal burn","hot surface","hot work"]),
  particles:hasAny(b,["flying particle","debris","dust","chips","eye"]),
  overexertion:hasAny(b,["overexertion","strain","manual handling","lifting"]),
  elevated:hasAny(b,["fall","ladder","lift","mewp","height"]),
  overhead:hasAny(b,["overhead","dropped","falling object","ceiling"]),
  dropping:hasAny(b,["dropped","falling object","drop zone"]),
  inhalation:hasAny(b,["inhalation","silica","dust","fume","vapor"]),
  vehicle:hasAny(b,["vehicle collision","forklift","traffic","backing"]),
  cuts:hasAny(b,["cut","puncture","sharp","blade","snip"]),
  fire:hasAny(b,["fire","hot work","spark","ignition"]),
  spills:hasAny(b,["spill","leak"]),
  abrasions:hasAny(b,["abrasion"]),
  cavein:hasAny(b,["cave-in","excavation","trench"]),
  noise:hasAny(b,["noise","hearing"]),
  heat:hasAny(b,["heat stress","heat exposure","dehydration"]),
  traffic:hasAny(b,["traffic","pedestrian","vehicle","occupied"]),
  rodents:hasAny(b,["rodent","insect"]),
  crane:hasAny(b,["crane","rigging","hoist","suspended load"]),
  access:hasAny(b,["access","egress","work zone","barricade"]),
  silica:hasAny(b,["silica","concrete dust","masonry dust"])
 };
}
function page1ControlFlags(){
 const b=selectedBlob();
 return {
  rubber:hasAny(b,["flash suit","rubber glove"]),
  chemical:hasAny(b,["chemical","sds"]),
  confined:hasAny(b,["confined space"]),
  fall:hasAny(b,["fall protection","tie-off","harness","srl"]),
  energized:hasAny(b,["energized electrical"]),
  gloves:hasAny(b,["glove","hand protection","cut-resistant"]),
  eye:hasAny(b,["eye protection","face protection","safety glasses"]),
  people:hasAny(b,["team lift","enough personnel","adequate personnel","spotter"]),
  respirator:hasAny(b,["respirator","respiratory"]),
  hearing:hasAny(b,["hearing protection"]),
  housekeeping:hasAny(b,["housekeeping","clean","walkway","cord"]),
  cords:hasAny(b,["cord","lead"]),
  barricades:hasAny(b,["barricade","work zone","exclusion zone","cones","signage"]),
  sparks:hasAny(b,["spark","combustible"]),
  extinguisher:hasAny(b,["extinguisher","fire watch"]),
  training:hasAny(b,["trained","authorized"]),
  body:hasAny(b,["body position","stable stance","ergonomic"]),
  shoring:hasAny(b,["shoring","excavation","slope"]),
  stretch:hasAny(b,["stretch"]),
  scaffold:hasAny(b,["scaffold"]),
  spillkit:hasAny(b,["spill control","spill kit"]),
  liftcheck:hasAny(b,["lift","mewp","scissor","boom"]),
  communicate:hasAny(b,["communicate","coordinate","huddle","clear commands"]),
  wetmethod:hasAny(b,["wet method"])
 };
}

function editableLine(x,lineY,w,value,size=11,opts={}){
 const id=opts.id||"";
 const align=opts.align||"left";
 const h=Math.max(12,size+3);
 return `<input class="ovline" ${id?`data-field="${id}"`:""} value="${esc(value||"")}" style="left:${x}px;top:${lineY-h}px;width:${w}px;height:${h}px;line-height:${h}px;font-size:${size}px;text-align:${align};">`;
}
function editableField(x,y,w,h,value,size=12,opts={}){
 const id=opts.id||"";
 const align=opts.align||"left";
 return `<textarea class="ovtext" ${id?`data-field="${id}"`:""} style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;font-size:${size}px;text-align:${align};">${esc(value||"")}</textarea>`;
}
function checkBox(x,y,on=false,key="",group=""){
 return `<button type="button" class="ovcheck ${on?"on":""}" ${key?`data-check="${key}"`:""} ${group?`data-group="${group}"`:""} style="left:${x-9}px;top:${y-9}px" onclick="togglePreviewCheck(this)"></button>`;
}
function togglePreviewCheck(el){
 const group=el.dataset.group;
 const wasOn=el.classList.contains("on");
 if(group){
   document.querySelectorAll(`.ovcheck[data-group="${group}"]`).forEach(x=>x.classList.remove("on"));
   if(!wasOn)el.classList.add("on");
 }else{
   el.classList.toggle("on");
 }
 if(typeof _ptpHiResCache!=="undefined")_ptpHiResCache={sig:"",pages:[]};
}
function scaleFormCanvases(){
 document.querySelectorAll(".formpage").forEach(page=>{
   const canvas=page.querySelector(".formcanvas");
   if(!canvas)return;
   const scale=page.clientWidth/1584;
   canvas.style.transform=`scale(${scale})`;
 });
}
window.addEventListener("resize",scaleFormCanvases);
function answerState(id){
 return answers[id] || "";
}
function editablePage1(){
 let h=`<div class="formpage"><div class="formcanvas"><img src="${PREVIEW_BG1}" decoding="sync" alt="Official CDI PTP page 1">`;
 h+=editableLine(1167,213,260,E("jobNo").value,11,{id:"jobNo"});
 h+=editableLine(1210,243,222,E("jobLeader").value,11,{id:"jobLeader"});
 h+=editableLine(1222,273,211,E("company").value,11,{id:"company"});
 h+=editableLine(1260,303,110,E("dateStarted").value,10,{id:"dateStarted"});
 h+=editableLine(1424,303,96,E("timeStarted").value,10,{id:"timeStarted"});
 h+=editableLine(1230,333,140,E("dateCompleted").value,10,{id:"dateCompleted"});
 h+=editableLine(1424,333,96,E("timeCompleted").value,10,{id:"timeCompleted"});
 h+=editableField(1105,522,405,66,E("taskName").value,12,{id:"taskName"});
 h+=editableField(1105,655,405,42,E("goal").value,12,{id:"goal"});
 h+=editableLine(1105,797,405,E("foreman").value,11,{id:"foreman"});
 const crewY=[922,952,982,1012,1042,1072,1102,1132],crewX=[1105,1318];
 crew.slice(0,16).forEach((n,i)=>h+=editableLine(crewX[i>=8?1:0],crewY[i%8],185,n,10.5,{id:"crew"+i}));

 // permits
 const pc={"Confined space":[228,134],"Hot work":[228,160],"Energized elec. Work":[228,188],"Elevator":[228,216],"Electrical room work":[432,134],"Crane – critical lift":[432,160],"Ladder":[432,188],"Ground & Wall Penetration":[432,216]};
 Object.entries(pc).forEach(([k,[x,y]])=>h+=checkBox(x,y,getSelectedPermits().includes(k),"permit:"+k));

 // checklist
 const groups=[
 [["sds","cords","hotgear","confined","utilities","fall","emergency","communicated"],[296,322,346,372,398,422,448,474]],
 [["heavy","stretch","lifting","gloves","pullinspect","pullzone"],[532,558,584,608,634,660]],
 [["ladinspect","ladstable","ladclear"],[770,796,821]],
 [["lotoreq","walkdown","ownerlock","yourlock","teststart","zero"],[877,902,928,952,978,1004]]
 ];
 groups.forEach(([ids,ys])=>ids.forEach((id,i)=>{const v=answerState(id);h+=checkBox(388,ys[i],v==="Y",id+":Y",id)+checkBox(425,ys[i],v==="N",id+":N",id)+checkBox(458,ys[i],v==="A",id+":A",id)}));
 h+=editableField(405,705,70,16,checklistFieldValue("workHeight"),9,{id:"workHeight"});
 h+=editableField(405,735,70,16,checklistFieldValue("ladderHeight"),9,{id:"ladderHeight"});

 // possible hazards / controls
 const hf=page1HazardFlags(),hvals=[hf.chemical,hf.thermal,hf.particles,hf.overexertion,hf.elevated,hf.overhead,hf.dropping,hf.inhalation,hf.vehicle,hf.cuts,hf.fire,hf.spills,hf.abrasions,hf.cavein,hf.noise,hf.heat,hf.traffic,hf.rodents,hf.crane,hf.access,hf.silica],hy=[120,143,170,188,209,231,251,276,298,318,341,364,384,407,428,449,473,493,517,541,562];
 hvals.forEach((v,i)=>h+=checkBox(608,hy[i],v,"haz"+i));
 const cf=page1ControlFlags(),cvals=[cf.rubber,cf.chemical,cf.confined,cf.fall,cf.energized,cf.gloves,cf.eye,cf.people,cf.respirator,cf.hearing,cf.housekeeping,cf.cords,cf.barricades,cf.sparks,cf.extinguisher,cf.training,cf.body,cf.shoring,cf.stretch,cf.scaffold,cf.spillkit,cf.liftcheck,cf.communicate,cf.wetmethod],cys=[625,649,671,693,714,736,760,779,801,826,846,868,890,910,935,957,979,1000,1023,1044,1068,1087,1111,1132];
 cvals.forEach((v,i)=>h+=checkBox(609,cys[i],v,"ctl"+i));

 h+=checkBox(93,1062,answers.cleanPPE==="Y","cleanPPE");
 h+=checkBox(93,1088,answers.cleanTools==="Y","cleanTools");
 h+=checkBox(92,1113,answers.cleanVehicle==="Y","cleanVehicle");
 h+=checkBox(92,1140,answers.cleanSurface==="Y","cleanSurface");
 return h+"</div></div>";
}
function editablePage2(rows){
 // PAGE 2: Blank 9 - full-height writing page. Coordinates are tied to the original PDF, not a screenshot.
 let h=`<div class="formpage"><div class="formcanvas"><img src="${PREVIEW_BG2}" decoding="sync" alt="Official CDI PTP page 2 - continuation writing page">`;
 const ys=Array.from({length:28},(_,i)=>182+i*36);
 rows.slice(0,28).forEach((r,i)=>{
   h+=editableLine(48,ys[i],430,r.step,9.7,{id:"rowStep"+i});
   h+=editableLine(557,ys[i],459,r.haz,9.1,{id:"rowHaz"+i});
   h+=editableLine(1094,ys[i],450,r.ctl,8.8,{id:"rowCtl"+i});
 });
 return h+"</div></div>";
}
function editablePage3(rows){
 // PAGE 3: original second page from Template PTP. Top lines continue overflow; lower checklists stay functional.
 let h=`<div class="formpage"><div class="formcanvas"><img src="${PREVIEW_BG3}" decoding="sync" alt="Official CDI PTP page 3">`;
 const ys=[146,179,211,243,275,307,339,371,403,435,467,499,531,563,595,627,659];
 rows.slice(28,45).forEach((r,i)=>{
   h+=editableLine(64,ys[i],400,r.step,9.4,{id:"rowStep"+(i+28)});
   h+=editableLine(584,ys[i],400,r.haz,8.9,{id:"rowHaz"+(i+28)});
   h+=editableLine(1110,ys[i],400,r.ctl,8.6,{id:"rowCtl"+(i+28)});
 });
 const chgy=[754,779,804,830],ids=["chgPersonnel","chgTask","chgWeather","chgAccess"];
 ids.forEach((id,i)=>{const v=answerState(id);h+=checkBox(387,chgy[i],v==="Y",id+":Y",id)+checkBox(424,chgy[i],v==="N",id+":N",id)+checkBox(458,chgy[i],v==="A",id+":A",id)});
 h+=checkBox(263,914,answers.crewAware==="Y","crewAware:Y","crewAware")+checkBox(344,914,answers.crewAware==="N","crewAware:N","crewAware");
 h+=editableField(64,969,396,62,E("changeText")?.value||"",10,{id:"changeText"});
 h+=checkBox(154,1094,answers.accident==="Y","accident:Y","accident")+checkBox(233,1094,answers.accident==="N","accident:N","accident");
 h+=checkBox(1283,758,answers.materialsReady==="Y","materialsReady:Y","materialsReady")+checkBox(1367,758,answers.materialsReady==="N","materialsReady:N","materialsReady");
 h+=checkBox(1283,858,answers.dailyConfirm==="Y","dailyConfirm:Y","dailyConfirm")+checkBox(1367,858,answers.dailyConfirm==="N","dailyConfirm:N","dailyConfirm");

 const hr=highRiskFlags(),vals=[hr.material,hr.hazardous,hr.driving,hr.heights,hr.lifting,hr.confined,hr.isolation,hr.electrical,hr.ground,hr.mobile,hr.heat,hr.cold,hr.silica],hry=[720,752,788,820,857,888,924,958,992,1024,1059,1092,1126];
 vals.forEach((v,i)=>{h+=checkBox(814,hry[i],v,"hr"+i+":Y","hr"+i)+checkBox(910,hry[i],!v,"hr"+i+":N","hr"+i)});
 return h+"</div></div>";
}
function page1(){let s=svg(BG1);s+=textEl(1170,198,E("jobNo").value,13)+textEl(1188,228,E("jobLeader").value,13)+textEl(1174,258,E("company").value,13)+textEl(1195,288,E("dateStarted").value,12)+textEl(1410,288,E("timeStarted").value,12)+textEl(1220,318,E("dateCompleted").value,12)+textEl(1410,318,E("timeCompleted").value,12);wrap(E("taskName").value,44).slice(0,3).forEach((l,i)=>s+=textEl(1110,533+i*25,l,13));wrap(E("goal").value,44).slice(0,2).forEach((l,i)=>s+=textEl(1110,668+i*26,l,13));s+=textEl(1110,852,compact(E("foreman").value,44),13);const cy=[915,945,975,1005,1035,1065,1095,1125],cx=[1110,1320];crew.slice(0,16).forEach((n,i)=>s+=textEl(cx[i>=8?1:0],cy[i%8],compact(n,24),12));
const gy=[296,322,346,372,398,422,448,474],gids=["sds","cords","hotgear","confined","utilities","fall","emergency","communicated"];gids.forEach((id,i)=>s+=answerMark(id,388,425,458,gy[i]));
const my=[532,558,584,608,634,660],mids=["heavy","stretch","lifting","gloves","pullinspect","pullzone"];mids.forEach((id,i)=>s+=answerMark(id,388,425,458,my[i]));
const _workHeight=checklistFieldValue("workHeight"),_ladderHeight=checklistFieldValue("ladderHeight");if(_workHeight)s+=textEl(357,704,compact(_workHeight,12),12,false,"end");if(_ladderHeight)s+=textEl(357,734,compact(_ladderHeight,12),12,false,"end");
const ly=[770,796,821],lids=["ladinspect","ladstable","ladclear"];lids.forEach((id,i)=>s+=answerMark(id,388,425,458,ly[i]));
const loy=[877,902,928,952,978,1004],loids=["lotoreq","walkdown","ownerlock","yourlock","teststart","zero"];loids.forEach((id,i)=>s+=answerMark(id,388,425,458,loy[i]));
const pc={"Confined space":[228,134],"Hot work":[228,160],"Energized elec. Work":[228,188],"Elevator":[228,216],"Electrical room work":[432,134],"Crane – critical lift":[432,160],"Ladder":[432,188],"Ground & Wall Penetration":[432,216]};getSelectedPermits().forEach(p=>{if(pc[p])s+=xmark(pc[p][0],pc[p][1])});

// Possible Hazards checkboxes on the official CDI form.
const hf=page1HazardFlags();
const hvals=[hf.chemical,hf.thermal,hf.particles,hf.overexertion,hf.elevated,hf.overhead,hf.dropping,hf.inhalation,hf.vehicle,hf.cuts,hf.fire,hf.spills,hf.abrasions,hf.cavein,hf.noise,hf.heat,hf.traffic,hf.rodents,hf.crane,hf.access,hf.silica];
const hy=[120,143,170,188,209,231,251,276,298,318,341,364,384,407,428,449,473,493,517,541,562];
hvals.forEach((v,i)=>{if(v)s+=xmark(608,hy[i])});

// Ways to Eliminate Hazards checkboxes.
const cf=page1ControlFlags();
const cvals=[cf.rubber,cf.chemical,cf.confined,cf.fall,cf.energized,cf.gloves,cf.eye,cf.people,cf.respirator,cf.hearing,cf.housekeeping,cf.cords,cf.barricades,cf.sparks,cf.extinguisher,cf.training,cf.body,cf.shoring,cf.stretch,cf.scaffold,cf.spillkit,cf.liftcheck,cf.communicate,cf.wetmethod];
const cys=[625,649,671,693,714,736,760,779,801,826,846,868,890,910,935,957,979,1000,1023,1044,1068,1087,1111,1132];
cvals.forEach((v,i)=>{if(v)s+=xmark(609,cys[i])});

// Cleaned and Disinfected checkboxes only when employee answered Yes.
if(answers.cleanPPE==="Y")s+=xmark(93,1062);
if(answers.cleanTools==="Y")s+=xmark(93,1088);
if(answers.cleanVehicle==="Y")s+=xmark(92,1113);
if(answers.cleanSurface==="Y")s+=xmark(92,1140);

return s+"</svg>"}


let hazardMixOffset=0;

function hazardFamily(h){
 const t=(String(h.hazard||"")+" "+String(h.control||"")).toLowerCase();
 const families=[
   ["fall",["fall","ladder","mewp","scissor","boom","height","tie-off"]],
   ["dropped",["dropped","falling object","overhead","tool tether"]],
   ["electrical",["electrical","energized","shock","loto","zero energy","panel"]],
   ["material",["material handling","manual handling","overexertion","lifting","cart","rack/cabinet tip"]],
   ["pinch-cut",["cut","puncture","pinch","sharp","hand exposure","tool kickback"]],
   ["traffic",["traffic","pedestrian","vehicle","collision","work zone","occupants"]],
   ["cable-pull",["cable pull","stored tension","line-of-fire","reel","bight","whip"]],
   ["drilling",["drill","penetration","anchor","kickback","flying chips","silica"]],
   ["testing",["testing","commission","unexpected alarm","system response"]],
   ["housekeeping",["housekeeping","trip","blocked access","debris","restore area"]],
   ["fiber",["fiber shard","optical-source","fusion","splice"]],
   ["chemical",["chemical","sds","firestop","adhesive","spill"]],
   ["weather",["heat stress","weather","wind","lightning"]],
   ["confined",["confined","manhole","atmospheric"]],
   ["rigging",["rigging","crane","suspended load","hoist"]],
   ["communication",["communicate","coordination","other trades","occupants"]],
   ["critical",["data-center","critical services","active equipment"]],
   ["fire",["hot work","fire","spark","burn"]],
   ["quality",["label","misidentification","wrong cable","device identity"]]
 ];
 for(const [name,keys] of families){
   if(keys.some(k=>t.includes(k)))return name;
 }
 return "other:"+String(h.hazard||"").toLowerCase().split(/\s+/).slice(0,3).join("-");
}

function normalizedHazardKey(h){
 return String(h.hazard||"").toLowerCase()
   .replace(/\b(the|a|an|during|while|from|or|and|of|to|in|on|with)\b/g," ")
   .replace(/[^a-z0-9]+/g," ")
   .replace(/\s+/g," ")
   .trim();
}

function isNearDuplicateHazard(a,b){
 const ka=normalizedHazardKey(a), kb=normalizedHazardKey(b);
 if(!ka||!kb)return false;
 if(ka===kb)return true;
 const A=new Set(ka.split(" ")),B=new Set(kb.split(" "));
 const inter=[...A].filter(x=>B.has(x)).length;
 const union=new Set([...A,...B]).size;
 return union ? inter/union >= .58 : false;
}


function splitDenseText(text,maxChars,maxLines){
 const words=String(text||"").replace(/\s+/g," ").trim().split(" ").filter(Boolean);
 const lines=[]; let line="";
 for(const word of words){
   const candidate=line?line+" "+word:word;
   if(candidate.length<=maxChars){line=candidate;continue}
   if(line)lines.push(line);
   line=word;
   if(lines.length>=maxLines)break;
 }
 if(line&&lines.length<maxLines)lines.push(line);
 return lines.slice(0,maxLines);
}
function cleanFinalLine(s){
 return String(s||"").trim()
   .replace(/[;,:\-–—\s]+$/,"")
   .replace(/\b(and|or|with|to|for|of|the|a|an|while|during|using|from|by|in|on|at)\s*$/i,"")
   .replace(/[;,:\-–—\s]+$/,"");
}

function ptpRows(){return finalHazardRows()}
function fitRows(rows){return rows.slice(0,17)}
function highRiskFlags(){
 const b=selectedBlob();
 return {
  material:hasAny(b,["material handling","lifting","reel","rack","cabinet"]),
  hazardous:hasAny(b,["chemical","sds","silica","hazardous material"]),
  driving:hasAny(b,["driving","vehicle"]),
  heights:hasAny(b,["fall","ladder","lift","mewp","height"]),
  lifting:hasAny(b,["rigging","hoist","crane","team lift","mechanical handling"]),
  confined:hasAny(b,["confined","manhole"]),
  isolation:hasAny(b,["loto","lockout","zero energy","isolate"]),
  electrical:hasAny(b,["electrical","energized","panel","ups"]),
  ground:hasAny(b,["ground disturbance","excavation","trench","underground"]),
  mobile:hasAny(b,["lift","mewp","forklift","mobile equipment"]),
  heat:hasAny(b,["heat stress","heat exposure"]),
  cold:hasAny(b,["cold stress","extreme cold"]),
  silica:hasAny(b,["silica","concrete dust"])
 };
}
function page2(rows){
 let s=svg(BG2),ys=[146,179,211,243,275,307,339,371,403,435,467,499,531,563,595,627,659];
 rows.slice(0,17).forEach((r,i)=>{const y=ys[i]-7;s+=textEl(64,y,r.step,9.8)+textEl(584,y,r.haz,8.9)+textEl(1110,y,r.ctl,8.6)});

 // Has anything changed from original plan? Yes / No / N/A
 const chgy=[754,779,804,830],ids=["chgPersonnel","chgTask","chgWeather","chgAccess"];
 ids.forEach((id,i)=>s+=answerMark(id,387,424,458,chgy[i]));
 // Entire crew aware of changes
 const aware=answers.crewAware;if(aware==="Y")s+=xmark(263,914);else if(aware==="N")s+=xmark(344,914);
 // What changed lines
 wrap(E("changeText")?.value||"",48).slice(0,2).forEach((l,i)=>s+=textEl(64,998+i*31,l,11));
 // Accident/injury today
 if(answers.accident==="Y")s+=xmark(154,1094);else if(answers.accident==="N")s+=xmark(233,1094);
 // Materials / safety equipment available
 if(answers.materialsReady==="Y")s+=xmark(1283,758);else if(answers.materialsReady==="N")s+=xmark(1367,758);

 // High Risk Activities auto-derived from selected step hazards.
 const hr=highRiskFlags(),vals=[hr.material,hr.hazardous,hr.driving,hr.heights,hr.lifting,hr.confined,hr.isolation,hr.electrical,hr.ground,hr.mobile,hr.heat,hr.cold,hr.silica],hry=[720,752,788,820,857,888,924,958,992,1024,1059,1092,1126];
 vals.forEach((v,i)=>s+=v?xmark(814,hry[i]):xmark(910,hry[i]));
 return s+"</svg>"
}
function generatePTP(){
 try{
   captureChecklistTextState();
   const pf=appPreflight();if(!pf.ok)throw new Error("Missing app function(s): "+pf.missing.join(", "));
   applyChecklistHazards();
   const steps=getSteps();
   if(!steps.length){alert("Add at least one work step.");go(3);return}
   if(steps.some(s=>!selected(s.id).length)){alert("Every work step needs at least one selected hazard.");go(3);return}
   if(steps.length>28){alert("The PTP writing page can hold up to 28 concise work-step lines. Combine the work into 28 or fewer major steps.");go(3);return}
   const rows=finalHazardRows();
   E("preview").innerHTML=editablePage1()+editablePage2(rows)+editablePage3(rows);requestAnimationFrame(scaleFormCanvases);setTimeout(scaleFormCanvases,60);
   E("s5").classList.add("hidden");E("output").classList.remove("hidden");window.scrollTo({top:0,behavior:"smooth"});
 }catch(err){console.error(err);alert("PTP could not be generated: "+err.message)}
}
function renderLibrary(){const q=(E("libSearch").value||"").toLowerCase(),cat=E("libCategory").value,rows=LIBRARY.filter(e=>{const blob=(e.hazard+" "+e.control+" "+(e.task||"")+" "+(e.tags||[]).join(" ")+" "+e.category).toLowerCase();return(!q||blob.includes(q))&&(!cat||e.category===cat)});E("libStats").textContent=`Showing ${rows.length} of ${LIBRARY.length} records`;E("libResults").innerHTML=rows.slice(0,150).map(e=>`<div class="libitem"><h4>${esc(e.hazard)}<span class="badge">${esc(e.source)}</span></h4><p><b>Control:</b> ${esc(e.control)}</p>${e.task?`<p><b>Common task:</b> ${esc(e.task)}</p>`:""}</div>`).join("")}[...new Set(LIBRARY.map(x=>x.category))].sort().forEach(c=>{const o=document.createElement("option");o.value=c;o.textContent=c;E("libCategory").appendChild(o)});E("libSearch").addEventListener("input",renderLibrary);E("libCategory").addEventListener("change",renderLibrary);
function safetyHubSelfCheck(){
 const problems=[];
 if(typeof getSelectedPermits!=="function")problems.push("Permit reader");
 if(typeof reviewPTP!=="function")problems.push("PTP review");
 if(typeof generatePTP!=="function")problems.push("PTP generator");
 if(problems.length)console.error("Safety Hub startup check failed:",problems);
 return problems.length===0;
}
function safetyHubIntegrityCheck(){
 const required={
   getSelectedPermits:typeof getSelectedPermits==="function",
   selected:typeof selected==="function",
   applyChecklistHazards:typeof applyChecklistHazards==="function",
   checklistCandidates:typeof checklistCandidates==="function",
   plannerSupplementCandidates:typeof plannerSupplementCandidates==="function",
   finalHazardRows:typeof finalHazardRows==="function",
   reviewPTP:typeof reviewPTP==="function",
   generatePTP:typeof generatePTP==="function",
   getSteps:typeof getSteps==="function"
 };
 const missing=Object.entries(required).filter(([,ok])=>!ok).map(([name])=>name);
 if(missing.length)console.error("Safety Hub integrity check failed:",missing);
 return {ok:missing.length===0,missing};
}


/* BUILD v21 · NOAA/NWS compact safety weather for San Antonio */
const WX_POINT={lat:29.4241,lon:-98.4936};
const WX_REFRESH_MS=10*60*1000;
const CDI_LIVE_WEATHER={temp:null,heatIndex:null,wind:null,rain:false,lightningRisk:false,lightningAlert:false,severe:false,updated:null};
function wxSetAdvice(cellId,adviceId,text){const cell=wxE(cellId),ad=wxE(adviceId);if(!cell||!ad)return;ad.textContent=text||'';cell.classList.toggle('has-advice',!!text)}
function wxUpdateSafetyAdvice(){
 const w=CDI_LIVE_WEATHER;
 wxSetAdvice('wxTempCell','wxTempAdvice',Number.isFinite(w.temp)&&w.temp<=40?'Cold stress: dress in layers, keep dry and take warm-up breaks. Watch for shivering or numbness.':'');
 wxSetAdvice('wxHeatCell','wxHeatAdvice',Number.isFinite(w.heatIndex)&&w.heatIndex>=103?'High heat: drink water often, use shade or A/C for recovery breaks and watch the crew for heat illness.':Number.isFinite(w.heatIndex)&&w.heatIndex>=90?'Heat caution: hydrate often and take recovery breaks in shade or a cool area.':'');
 wxSetAdvice('wxWindCell','wxWindAdvice',Number.isFinite(w.wind)&&w.wind>=28?'High wind: check the MEWP manufacturer and project wind limits before elevating; secure loose material.':Number.isFinite(w.wind)&&w.wind>=20?'Wind caution: check MEWP wind limits and secure loose material before elevated work.':'');
 wxSetAdvice('wxLightningCell','wxLightningAdvice',w.lightningAlert?'Thunderstorm alert: follow the project lightning stand-down procedure and stop exposed/elevated work when required.':w.lightningRisk?'Lightning risk: monitor the project stand-down system and be ready to stop exposed/elevated work.':'');
 wxSetAdvice('wxAlertCell','wxAlertAdvice',w.rain?'Rain/wet conditions: watch slick surfaces, slow down when driving and reassess outdoor equipment use.':w.severe?'Review the active NWS alert and project emergency/weather procedure before affected work.':'');
}
function weatherOutdoorContext(text=''){const all=(String(text)+' '+(E('taskName')?.value||'')+' '+(typeof plannerAll==='function'?plannerAll().join(' '):'')).toLowerCase();return /outdoor|outside|roof|parking|lot|osp|underground|trench|manhole|exterior|drive|vehicle|loading dock|yard|site/.test(all)}
function weatherLiftContext(text=''){const all=(String(text)+' '+(typeof plannerAll==='function'?plannerAll().join(' '):'')).toLowerCase();return /lift|mewp|scissor|boom|aerial|elevat/.test(all)}
function weatherDrivingContext(text=''){const all=String(text).toLowerCase();return /drive|driving|vehicle|travel|road|jobsite/.test(all)}
function liveWeatherHazards(text){
 if(window.CDIWeather)return window.CDIWeather.forecastHazards(text,CDI_LIVE_WEATHER);
 const w=CDI_LIVE_WEATHER,out=[],outdoor=weatherOutdoorContext(text),lift=weatherLiftContext(text),driving=weatherDrivingContext(text);
 if(outdoor&&Number.isFinite(w.heatIndex)&&w.heatIndex>=90)out.push({hazard:'Heat stress / heat illness',control:'Provide frequent water and recovery breaks in shade or a cooled area; monitor workers for heat illness and increase precautions as heat exposure rises.',source:'Current weather · NWS',selected:true,required:true,custom:false,weatherAdded:true,tags:['heat','weather']});
 if(lift&&Number.isFinite(w.wind)&&w.wind>=20)out.push({hazard:'Wind affects MEWP stability and elevated work',control:'Check sustained wind and gusts against the MEWP manufacturer and project limits before elevating; secure loose materials and lower or stop work when safe limits are exceeded.',source:'Current weather · NWS',selected:true,required:true,custom:false,weatherAdded:true,tags:['wind','lift','weather']});
 if((outdoor||lift)&&(w.lightningRisk||w.lightningAlert))out.push({hazard:'Lightning / thunderstorm exposure',control:'Follow the project lightning stand-down procedure. Stop exposed outdoor or elevated work when required, move to safe shelter, and resume only after the project all-clear requirement is met.',source:'Current weather · NWS',selected:true,required:true,custom:false,weatherAdded:true,tags:['lightning','weather','stand-down']});
 if(w.rain&&(outdoor||lift||driving))out.push({hazard:'Rain / wet surfaces / reduced visibility',control:driving?'Slow down, increase following distance and allow more stopping room. Reassess travel if visibility or road conditions become unsafe.':'Watch for slick surfaces and reduced visibility; stop or reassess exposed work if controls are no longer effective.',source:'Current weather · NWS',selected:true,required:true,custom:false,weatherAdded:true,tags:['rain','weather','slip']});
 return out}
function mergeWeatherHazards(base,text){const out=[...base];for(const h of liveWeatherHazards(text)){const k=h.hazard.toLowerCase();if(!out.some(x=>String(x.hazard||'').toLowerCase()===k))out.push(h)}return out}

function wxE(id){return document.getElementById(id)}
function wxText(id,val){const el=wxE(id);if(el)el.textContent=val}
function wxWindNumber(v){const m=String(v||'').match(/(\d+(?:\.\d+)?)/);return m?Number(m[1]):null}
function wxHeatIndexF(t,rh){
  if(!Number.isFinite(t)||!Number.isFinite(rh)||t<80||rh<40)return t;
  let hi=-42.379+2.04901523*t+10.14333127*rh-.22475541*t*rh-.00683783*t*t-.05481717*rh*rh+.00122874*t*t*rh+.00085282*t*rh*rh-.00000199*t*t*rh*rh;
  if(rh<13&&t>=80&&t<=112)hi-=((13-rh)/4)*Math.sqrt((17-Math.abs(t-95))/17);
  if(rh>85&&t>=80&&t<=87)hi+=((rh-85)/10)*((87-t)/5);
  return hi;
}
function wxHeatLabel(hi){if(hi>=125)return 'Extreme danger';if(hi>=103)return 'Danger';if(hi>=90)return 'Extreme caution';if(hi>=80)return 'Caution';return 'Field heat'}
function wxAlertSeverity(features){
 const rank={Extreme:4,Severe:3,Moderate:2,Minor:1,Unknown:0};
 return [...features].sort((a,b)=>(rank[b.properties?.severity]||0)-(rank[a.properties?.severity]||0))[0]||null;
}
async function wxJson(url){const r=await fetch(url,{headers:{Accept:'application/geo+json'}});if(!r.ok)throw new Error('Weather request '+r.status);return r.json()}
async function loadSafetyWeather(){
 const bar=wxE('weatherBar');if(!bar)return;
 try{
   const pointUrl=`https://api.weather.gov/points/${WX_POINT.lat},${WX_POINT.lon}`;
   const point=await wxJson(pointUrl);
   const forecastUrl=point.properties?.forecast;
   const hourlyUrl=point.properties?.forecastHourly;
   if(!forecastUrl||!hourlyUrl)throw new Error('NWS forecast link unavailable');
   const [hourly,daily,alerts]=await Promise.all([
     wxJson(hourlyUrl),wxJson(forecastUrl),wxJson(`https://api.weather.gov/alerts/active?point=${WX_POINT.lat},${WX_POINT.lon}`)
   ]);
   const now=hourly.properties?.periods?.[0]||{};
   const temp=Number(now.temperature);
   const rh=Number(now.relativeHumidity?.value);
   const hi=wxHeatIndexF(temp,rh);
   wxText('wxTemp',Number.isFinite(temp)?`${Math.round(temp)}°F`:'--°F');
   wxText('wxCond',now.shortForecast||'Current conditions');
   wxText('wxHeat',Number.isFinite(hi)?`${Math.round(hi)}°F`:'--°F');
   wxText('wxHeatSub',Number.isFinite(hi)?wxHeatLabel(hi):'Field heat');
   const w=wxWindNumber(now.windSpeed);
   wxText('wxWind',w!==null?`${Math.round(w)} mph`:(now.windSpeed||'-- mph'));
   wxText('wxWindDir',now.windDirection||'Wind');
   const periods=hourly.properties?.periods||[];
   const thunderSoon=periods.slice(0,12).find(p=>/thunder|lightning/i.test(`${p.shortForecast||''} ${p.detailedForecast||''}`));
   const rainNow=/rain|showers|drizzle|thunderstorm|precip/i.test(`${now.shortForecast||''} ${now.detailedForecast||''}`);
   const features=alerts.features||[];
   const lightningAlert=features.find(f=>/thunderstorm|lightning/i.test(`${f.properties?.event||''} ${f.properties?.headline||''}`));
   if(lightningAlert){wxText('wxLightning','⚡ ALERT');wxText('wxLightningSub',lightningAlert.properties?.event||'Thunderstorm alert')}
   else if(thunderSoon){wxText('wxLightning','⚡ RISK');wxText('wxLightningSub',`Thunder possible ${thunderSoon.name||'soon'}`)}
   else{wxText('wxLightning','● LOW');wxText('wxLightningSub','No thunder signal next 12h')}
   const top=wxAlertSeverity(features);
   if(top){wxText('wxAlert',top.properties?.event||'Weather alert');wxText('wxAlertSub',top.properties?.severity?`${top.properties.severity} · NWS`:'Official NWS alert')}
   else{wxText('wxAlert','No active alerts');wxText('wxAlertSub','Official NWS alerts')}
   const dailyPeriods=daily.properties?.periods||[];
   const tomorrow=dailyPeriods.find((p,i)=>i>0&&p.isDaytime)||dailyPeriods[1];
   if(tomorrow){wxText('wxTomorrow',`${tomorrow.temperature}°F`);wxText('wxTomorrowSub',tomorrow.shortForecast||tomorrow.name||'Forecast')}
    const heatCell=wxE('wxHeatCell'),windCell=wxE('wxWindCell'),lightCell=wxE('wxLightningCell'),alertCell=wxE('wxAlertCell');
    [heatCell,windCell,lightCell,alertCell].forEach(el=>el&&el.classList.remove('wx-safe','wx-warning','wx-danger'));
    if(heatCell)heatCell.classList.add(hi>=103?'wx-danger':hi>=90?'wx-warning':'wx-safe');
    if(windCell)windCell.classList.add(w!==null&&w>=30?'wx-danger':w!==null&&w>=20?'wx-warning':'wx-safe');
    if(lightCell)lightCell.classList.add(lightningAlert?'wx-danger':thunderSoon?'wx-warning':'wx-safe');
    const severe=String(top?.properties?.severity||'');
    if(alertCell)alertCell.classList.add(['Extreme','Severe'].includes(severe)?'wx-danger':top?'wx-warning':'wx-safe');
    Object.assign(CDI_LIVE_WEATHER,{temp:Number.isFinite(temp)?temp:null,heatIndex:Number.isFinite(hi)?hi:null,wind:w,rain:!!rainNow,lightningRisk:!!thunderSoon,lightningAlert:!!lightningAlert,severe:['Extreme','Severe'].includes(severe),updated:Date.now()});
    if(window.CDIWeather)window.CDIWeather.ingest(periods,dailyPeriods,features);
    wxUpdateSafetyAdvice();
   bar.title=`San Antonio safety weather · NOAA/NWS · Updated ${new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}`;
 }catch(err){
   console.warn('Safety weather unavailable',err);
   wxText('wxCond','Weather unavailable');wxText('wxAlert','NWS unavailable');wxText('wxAlertSub','Will retry automatically');wxText('wxLightning','--');wxText('wxLightningSub','No strike data shown');
 }
}
loadSafetyWeather();
setInterval(loadSafetyWeather,WX_REFRESH_MS);


function ptpSafeFilePart(v){
 return String(v||'').trim().replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,' ').replace(/^\.+|\.+$/g,'').slice(0,70)||'PTP';
}
function ptpPdfFileName(){
 const lead=(E('jobLeader')?.value||E('foreman')?.value||'Lead').trim();
 const job=(E('jobNo')?.value||'Job').trim();
 const date=(E('dateStarted')?.value||new Date().toISOString().slice(0,10));
 return `${ptpSafeFilePart(lead)} - ${ptpSafeFilePart(job)} - ${ptpSafeFilePart(date)}.pdf`;
}

let _ptpHiResCache={sig:'',pages:[]};
let _ptpPdfReadyUrl='';
function ptpRenderSignature(){
 const parts=[];
 document.querySelectorAll('#preview .formcanvas').forEach((canvas,pi)=>{
   parts.push('P'+pi);
   canvas.querySelectorAll('.ovtext,.ovline').forEach(el=>parts.push(el.value ?? el.textContent ?? ''));
   canvas.querySelectorAll('.ovcheck').forEach(el=>parts.push(el.classList.contains('on')?'1':'0'));
 });
 return parts.join('\u241f');
}
function ptpNum(v){const n=parseFloat(v);return Number.isFinite(n)?n:0}
function ptpWrapCanvasText(ctx,text,maxWidth){
 const paras=String(text||'').replace(/\r/g,'').split('\n'),lines=[];
 for(const para of paras){
   const words=para.split(/\s+/).filter(Boolean);
   if(!words.length){lines.push('');continue}
   let line='';
   for(const word of words){
     const test=line?line+' '+word:word;
     if(line && ctx.measureText(test).width>maxWidth){lines.push(line);line=word}else line=test;
   }
   if(line)lines.push(line);
 }
 return lines;
}
async function composePTPPageNative(source,statusBtn,pageNo,total){
 const previewBg=source.querySelector(':scope > img');
 if(!previewBg)throw new Error('PTP page background is missing.');
 // v64: Save from the same verified form image shown in the preview. The old
 // embedded PNG save backgrounds were damaged, which left only overlay text
 // and X marks in the exported PDF on Safari/iPad and some desktop browsers.
 const hiSrc=previewBg.currentSrc||previewBg.src;
 const bg=new Image();
 bg.decoding='sync';
 bg.src=hiSrc;
 if(!bg.complete || !bg.naturalWidth)await new Promise((resolve,reject)=>{bg.addEventListener('load',resolve,{once:true});bg.addEventListener('error',()=>reject(new Error('PTP background could not load.')),{once:true})});
 if(bg.decode)await bg.decode().catch(()=>{});
 if(!bg.naturalWidth||!bg.naturalHeight)throw new Error('PTP background could not be decoded.');
 // Render at 300 DPI-equivalent letter landscape dimensions. The form image
 // is scaled up once, while entered text and check marks are drawn natively at
 // the full output size so they stay crisp.
 const W=3300,H=2550;
 const sx=W/1584,sy=H/1224;
 const c=document.createElement('canvas');c.width=W;c.height=H;
 const ctx=c.getContext('2d',{alpha:false});
 if(!ctx)throw new Error('This browser could not prepare the PTP page.');
 ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);
 ctx.imageSmoothingEnabled=true;
 ctx.imageSmoothingQuality='high';
 ctx.drawImage(bg,0,0,W,H);
 ctx.textBaseline='top';ctx.fillStyle='#050505';
 source.querySelectorAll('.ovline,.ovtext').forEach(el=>{
   const x=ptpNum(el.style.left),y=ptpNum(el.style.top),w=ptpNum(el.style.width),h=ptpNum(el.style.height);
   const fs=ptpNum(el.style.fontSize)||11;
   const align=(el.style.textAlign||'left').toLowerCase();
   const val=String(el.value||'');
   ctx.save();
   ctx.beginPath();ctx.rect(x*sx,y*sy,w*sx,h*sy);ctx.clip();
   ctx.font=`600 ${fs*sy}px Arial, Helvetica, sans-serif`;
   ctx.fillStyle='#050505';
   ctx.textAlign=align==='right'?'right':align==='center'?'center':'left';
   const pad=2*sx;
   const tx=ctx.textAlign==='right'?(x+w)*sx-pad:ctx.textAlign==='center'?(x+w/2)*sx:x*sx+pad;
   if(el.classList.contains('ovline')){
     const lineH=ptpNum(el.style.lineHeight)||Math.max(12,fs+3);
     const ty=y*sy + Math.max(0,(h-lineH)*sy/2);
     ctx.fillText(val,tx,ty,w*sx-pad*2);
   }else{
     const maxW=w*sx-pad*2;
     const lines=ptpWrapCanvasText(ctx,val,maxW);
     const lh=fs*1.06*sy;
     let ty=y*sy;
     const maxLines=Math.max(1,Math.floor((h*sy)/lh));
     for(let i=0;i<Math.min(lines.length,maxLines);i++)ctx.fillText(lines[i],tx,ty+i*lh,maxW);
   }
   ctx.restore();
 });
 source.querySelectorAll('.ovcheck.on').forEach(el=>{
   const x=(ptpNum(el.style.left)+9)*sx,y=(ptpNum(el.style.top)+9)*sy;
   const r=7*Math.min(sx,sy);
   ctx.save();ctx.strokeStyle='#000';ctx.lineWidth=Math.max(2,1.6*Math.min(sx,sy));ctx.lineCap='round';
   ctx.beginPath();ctx.moveTo(x-r,y-r);ctx.lineTo(x+r,y+r);ctx.moveTo(x+r,y-r);ctx.lineTo(x-r,y+r);ctx.stroke();ctx.restore();
 });
 if(statusBtn)statusBtn.textContent=`Prepared page ${pageNo} of ${total}`;
 return c.toDataURL('image/png');
}
async function renderPTPPagesHiRes(statusBtn){
 const pages=[...document.querySelectorAll('#preview .formpage')];
 if(!pages.length)throw new Error('Generate the PTP before saving or printing.');
 const sig=ptpRenderSignature();
 if(_ptpHiResCache.sig===sig && _ptpHiResCache.pages.length===pages.length)return _ptpHiResCache.pages;
 const result=[];
 for(let i=0;i<pages.length;i++){
   if(statusBtn)statusBtn.textContent=`Building sharp page ${i+1} of ${pages.length}…`;
   const source=pages[i].querySelector('.formcanvas');
   if(!source)throw new Error(`PTP page ${i+1} is missing.`);
   result.push(await composePTPPageNative(source,statusBtn,i+1,pages.length));
 }
 _ptpHiResCache={sig,pages:result};
 return result;
}
async function buildPTPPdf(statusBtn){
 if(!window.jspdf?.jsPDF)throw new Error('The PDF tool is still loading. Wait a few seconds and try again.');
 const pageImages=await renderPTPPagesHiRes(statusBtn);
 const {jsPDF}=window.jspdf;
 const pdf=new jsPDF({orientation:'landscape',unit:'in',format:'letter',compress:false,putOnlyUsedFonts:true});
 pageImages.forEach((img,i)=>{
   if(i>0)pdf.addPage('letter','landscape');
   pdf.addImage(img,'PNG',0,0,11,8.5,undefined,'NONE');
 });
 return pdf;
}
function closePdfReady(){document.getElementById('pdfReadyModal')?.remove()}
function showPdfReady(blob,filename){
 closePdfReady();
 if(_ptpPdfReadyUrl)URL.revokeObjectURL(_ptpPdfReadyUrl);
 _ptpPdfReadyUrl=URL.createObjectURL(blob);
 const wrap=document.createElement('div');wrap.id='pdfReadyModal';wrap.className='pdf-ready-backdrop no-print';
 const card=document.createElement('div');card.className='pdf-ready-card';
 const title=document.createElement('h3');title.textContent='PDF ready';
 const p=document.createElement('p');p.textContent='Your full-resolution 3-page PTP is ready. Tap Download PDF to save it.';
 const actions=document.createElement('div');actions.className='pdf-ready-actions';
 const a=document.createElement('a');a.className='btn primary';a.href=_ptpPdfReadyUrl;a.download=filename;a.textContent='Download PDF';
 const close=document.createElement('button');close.className='btn ghost';close.type='button';close.textContent='Close';close.onclick=closePdfReady;
 actions.append(a,close);card.append(title,p,actions);wrap.append(card);document.body.append(wrap);
 wrap.addEventListener('click',e=>{if(e.target===wrap)closePdfReady()});
}
async function downloadPTPPDF(btn){
 const old=btn?.textContent;
 try{
   if(btn){btn.disabled=true;btn.textContent='Preparing PDF…'}
   const pdf=await buildPTPPdf(btn);
   showPdfReady(pdf.output('blob'),ptpPdfFileName());
 }catch(err){console.error(err);alert('PDF could not be prepared: '+err.message)}
 finally{if(btn){btn.disabled=false;btn.textContent=old}}
}
function mountHiResPrint(pageImages){
 let host=document.getElementById('ptpHiResPrint');
 if(!host){host=document.createElement('div');host.id='ptpHiResPrint';document.body.appendChild(host)}
 host.innerHTML='';
 pageImages.forEach((src,i)=>{const page=document.createElement('div');page.className='ptpPrintPage';const img=document.createElement('img');img.src=src;img.alt=`PTP page ${i+1}`;page.appendChild(img);host.appendChild(page)});
 return host;
}
async function printPTP(btn){
 const old=btn?.textContent;
 try{
   if(btn){btn.disabled=true;btn.textContent='Preparing print…'}
   const pageImages=await renderPTPPagesHiRes(btn);
   const host=mountHiResPrint(pageImages);
   await Promise.all([...host.querySelectorAll('img')].map(img=>img.decode?img.decode().catch(()=>{}):Promise.resolve()));
   document.body.classList.add('ptp-hires-print');
   await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
   const cleanup=()=>{document.body.classList.remove('ptp-hires-print');window.removeEventListener('afterprint',cleanup)};
   window.addEventListener('afterprint',cleanup);
   window.print();
   setTimeout(()=>document.body.classList.remove('ptp-hires-print'),5000);
 }catch(err){console.error(err);document.body.classList.remove('ptp-hires-print');alert('Print could not be prepared: '+err.message)}
 finally{setTimeout(()=>{if(btn){btn.disabled=false;btn.textContent=old}},700)}
}

const PTP_DRAFT_KEY='cdiSafetyHubPTPDraft_v33';
let _draftTimer=null,_draftRestoring=false;
function schedulePTPDraftSave(){
 if(_draftRestoring)return;
 clearTimeout(_draftTimer);
 _draftTimer=setTimeout(savePTPDraft,120);
}
function draftHasContent(d){
 if(!d)return false;
 const f=d.fields||{};
 return !!((d.crew&&d.crew.length)||(d.steps&&d.steps.length)||Object.entries(f).some(([k,v])=>k!=='company'&&String(v||'').trim()));
}
function collectQState(){
 const out={};
 document.querySelectorAll('#ptp .qcat[data-q]').forEach(cat=>{
   const q=cat.dataset.q,mode=cat.querySelector('.qseg input:checked')?.value||'';
   const picks=[...cat.querySelectorAll('.qdetail input[type="checkbox"]:checked')].map(x=>x.value);
   out[q]={mode,picks};
 });
 return out;
}
function collectPTPFields(){
 captureChecklistTextState();
 const out={};
 document.querySelectorAll('#ptp input[id],#ptp textarea[id],#ptp select[id]').forEach(el=>{
   if(el.id==='crewInput'||el.id.startsWith('manual')||el.id.startsWith('form'))return;
   if(el.type==='checkbox'||el.type==='radio')return;
   out[el.id]=el.value;
 });
 out.workHeight=checklistTextState.workHeight||out.workHeight||"";
 out.ladderHeight=checklistTextState.ladderHeight||out.ladderHeight||"";
 return out;
}
function savePTPDraft(){
 if(window.__ptpResetInProgress)return;
 try{
   const stepData=stepCards().map(c=>({text:c.querySelector('textarea')?.value||'',hazards:JSON.parse(JSON.stringify(selections[c.dataset.id]||[]))}));
   const d={
     ts:Date.now(),currentStep:currentPTPStep,wasInPTP:!!E('ptp')&&!E('ptp').classList.contains('hidden'),
     fields:collectPTPFields(),crew:[...crew],steps:stepData,answers:{...answers},qState:collectQState(),
     permits:[...document.querySelectorAll('#permits input:checked')].map(x=>x.value),sequenceConfirmed:!!sequenceConfirmed
   };
   if(draftHasContent(d))sessionStorage.setItem(PTP_DRAFT_KEY,JSON.stringify(d));
 }catch(err){console.warn('PTP draft save skipped',err)}
}
function applyDraftFields(d){
 if(!d||!d.fields)return;
 if(Object.prototype.hasOwnProperty.call(d.fields,"workHeight"))checklistTextState.workHeight=d.fields.workHeight??"";
 if(Object.prototype.hasOwnProperty.call(d.fields,"ladderHeight"))checklistTextState.ladderHeight=d.fields.ladderHeight??"";
 Object.entries(d.fields).forEach(([id,v])=>{const el=E(id);if(el&&el.type!=='checkbox'&&el.type!=='radio')el.value=v??''});
 bindChecklistTextState();
 Object.entries(d.answers||{}).forEach(([name,v])=>{const r=document.querySelector(`#ptp input[name="${CSS.escape(name)}"][value="${CSS.escape(String(v))}"]`);if(r)r.checked=true});
}
function restorePTPDraft(){
 let d=null;
 try{d=JSON.parse(sessionStorage.getItem(PTP_DRAFT_KEY)||'null')}catch(_){return false}
 if(!draftHasContent(d))return false;
 _draftRestoring=true;_restoredDraft=d;
 try{
   applyDraftFields(d);
   crew.splice(0,crew.length,...(d.crew||[]));renderCrew();
   Object.keys(answers).forEach(k=>delete answers[k]);Object.assign(answers,d.answers||{});
   document.querySelectorAll('#ptp .qcat[data-q]').forEach(cat=>{
     const st=d.qState?.[cat.dataset.q];if(!st)return;
     const r=cat.querySelector(`.qseg input[value="${CSS.escape(st.mode||'')}"]`);if(r){r.checked=true;toggleQ(r)}
     cat.querySelectorAll('.qdetail input[type="checkbox"]').forEach(cb=>cb.checked=(st.picks||[]).includes(cb.value));
   });
   document.querySelectorAll('#permits input[type="checkbox"]').forEach(cb=>cb.checked=(d.permits||[]).includes(cb.value));
   if(d.steps&&d.steps.length){
     E('steps').innerHTML='';Object.keys(selections).forEach(k=>delete selections[k]);sid=0;
     d.steps.forEach(st=>{const id=createStep(st.text||'');selections[id]=JSON.parse(JSON.stringify(st.hazards||[]));renderHazards(id)});
     renumber();
     sequenceConfirmed=!!d.sequenceConfirmed;sequenceTouched=sequenceConfirmed;
     if(sequenceConfirmed){expectedSequence=stepCards().map(c=>c.dataset.id);updateSequenceHighlights()}
   }
   currentPTPStep=Math.max(1,Math.min(5,Number(d.currentStep)||1));
   if(d.wasInPTP){showView('ptp');go(currentPTPStep)}
   return true;
 }catch(err){console.warn('PTP draft restore skipped',err);return false}
 finally{_draftRestoring=false}
}
function clearPTPDraft(){try{sessionStorage.removeItem(PTP_DRAFT_KEY)}catch(_){}}
const PTP_RESET_GUARD_KEY='cdiSafetyHubPTPResetPending_v46';
function hardClearPTPStorage(){
  const exactKeys=[PTP_DRAFT_KEY,'cdiSafetyHubPTPDraft_v34','cdiSafetyHubPTPDraft_v36','cdiSafetyHubScopeConfirmed_v34'];
  try{exactKeys.forEach(k=>sessionStorage.removeItem(k))}catch(_){}
  try{exactKeys.forEach(k=>localStorage.removeItem(k))}catch(_){}
}
// If a previous reset reload triggered Safari/pagehide autosave, clear that resurrected draft before restore runs.
try{
  if(sessionStorage.getItem(PTP_RESET_GUARD_KEY)==='1'){
    window.__ptpResetInProgress=true;
    hardClearPTPStorage();
    sessionStorage.removeItem(PTP_RESET_GUARD_KEY);
  }
}catch(_){}
function resetApp(){
  if(!confirm("Clear this PTP and start over?"))return;
  window.__ptpResetInProgress=true;
  clearTimeout(_draftTimer);
  try{sessionStorage.setItem(PTP_RESET_GUARD_KEY,'1')}catch(_){}
  hardClearPTPStorage();
  // Use replace so the browser Back button cannot reopen the completed PTP state.
  location.replace(location.href);
}

// Keep the draft alive through Safari/iPad PDF navigation, browser Back, refreshes and print dialogs.
const _ptpRoot=E('ptp');
if(_ptpRoot){
 ['input','change','click'].forEach(evt=>_ptpRoot.addEventListener(evt,()=>schedulePTPDraftSave()));
 _ptpRoot.addEventListener('pointerup',()=>schedulePTPDraftSave());
}
window.addEventListener('pagehide',savePTPDraft);
window.addEventListener('beforeprint',savePTPDraft);
window.addEventListener('pageshow',e=>{if(e.persisted&&!draftHasContent(_restoredDraft))restorePTPDraft()});
setTimeout(()=>{if(typeof initQuestionnaire==="function")initQuestionnaire();restorePTPDraft()},0);

// ===== v35 COUNCIL UPGRADE =====
// Safety language is compressed only by removing filler; critical actions/conditions are preserved.
const V34_DRAFT_KEY='cdiSafetyHubPTPDraft_v34';
let v34ScopeConfirmed=false;
let v35QualityUnlocked=false;
let v35Generated=false;
const V34_CRITICAL_TERMS=['energized','electrical','arc flash','loto','lockout','zero energy','fall','mewp','lift','ladder','confined','silica','excavation','trench','hot work','rigging','hoist','suspended load','traffic','vehicle'];

function conciseControl(text){
 let s=String(text||'').trim();
 const reps=[
  [/\bEmployees? (?:shall|must) ensure (?:that )?/gi,''],
  [/\bEnsure (?:that )?/gi,''],
  [/\bPrior to (?:beginning|starting) (?:the )?(?:task|work),?\s*/gi,'Before work, '],
  [/\bBefore beginning (?:the )?(?:task|work),?\s*/gi,'Before work, '],
  [/\bIn order to\s+/gi,'to '],
  [/\bAt all times\b/gi,''],
  [/\bwhen applicable\b/gi,'as applicable'],
  [/\bpersonnel\b/gi,'workers'],
  [/\butilize\b/gi,'use'],
  [/\bappropriate\b/gi,'required'],
  [/\bproperly\b/gi,''],
  [/\bthe work area\b/gi,'area'],
  [/\bwork area\b/gi,'area'],
  [/\bshall\b/gi,'must'],
 ];
 reps.forEach(([a,b])=>s=s.replace(a,b));
 s=s.replace(/\s+/g,' ').replace(/\s*;\s*/g,'; ').replace(/\s+,/g,',').trim();
 // compact common phrases without deleting the control itself
 s=s.replace(/Maintain three points? of contact/gi,'Maintain 3-point contact')
    .replace(/personal protective equipment/gi,'PPE')
    .replace(/fall protection equipment/gi,'fall-protection gear')
    .replace(/lockout\/tagout/gi,'LOTO')
    .replace(/mechanical assistance/gi,'mechanical aid')
    .replace(/extension cords? and plugs?/gi,'cords/plugs')
    .replace(/manufacturer(?:'s)? instructions/gi,'manufacturer instructions');
 return cleanFinalLine(s);
}

function v34Severity(h){
 const b=((h?.hazard||'')+' '+(h?.control||'')+' '+(h?.tags||[]).join(' ')).toLowerCase();
 if(V34_CRITICAL_TERMS.some(x=>b.includes(x))) return 3;
 if(/pinch|line.of.fire|cut|sharp|overhead|dropped|manual handling|power tool|drill|chemical|heat/.test(b)) return 2;
 return 1;
}
function v34HazardKey(s){return String(s||'').toLowerCase().replace(/\b(the|a|an|from|with|and|or|of|to|in|on|at|for)\b/g,' ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim()}
function v34NearDup(a,b){
 const A=new Set(v34HazardKey(a).split(' ').filter(x=>x.length>3)),B=new Set(v34HazardKey(b).split(' ').filter(x=>x.length>3));
 if(!A.size||!B.size)return false;let hit=0;A.forEach(x=>{if(B.has(x))hit++});return hit/Math.min(A.size,B.size)>=.72;
}

// Override packing with severity-first ranking + concise controls + semantic-ish duplicate suppression.
function finalHazardRows(){
 const steps=getSteps(),pool=[],seen=new Set();
 function addCandidate(stepNo,stepText,h,priority=0){
  if(!h||!h.hazard||!h.control)return;
  const hz=cleanFinalLine(h.hazard),ctl=conciseControl(h.control),exact=(hz+'|'+ctl).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  if(seen.has(exact))return;seen.add(exact);
  const sev=v34Severity(h);
  pool.push({stepNo,stepText,hazard:hz,control:ctl,source:h.source||'Safety Hub',family:hazardFamily(h),priority:priority+sev*1000,severity:sev});
 }
 steps.forEach((st,i)=>selected(st.id).forEach(h=>addCandidate(i+1,st.text,h,h.required?10000:120)));
 steps.forEach((st,i)=>recommend(st.text).slice(0,24).forEach((h,j)=>addCandidate(i+1,st.text,h,104-j*.18)));
 checklistCandidates().forEach((h,j)=>addCandidate(1,steps[0]?.text||'',h,112-j*.10));
 plannerSupplementCandidates().forEach((h,j)=>addCandidate((j%Math.max(1,steps.length))+1,steps[j%Math.max(1,steps.length)]?.text||'',h,108-j*.08));
 if(steps.length)addCandidate(steps.length,steps[steps.length-1].text,{hazard:'Residual trip, debris, sharp scrap, tools, cords or incomplete work-area restoration',control:'Remove tools, cords and scrap; restore covers/tiles; clear access routes; leave area safe.',source:'Closeout'},98);
 pool.sort((a,b)=>b.priority-a.priority);
 const chosen=[],fam={};
 for(const r of pool){
  if(chosen.some(x=>isNearDuplicateHazard(x,r)||v34NearDup(x.hazard,r.hazard)))continue;
  if((fam[r.family]||0)>=6&&chosen.length<24)continue;
  const trial=[...chosen,r];
  const trialHaz=trial.map(x=>cleanFinalLine(x.hazard)).join('; ')+(trial.length?'.':'');
  const trialCtl=trial.map(x=>conciseControl(x.control)).join('; ')+(trial.length?'.':'');
  if(splitDenseText(trialHaz,74,46).length>45||splitDenseText(trialCtl,78,46).length>45)continue;
  chosen.push(r);fam[r.family]=(fam[r.family]||0)+1;if(chosen.length>=70)break;
 }
 const stepText=steps.map((st,i)=>`${i+1}. ${cleanFinalLine(st.text)}.`).join(' ');
 const stepLines=splitDenseText(stepText,72,45),hazLines=splitDenseText(chosen.map(r=>r.hazard).join('; ')+(chosen.length?'.':''),74,45),ctlLines=splitDenseText(chosen.map(r=>r.control).join('; ')+(chosen.length?'.':''),78,45);
 const rows=[];for(let i=0;i<45;i++)rows.push({step:stepLines[i]||'',haz:hazLines[i]||'',ctl:ctlLines[i]||''});return rows;
}

function v34Has(term){return ((E('taskName')?.value||'')+' '+getSteps().map(x=>x.text).join(' ')+' '+qValues().join(' ')+' '+getSelectedPermits().join(' ')).toLowerCase().includes(term)}
function v34QualityIssues(){
 captureChecklistTextState();
 const issues=[],steps=getSteps(),task=(E('taskName')?.value||'').toLowerCase(),q=qValues(),perm=getSelectedPermits().map(x=>x.toLowerCase());
 const add=(level,text)=>issues.push({level,text});
 if(!E('jobNo')?.value.trim())add('warn','Job number is missing.');
 if(!E('jobLeader')?.value.trim()&&!E('foreman')?.value.trim())add('warn','Job leader / foreman is missing.');
 if(!crew.length)add('warn','No crew members are listed.');
 if(!steps.length)add('critical','No work steps have been built.');
 if(steps.some(s=>!selected(s.id).length))add('critical','One or more work steps have no selected hazards.');
 if(steps.length>1&&!sequenceConfirmed)add('warn','Work-step sequence has not been confirmed.');
 const height=task.match(/\b(1[0-9]|2[0-9]|3[0-9])\s*(?:ft|feet|foot|')\b/);
 const access=(q.some(x=>/ladder|lift|mewp|scaffold/.test(x))||/ladder|lift|mewp|scaffold/.test(task));
 if(height&&!access)add('critical',`Work appears to be at ${height[1]} ft but no clear access method is identified.`);
 const ladderMention=/ladder/.test(task+' '+q.join(' '));
 if(ladderMention&&!String(checklistFieldValue('ladderHeight')||'').trim())add('warn','Ladder work is indicated but ladder height is blank.');
 if(/drill|anchor|core|penetrat/.test(task+' '+q.join(' '))&&!q.some(x=>/drill|power|tool/.test(x)))add('warn','Drilling/penetration is described; verify power-tool/penetration controls are addressed.');
 if(/energized|panel|electrical|power/.test(task)&&!perm.some(x=>/electrical|energized/.test(x))&&!answers.lotoreq)add('critical','Electrical/energized language appears in the scope; verify electrical authorization, isolation/LOTO, and permit requirements.');
 if(/mewp|boom lift|scissor lift/.test(task+' '+q.join(' '))&&!selectedBlob().toLowerCase().includes('fall'))add('critical','MEWP/lift work is indicated but fall-protection controls are not evident.');
 if(v34ScopeConfirmed===false&&steps.length)add('warn','Scope completeness has not been confirmed.');
 return issues;
}
function v34ScopeSummary(){const s=getSteps().map((x,i)=>`${i+1}. ${x.text}`).filter(Boolean);return s.length?s.join(' • '):'Build the work plan to see the complete scope here.'}
function v34ScopeReady(){const steps=getSteps();return !!(steps.length&&sequenceConfirmed&&steps.every(s=>selected(s.id).length>0))}
function v34ConfirmScope(){if(!v34ScopeReady()){alert('Finish building the work sequence, select the applicable hazards, and confirm the work-step order before confirming scope completeness.');return}v34ScopeConfirmed=true;updateV34Panel();schedulePTPDraftSave()}
function v34ToggleInfo(btn){btn.nextElementSibling?.classList.toggle('open')}

function v34Completion(){
 const job=!!(E('jobNo')?.value.trim()&&E('taskName')?.value.trim()&&(E('jobLeader')?.value.trim()||E('foreman')?.value.trim()));
 const crewDone=crew.length>0;
 const workReady=v34ScopeReady();
 const workDone=workReady&&v34ScopeConfirmed;
 const checklistDone=(currentPTPStep>=5||v35QualityUnlocked);
 const reviewDone=v35Generated;
 const checks=[job,crewDone,workDone,checklistDone,reviewDone];
 const pct=Math.round(checks.filter(Boolean).length/checks.length*100);
 return {checks,pct};
}
function updateV34Panel(){
 const panel=E('v34CouncilPanel');if(!panel)return;
 const c=v34Completion(),ready=v34ScopeReady();
 E('v34ProgressFill').style.width=c.pct+'%';
 const labels=['Job Info','Crew','Work Steps','Checklist','Review'];
 E('v34ProgressCopy').innerHTML=`<strong>${c.pct}% complete</strong> · Working on ${labels[Math.max(0,Math.min(4,(currentPTPStep||1)-1))]}`;
 [...panel.querySelectorAll('.stage-pill')].forEach((x,i)=>{x.classList.toggle('done',!!c.checks[i]);x.classList.toggle('active',!c.checks[i]&&i===Math.max(0,Math.min(4,(currentPTPStep||1)-1)))});
 const scopeBox=E('v34ScopeConfirmBox'),scopeBtn=E('v34ScopeConfirmBtn'),qualityCard=E('v34QualityCard');
 if(scopeBox)scopeBox.style.display=(currentPTPStep===3?'block':'none');
 E('v34ScopeSummary').textContent=ready?v34ScopeSummary():'Finish the work plan and confirm the correct step order first. Your completed scope will appear here for one final confirmation.';
 if(scopeBox)scopeBox.classList.toggle('locked',!ready);
 if(scopeBtn)scopeBtn.disabled=!ready;
 E('v34ScopeState').textContent=v34ScopeConfirmed?'✓ Scope confirmed':(ready?'Ready for final scope confirmation':'Available after work sequence is complete');
 E('v34ScopeState').className=v34ScopeConfirmed?'scope-ok':'';
 const showQuality=(currentPTPStep>=5||v35QualityUnlocked);
 if(qualityCard)qualityCard.style.display=showQuality?'block':'none';
 const q=E('v34QualityList');
 if(showQuality){
   const issues=v34QualityIssues();
   q.innerHTML=issues.length?issues.slice(0,6).map(x=>`<div class="quality-item ${x.level}">${esc(x.text)}</div>`).join(''):'<div class="quality-item good">✓ Safety quality check passed.</div>';
 }
}
function installV34Panel(){
 const s1=E('s1');if(!s1||E('v34CouncilPanel'))return;
 const nav=document.querySelector('#ptp .progress');if(nav)nav.classList.add('sticky-ptp-nav');
 const div=document.createElement('div');div.id='v34CouncilPanel';div.className='council-dashboard no-print';
 div.innerHTML=`<div class="council-card"><h3>PTP completion</h3><div class="progress-shell"><div id="v34ProgressFill" class="progress-fill"></div></div><div id="v34ProgressCopy" class="progress-copy"></div><div class="stage-pills"><span class="stage-pill">Job</span><span class="stage-pill">Crew</span><span class="stage-pill">Work</span><span class="stage-pill">Checklist</span><span class="stage-pill">Review</span></div></div><div id="v34QualityCard" class="council-card"><h3>Final safety check</h3><div id="v34QualityList" class="quality-list"></div></div>`;
 s1.parentNode.insertBefore(div,s1);
 // v55: autosave stays active in the background; no floating badge.
 // Context explanations for high-value checklist topics, without using PDF space.
 const tips=[['Ladder Safety Checklist','Ladder details help the generator verify access, setup, inspection, and fall exposure.'],['LOTO','LOTO means identify energy sources, isolate, lock/tag, dissipate stored energy, and verify zero energy before affected work.'],['Fall','Fall-protection selections help make sure elevated-work hazards are not pushed off the PTP.']];
 document.querySelectorAll('.checksection h3,.qcat-name b').forEach(el=>{const hit=tips.find(([k])=>el.textContent.toLowerCase().includes(k.toLowerCase()));if(hit&&!el.querySelector('.info-tip')){const b=document.createElement('button');b.type='button';b.className='info-tip no-print';b.textContent='i';b.onclick=()=>v34ToggleInfo(b);const p=document.createElement('div');p.className='info-pop no-print';p.textContent=hit[1];el.appendChild(b);el.parentElement.appendChild(p)}});
 updateV34Panel();
}

// Persistent autosave: localStorage survives tab/browser closure. Import v33 session draft automatically.
const _v33SavePTPDraft=savePTPDraft;
savePTPDraft=function(){
 if(window.__ptpResetInProgress)return;
 _v33SavePTPDraft();
 try{const old=sessionStorage.getItem(PTP_DRAFT_KEY);if(old)localStorage.setItem(V34_DRAFT_KEY,old);localStorage.setItem('cdiSafetyHubScopeConfirmed_v34',v34ScopeConfirmed?'1':'0');}catch(e){console.warn('Persistent draft save skipped',e)}
};
const _v33Restore=restorePTPDraft;
restorePTPDraft=function(){
 try{if(!sessionStorage.getItem(PTP_DRAFT_KEY)){const p=localStorage.getItem(V34_DRAFT_KEY);if(p)sessionStorage.setItem(PTP_DRAFT_KEY,p)}v34ScopeConfirmed=localStorage.getItem('cdiSafetyHubScopeConfirmed_v34')==='1'}catch(e){}
 const ok=_v33Restore();setTimeout(updateV34Panel,0);return ok;
};
const _v33Clear=clearPTPDraft;
clearPTPDraft=function(){_v33Clear();try{localStorage.removeItem(V34_DRAFT_KEY);localStorage.removeItem('cdiSafetyHubScopeConfirmed_v34')}catch(e){}};

// Enrich review with council preflight and concise controls.
const _v33ReviewPTP=reviewPTP;
reviewPTP=function(){
 v35QualityUnlocked=true;
 _v33ReviewPTP();
 const box=E('review');if(!box)return;const issues=v34QualityIssues();
 if(issues.length){box.insertAdjacentHTML('afterbegin',`<div class="notice warn"><b>Council safety preflight:</b><ul>${issues.map(x=>`<li>${esc(x.text)}</li>`).join('')}</ul></div>`)}
 box.querySelectorAll('.reviewstep li').forEach(li=>{const br=li.querySelector('br');if(br&&br.nextSibling&&br.nextSibling.nodeType===3)br.nextSibling.nodeValue=conciseControl(br.nextSibling.nodeValue)});
 updateV34Panel();
};

const _v33GeneratePTP=generatePTP;
generatePTP=function(){
 v35QualityUnlocked=true;
 const critical=v34QualityIssues().filter(x=>x.level==='critical');
 if(critical.length){alert('Fix these critical PTP items before generating:\n\n• '+critical.map(x=>x.text).join('\n• '));go(Math.min(currentPTPStep||1,5));updateV34Panel();return}
 if(!v34ScopeConfirmed){alert('Confirm that the work-scope summary covers everything the crew will perform today before generating the PTP.');go(3);updateV34Panel();return}
 const result=_v33GeneratePTP();v35Generated=true;setTimeout(updateV34Panel,0);return result;
};

// Scope confirmation belongs to the completed work-plan state. If work-plan inputs change, require confirmation again.
document.addEventListener('input',(e)=>{if(e.target?.closest?.('#s3')&&v34ScopeConfirmed){v34ScopeConfirmed=false;try{localStorage.setItem('cdiSafetyHubScopeConfirmed_v34','0')}catch(_){}}});
document.addEventListener('change',(e)=>{if(e.target?.closest?.('#s3')&&v34ScopeConfirmed){v34ScopeConfirmed=false;try{localStorage.setItem('cdiSafetyHubScopeConfirmed_v34','0')}catch(_){}}});

// Keep panel current without making the worker press refresh.
document.addEventListener('input',()=>setTimeout(updateV34Panel,0));document.addEventListener('change',()=>setTimeout(updateV34Panel,0));document.addEventListener('click',()=>setTimeout(updateV34Panel,0));
setTimeout(()=>{installV34Panel();restorePTPDraft();updateV34Panel()},120);
console.info('CDI Safety Hub v35 Smart Progress + Review Timing loaded');

/* BUILD v36 - Stability + workflow regression fix (preserved in v37) */
const V36_DRAFT_KEY='cdiSafetyHubPTPDraft_v36';

// One bottom confirmation now verifies BOTH sequence and scope completeness.
const _v36BaseConfirmSequence=confirmSequence;
confirmSequence=function(){
  if(!sequenceIsCorrect()){
    alert('Fix the clear order issue shown above, then confirm the sequence.');
    return;
  }
  const steps=getSteps();
  if(!steps.length){alert('Build the work sequence first.');return;}
  if(steps.some(st=>!selected(st.id).length)){
    alert('Each work step needs at least one applicable hazard before the work sequence and scope can be confirmed.');
    return;
  }
  sequenceConfirmed=true;
  v34ScopeConfirmed=true;
  const st=E('sequenceStatus');
  if(st){st.textContent='✓ Work sequence & scope confirmed';st.classList.add('ok')}
  const b=E('confirmSequenceBtn');if(b)b.disabled=true;
  stepCards().forEach(c=>c.classList.remove('needs-reorder'));
  // Hazards were populated when the sequence was built. Preserve any edits made before confirmation.
  savePTPDraft();
  updateV34Panel();
};

continueFromWorkPlan=function(){
  if(!stepCards().length){alert('Build the work sequence first.');return;}
  if(!sequenceConfirmed||!v34ScopeConfirmed){
    alert('Confirm Work Sequence & Scope before continuing.');
    E('confirmSequenceBtn')?.scrollIntoView({behavior:'smooth',block:'center'});
    return;
  }
  go(4);
};

// Work-plan changes invalidate the combined confirmation, but do not show a second confirmation UI.
function v36InvalidateWorkConfirmation(){
  if(!sequenceConfirmed&&!v34ScopeConfirmed)return;
  sequenceConfirmed=false;v34ScopeConfirmed=false;
  const b=E('confirmSequenceBtn');if(b)b.disabled=!sequenceIsCorrect();
  updateSequenceHighlights();
  try{localStorage.setItem('cdiSafetyHubScopeConfirmed_v34','0')}catch(_){}
}
document.addEventListener('input',e=>{if(e.target?.closest?.('#s3'))v36InvalidateWorkConfirmation()});
document.addEventListener('change',e=>{if(e.target?.closest?.('#s3'))v36InvalidateWorkConfirmation()});

// Progress reflects workflow state, not a grade. Never shows 100% until the PTP is generated.
v34Completion=function(){
  const job=!!(E('jobNo')?.value.trim()&&E('taskName')?.value.trim()&&(E('jobLeader')?.value.trim()||E('foreman')?.value.trim()));
  const crewDone=crew.length>0;
  const workDone=!!(sequenceConfirmed&&v34ScopeConfirmed&&getSteps().length&&getSteps().every(s=>selected(s.id).length));
  const checklistDone=currentPTPStep>=5||v35QualityUnlocked||v35Generated;
  const reviewDone=!!v35Generated;
  const checks=[job,crewDone,workDone,checklistDone,reviewDone];
  const pct=reviewDone?100:checks.slice(0,4).filter(Boolean).length*20;
  return {checks,pct};
};

// Dashboard only carries progress while building; final safety check appears at Review.
const _v36UpdatePanel=updateV34Panel;
updateV34Panel=function(){
  _v36UpdatePanel();
  const scope=E('v34ScopeConfirmBox');if(scope)scope.remove();
  const quality=E('v34QualityCard');if(quality)quality.style.display=(currentPTPStep>=5||v35QualityUnlocked)?'block':'none';
};

// Robust cross-tab draft persistence: newest draft wins, including ladder/work heights.
function v36ReadDraft(key,store){
  try{return JSON.parse(store.getItem(key)||'null')}catch(_){return null}
}
const _v36BaseSave=savePTPDraft;
savePTPDraft=function(){
  if(window.__ptpResetInProgress)return;
  captureChecklistTextState();
  _v36BaseSave();
  try{
    const raw=sessionStorage.getItem(PTP_DRAFT_KEY);
    if(raw){
      const d=JSON.parse(raw);d.ts=Date.now();
      d.fields=d.fields||{};
      d.fields.workHeight=checklistFieldValue('workHeight')||checklistTextState.workHeight||'';
      d.fields.ladderHeight=checklistFieldValue('ladderHeight')||checklistTextState.ladderHeight||'';
      const encoded=JSON.stringify(d);
      sessionStorage.setItem(PTP_DRAFT_KEY,encoded);
      localStorage.setItem(V36_DRAFT_KEY,encoded);
      localStorage.setItem(V34_DRAFT_KEY,encoded);
    }
  }catch(e){console.warn('v36 persistent save skipped',e)}
};

const _v36BaseRestore=restorePTPDraft;
restorePTPDraft=function(){
  try{
    const session=v36ReadDraft(PTP_DRAFT_KEY,sessionStorage);
    const local=v36ReadDraft(V36_DRAFT_KEY,localStorage)||v36ReadDraft(V34_DRAFT_KEY,localStorage);
    const newest=(!session||((local?.ts||0)>(session?.ts||0)))?local:session;
    if(newest)sessionStorage.setItem(PTP_DRAFT_KEY,JSON.stringify(newest));
  }catch(e){console.warn('v36 draft merge skipped',e)}
  const ok=_v36BaseRestore();
  setTimeout(()=>{
    bindChecklistTextState();
    const lh=E('ladderHeight');if(lh&&checklistTextState.ladderHeight&&!lh.value)lh.value=checklistTextState.ladderHeight;
    const wh=E('workHeight');if(wh&&checklistTextState.workHeight&&!wh.value)wh.value=checklistTextState.workHeight;
    updateV34Panel();
  },0);
  return ok;
};

// Save height fields immediately instead of waiting for navigation/pagehide.
document.addEventListener('input',e=>{
  if(e.target?.id==='ladderHeight'||e.target?.id==='workHeight'){
    if(e.target.id==='ladderHeight')checklistTextState.ladderHeight=e.target.value||'';
    if(e.target.id==='workHeight')checklistTextState.workHeight=e.target.value||'';
    savePTPDraft();
  }
});
window.addEventListener('storage',e=>{
  if((e.key===V36_DRAFT_KEY||e.key===V34_DRAFT_KEY)&&e.newValue){
    try{
      const incoming=JSON.parse(e.newValue);const current=v36ReadDraft(PTP_DRAFT_KEY,sessionStorage);
      if((incoming?.ts||0)>(current?.ts||0)){sessionStorage.setItem(PTP_DRAFT_KEY,e.newValue)}
    }catch(_){}
  }
});

// Reset must clear every persistent draft key.
const _v36BaseClear=clearPTPDraft;
clearPTPDraft=function(){
  _v36BaseClear();
  try{localStorage.removeItem(V36_DRAFT_KEY);localStorage.removeItem(V34_DRAFT_KEY);localStorage.removeItem('cdiSafetyHubScopeConfirmed_v34')}catch(_){}
  try{sessionStorage.removeItem(V36_DRAFT_KEY);sessionStorage.removeItem(V34_DRAFT_KEY);sessionStorage.removeItem('cdiSafetyHubScopeConfirmed_v34')}catch(_){}
};

// BUILD v38 - cross-browser CDI Viewpoint portal handoff.
const CDI_DAILY_HUDDLE_PORTAL='https://cdiventuresinc-hff.viewpointforcloud.com/field/dailyhuddledashboard';
let _portalHandoffUrl='';
function closePortalHandoff(){
  document.getElementById('portalHandoffModal')?.remove();
  // Do not immediately revoke on close; a browser may still be completing the save.
  if(_portalHandoffUrl){const old=_portalHandoffUrl;_portalHandoffUrl='';setTimeout(()=>URL.revokeObjectURL(old),60000)}
}
function showPortalHandoff(blob,filename){
  document.getElementById('portalHandoffModal')?.remove();
  if(_portalHandoffUrl)URL.revokeObjectURL(_portalHandoffUrl);
  _portalHandoffUrl=URL.createObjectURL(blob);
  const wrap=document.createElement('div');wrap.id='portalHandoffModal';wrap.className='portal-handoff-backdrop no-print';
  const card=document.createElement('div');card.className='portal-handoff-card';
  const title=document.createElement('h3');title.textContent='PTP ready for CDI Portal';
  const intro=document.createElement('p');intro.textContent='Use these two steps. Your completed PTP stays open here while the CDI portal opens in another tab.';
  const actions=document.createElement('div');actions.className='portal-handoff-steps';
  const dl=document.createElement('a');dl.className='btn primary portal-handoff-action';dl.href=_portalHandoffUrl;dl.download=filename;dl.textContent='1. Download PTP';
  const portal=document.createElement('a');portal.className='btn portal-btn portal-handoff-action';portal.href=CDI_DAILY_HUDDLE_PORTAL;portal.target='_blank';portal.rel='noopener noreferrer';portal.textContent='2. Open CDI Portal ↗';
  const note=document.createElement('div');note.className='portal-handoff-note';note.textContent='After the portal opens, sign in and select the PTP you just downloaded.';
  const close=document.createElement('button');close.type='button';close.className='btn secondary portal-handoff-close';close.textContent='Done / Close';close.onclick=closePortalHandoff;
  actions.append(dl,portal);card.append(title,intro,actions,note,close);wrap.append(card);document.body.append(wrap);
  wrap.addEventListener('click',e=>{if(e.target===wrap)closePortalHandoff()});
}
async function uploadToCDIPortal(btn){
  const old=btn?.textContent;
  try{
    if(btn){btn.disabled=true;btn.textContent='Preparing PTP…'}
    const pdf=await buildPTPPdf(btn);
    showPortalHandoff(pdf.output('blob'),ptpPdfFileName());
  }catch(err){
    console.error(err);
    alert('The PTP could not be prepared for the portal: '+err.message);
  }finally{
    if(btn){btn.disabled=false;btn.textContent=old}
  }
}


// BUILD v49 - condensed PTP navigation/progress + persistent planner selections.
const _v49SavePTPDraft=savePTPDraft;
savePTPDraft=function(){
  if(window.__ptpResetInProgress)return;
  _v49SavePTPDraft();
  try{
    const raw=sessionStorage.getItem(PTP_DRAFT_KEY);
    if(!raw)return;
    const d=JSON.parse(raw);
    d.plannerSelections={
      scope:plannerValues('scopePicks'),
      activity:plannerValues('activityPicks')
    };
    d.ts=Date.now();
    const encoded=JSON.stringify(d);
    sessionStorage.setItem(PTP_DRAFT_KEY,encoded);
    localStorage.setItem(V36_DRAFT_KEY,encoded);
    localStorage.setItem(V34_DRAFT_KEY,encoded);
  }catch(e){console.warn('v49 planner selection save skipped',e)}
};

function v49RestorePlannerSelections(){
  try{
    const d=JSON.parse(sessionStorage.getItem(PTP_DRAFT_KEY)||'null');
    const p=d?.plannerSelections||{};
    const groups=[['scopePicks',p.scope||[]],['activityPicks',p.activity||[]]];
    groups.forEach(([id,vals])=>{
      const set=new Set(vals.map(String));
      document.querySelectorAll(`#${id} input[type="checkbox"]`).forEach(cb=>{cb.checked=set.has(String(cb.value))});
    });
  }catch(e){console.warn('v49 planner selection restore skipped',e)}
}
const _v49RestorePTPDraft=restorePTPDraft;
restorePTPDraft=function(){
  const ok=_v49RestorePTPDraft();
  v49RestorePlannerSelections();
  return ok;
};

document.addEventListener('change',e=>{
  if(e.target?.matches('#scopePicks input[type="checkbox"],#activityPicks input[type="checkbox"]'))schedulePTPDraftSave();
});

function v49CondensePTPProgress(){
  const wrap=document.querySelector('#ptp .ptp-progress-wrap');
  const panel=E('v34CouncilPanel');
  if(!wrap||!panel||wrap.classList.contains('v49-condensed'))return;
  const completion=[...panel.querySelectorAll('.council-card')].find(card=>card.querySelector('h3')?.textContent.trim()==='PTP completion');
  if(!completion)return;
  const shell=completion.querySelector('.progress-shell');
  const copy=completion.querySelector('.progress-copy');
  if(!shell||!copy)return;
  const meta=document.createElement('div');
  meta.className='v49-progress-meta';
  meta.append(shell,copy);
  wrap.appendChild(meta);
  completion.remove();
  wrap.classList.add('v49-condensed');
  const pills=panel.querySelector('.stage-pills');if(pills)pills.remove();
  if(!panel.querySelector('.council-card'))panel.remove();
}

const v49Style=document.createElement('style');
v49Style.textContent=`
.ptp-progress-wrap.v49-condensed{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:8px 10px;margin-bottom:12px}
.ptp-progress-wrap.v49-condensed>.progress{grid-column:1;margin:0}
.ptp-progress-wrap.v49-condensed>.ptp-reset{grid-column:2;align-self:stretch}
.v49-progress-meta{grid-column:1/-1;padding:0 7px 2px}
.v49-progress-meta .progress-shell{height:8px}
.v49-progress-meta .progress-copy{margin-top:5px;font-size:11px}
#v34CouncilPanel{margin-top:8px}
@media(max-width:700px){.ptp-progress-wrap.v49-condensed{display:grid;grid-template-columns:1fr}.ptp-progress-wrap.v49-condensed>.progress,.ptp-progress-wrap.v49-condensed>.ptp-reset,.v49-progress-meta{grid-column:1}.ptp-progress-wrap.v49-condensed>.ptp-reset{width:100%}}
`;
document.head.appendChild(v49Style);
setTimeout(()=>{v49CondensePTPProgress();v49RestorePlannerSelections();updateV34Panel()},180);

// Header version is the single visible version indicator.
setTimeout(()=>{
  document.querySelector('.buildbadge')?.replaceChildren(document.createTextNode('v222'));
  document.getElementById('buildVersionBadge')?.remove();
  document.title='CDI Field Safety Management Tool · v222';
  restorePTPDraft();
  updateV34Panel();
},80);
console.info('CDI Safety Hub v49 Condensed Progress + Planner Draft Persistence loaded');

/* BUILD v52: keep the PTP stage navigation + completion progress visible under the sticky CDI/weather header. */
(function(){
  const style=document.createElement('style');
  style.textContent=`
    #ptp .ptp-progress-wrap.v49-condensed{
      position:sticky;
      top:calc(var(--cdi-sticky-header-h, 72px) + 6px);
      z-index:29;
      background:rgba(247,250,252,.97);
      backdrop-filter:blur(8px);
      -webkit-backdrop-filter:blur(8px);
      border:1px solid #d9e4ec;
      border-radius:12px;
      padding:7px;
      box-shadow:0 5px 15px rgba(24,61,89,.08);
    }
    #ptp .ptp-progress-wrap.v49-condensed>.progress.sticky-ptp-nav{
      position:static;
      top:auto;
      z-index:auto;
      margin:0;
      padding:0;
      border:0;
      border-radius:0;
      box-shadow:none;
      background:transparent;
      backdrop-filter:none;
      -webkit-backdrop-filter:none;
    }
    #ptp .ptp-progress-wrap.v49-condensed .v49-progress-meta{padding:0 2px 1px}
    @media(max-width:700px){
      #ptp .ptp-progress-wrap.v49-condensed{
        top:calc(var(--cdi-sticky-header-h, 58px) + 4px);
      }
    }
  `;
  document.head.appendChild(style);

  function syncStickyHeaderHeight(){
    const header=document.querySelector('header');
    if(!header)return;
    const h=Math.ceil(header.getBoundingClientRect().height);
    document.documentElement.style.setProperty('--cdi-sticky-header-h',h+'px');
  }
  syncStickyHeaderHeight();
  window.addEventListener('resize',syncStickyHeaderHeight,{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(syncStickyHeaderHeight,150),{passive:true});
  if('ResizeObserver' in window){
    const header=document.querySelector('header');
    if(header)new ResizeObserver(syncStickyHeaderHeight).observe(header);
  }

  setTimeout(()=>{
    v49CondensePTPProgress?.();
    syncStickyHeaderHeight();
  },220);
})();

// Header version is the single visible version indicator.
setTimeout(()=>{
  document.querySelector('.buildbadge')?.replaceChildren(document.createTextNode('v222'));
  document.getElementById('buildVersionBadge')?.remove();
  document.title='CDI Field Safety Management Tool · v222';
},260);
console.info('CDI Safety Hub v54 Form State + Scope Complete loaded');

(function(){
  function initEmployeeAutocomplete(){
    const dl=document.getElementById('cdiEmployeeNames');
    if(!dl) return;
    const names=[...dl.querySelectorAll('option')].map(o=>o.value).filter(Boolean);
    ['jobLeader','foreman','crewInput'].forEach(id=>{
      const input=document.getElementById(id); if(!input || input.dataset.acReady) return;
      input.dataset.acReady='1';
      const parent=input.parentElement;
      if(getComputedStyle(parent).position==='static') parent.style.position='relative';
      const menu=document.createElement('div'); menu.className='emp-ac-menu'; menu.setAttribute('role','listbox');
      parent.appendChild(menu);
      function render(){
        const q=input.value.trim().toLowerCase();
        if(!q){ menu.classList.remove('open'); menu.innerHTML=''; return; }
        const matches=names.filter(n=>n.toLowerCase().includes(q)).slice(0,12);
        menu.innerHTML='';
        matches.forEach(name=>{
          const b=document.createElement('button'); b.type='button'; b.className='emp-ac-item'; b.textContent=name;
          b.addEventListener('pointerdown',e=>{e.preventDefault(); input.value=name; input.dispatchEvent(new Event('input',{bubbles:true})); input.dispatchEvent(new Event('change',{bubbles:true})); menu.classList.remove('open'); input.focus();});
          menu.appendChild(b);
        });
        menu.classList.toggle('open',matches.length>0);
      }
      input.addEventListener('input',render);
      input.addEventListener('focus',()=>{ if(input.value.trim()) render(); });
      input.addEventListener('keydown',e=>{ if(e.key==='Escape') menu.classList.remove('open'); });
      document.addEventListener('pointerdown',e=>{ if(e.target!==input && !menu.contains(e.target)) menu.classList.remove('open'); });
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',initEmployeeAutocomplete); else initEmployeeAutocomplete();
})();

// BUILD v55: major-task ordering guard + clean autosave UI.
(function(){
  const t=document.getElementById('taskName');
  if(t){t.addEventListener('input',()=>{majorTaskOrderConfirmed=false;confirmedMajorTasks=[];refreshMajorTaskOrder(true);});}
  const oldGo=window.go;
  if(typeof oldGo==='function')window.go=function(n){const r=oldGo.apply(this,arguments);if(Number(n)===3)setTimeout(()=>refreshMajorTaskOrder(false),0);return r};
  document.querySelector('.buildbadge')?.replaceChildren(document.createTextNode('v222'));
  document.title='CDI Field Safety Management Tool · v222';
})();

/* BUILD v56: authoritative visible version + weather coaching confirmation. */
(function(){
  const setV56=()=>{
    const b=document.querySelector('.buildbadge');
    if(b)b.textContent='v222';
    document.title='CDI Field Safety Management Tool · v222';
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setV56,{once:true});
  else setV56();
})();

(function(){
  try {
    document.title='CDI Field Safety Management Tool · v222';
    var b=document.querySelector('.buildbadge'); if(b) b.textContent='v222';
  } catch(e) {}
})();

/* BUILD v222 · Safety Alerts: targeted job-lead selection + secure Cloudflare endpoint handoff. */
(function(){
  const LEADS_KEY='cdiSafetyAlertLeads_v1';
  const ENDPOINT='/api/safety-alert';
  window.cdiAlertEndpoint=ENDPOINT;
  function E2(id){return document.getElementById(id)}
  function esc2(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  function loadLeads(){try{return JSON.parse(localStorage.getItem(LEADS_KEY)||'[]').filter(x=>x&&x.name&&x.email)}catch(e){return []}}
  function saveLeads(v){localStorage.setItem(LEADS_KEY,JSON.stringify(v))}
  function nowStamp(){try{return new Intl.DateTimeFormat('en-US',{dateStyle:'medium',timeStyle:'short'}).format(new Date())}catch(e){return new Date().toLocaleString()}}
  function alertTemplate(type){
    const t=String(type||'');
    if(t==='Lightning Stand Down')return 'Lightning hazard reported. Suspend exposed outdoor work and MEWP operations. Seek appropriate shelter and remain on stand down until the all-clear is communicated by Safety or site leadership.';
    if(t==='High Wind')return 'High winds may affect MEWPs, elevated work, material handling, doors/gates, and unsecured materials. Follow equipment wind limits, secure loose materials, and stop affected work if conditions are unsafe.';
    if(t==='Heat')return 'Elevated heat conditions are present. Maintain hydration, use shade/cooling areas, take required recovery breaks, use the buddy system, and report signs of heat illness immediately.';
    if(t==='Severe Weather')return 'Severe weather may affect the site. Stop exposed work as directed, secure tools/materials, avoid unnecessary travel, and follow site shelter or emergency instructions.';
    if(t==='Cold Weather')return 'Cold-weather conditions are present. Use appropriate layers/PPE, keep clothing dry, use warm-up breaks as needed, and watch coworkers for signs of cold stress.';
    if(t==='Safety Notice')return 'Safety notice for field operations. Review the instruction below with your crew and confirm affected work is performed safely.';
    return 'Weather conditions may affect field operations. Review conditions with your crew, use appropriate precautions, and stop work if conditions become unsafe.';
  }
  window.applyAlertTemplate=function(){const m=E2('alertMessage'),t=E2('alertType');if(m&&t)m.value=alertTemplate(t.value);updateAlertPreview()}
  window.getSelectedAlertLeads=function(){return loadLeads().filter((_,i)=>{const c=E2('alertLead_'+i);return c&&c.checked})}
  window.renderAlertLeads=function(){
    const box=E2('alertRecipients'); if(!box)return; const leads=loadLeads();
    if(!leads.length){box.innerHTML='<div class="recipient-empty"><b>No job leads saved yet.</b><br>Add a lead below using their CDI work/Teams email.</div>';}
    else box.innerHTML=leads.map((x,i)=>`<label class="recipient-item"><input id="alertLead_${i}" type="checkbox" checked onchange="updateAlertPreview()"><span class="recipient-person"><b>${esc2(x.name)}</b><small>${esc2(x.email)}</small></span><button class="recipient-remove" type="button" title="Remove" onclick="event.preventDefault();event.stopPropagation();removeAlertLead(${i})">Remove</button></label>`).join('');
    updateAlertPreview();
  }
  window.addAlertLead=function(){
    const n=E2('newLeadName'),e=E2('newLeadEmail'); const name=(n?.value||'').trim(),email=(e?.value||'').trim().toLowerCase();
    if(!name){alert('Choose or type the job lead name.');return} if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){alert('Enter the job lead\'s CDI work / Teams email.');return}
    const leads=loadLeads(); if(leads.some(x=>x.email.toLowerCase()===email)){alert('That job lead is already saved.');return}
    leads.push({name,email}); saveLeads(leads); if(n)n.value='';if(e)e.value='';renderAlertLeads();
  }
  window.removeAlertLead=function(i){const leads=loadLeads();leads.splice(i,1);saveLeads(leads);renderAlertLeads()}
  window.selectAllAlertLeads=function(on){document.querySelectorAll('#alertRecipients input[type=checkbox]').forEach(x=>x.checked=!!on);updateAlertPreview()}
  function severitySymbol(v){return v==='STOP WORK'?'⛔':v==='Warning'?'⚠️':'ℹ️'}
  window.buildSafetyAlertText=function(){
    const sev=E2('alertSeverity')?.value||'Advisory', type=E2('alertType')?.value||'Safety Alert', site=(E2('alertSite')?.value||'CDI Field Operations').trim(), msg=(E2('alertMessage')?.value||'').trim(), exp=(E2('alertExpiry')?.value||'').trim();
    let out=`${severitySymbol(sev)} CDI SAFETY ALERT — ${sev}\n${site} · ${type}\n\n${msg||alertTemplate(type)}`; if(exp)out+=`\n\n${exp}`; out+=`\n\nIssued ${nowStamp()}`; return out;
  }
  window.updateAlertPreview=function(){
    const p=E2('alertPreview'); if(!p)return; const sev=E2('alertSeverity')?.value||'Advisory',type=E2('alertType')?.value||'',site=(E2('alertSite')?.value||'CDI Field Operations').trim(),msg=(E2('alertMessage')?.value||'').trim()||alertTemplate(type),exp=(E2('alertExpiry')?.value||'').trim(); const sel=getSelectedAlertLeads();
    p.innerHTML=`<div class="teams-preview-head"><div class="teams-preview-icon">T</div><div class="teams-preview-title"><b>CDI Safety Alert</b><span>Microsoft Teams · ${esc2(sel.length)} recipient${sel.length===1?'':'s'}</span></div></div><div class="alert-preview-severity">${esc2(severitySymbol(sev)+' '+sev)}</div><div class="alert-preview-site">${esc2(site)} · ${esc2(type)}</div><div class="alert-preview-body">${esc2(msg)}</div>${exp?`<div class="alert-preview-expiry">${esc2(exp)}</div>`:''}`;
    const c=E2('recipientCount');if(c)c.textContent=`${sel.length} selected`;
  }
  window.useCurrentWeatherInAlert=function(){
    const parts=[]; const t=E2('wxTemp')?.textContent?.trim(),h=E2('wxHeat')?.textContent?.trim(),w=E2('wxWind')?.textContent?.trim(),a=E2('wxAlert')?.textContent?.trim(),l=E2('wxLightning')?.textContent?.trim();
    if(t&&t!=='--°F')parts.push(`Temperature: ${t}`);if(h&&h!=='--°F')parts.push(`Heat index: ${h}`);if(w&&!w.startsWith('--'))parts.push(`Wind: ${w}`);if(l&&!/Checking/i.test(l))parts.push(`Lightning: ${l}`);if(a&&!/Checking/i.test(a)&&!/No active/i.test(a))parts.push(`NWS: ${a}`);
    const current=parts.length?`Current site weather: ${parts.join(' · ')}. `:''; const m=E2('alertMessage');if(m)m.value=current+alertTemplate(E2('alertType')?.value);updateAlertPreview();
  }
  function status(msg,kind){const s=E2('alertSendStatus');if(!s)return;s.className='alert-send-status show '+kind;s.textContent=msg}
  window.copySafetyAlert=async function(){try{await navigator.clipboard.writeText(buildSafetyAlertText());status('Alert copied. You can paste it into Teams while the automated connection is being configured.','ok')}catch(e){status('Could not copy automatically. Select the message text and copy it manually.','error')}}
  window.sendTeamsSafetyAlert=async function(){
    const leads=getSelectedAlertLeads(); if(!leads.length){status('Select at least one job lead before sending.','error');return}
    const message=(E2('alertMessage')?.value||'').trim(); if(!message){status('Enter an alert message before sending.','error');return} const pin=(E2('alertPin')?.value||'').trim(); if(!pin){status('Enter the Safety Alert PIN before sending.','error');return}
    const btn=E2('sendTeamsAlertBtn');if(btn){btn.disabled=true;btn.textContent='Sending…'}
    try{
      const payload={site:(E2('alertSite')?.value||'').trim(),type:E2('alertType')?.value,severity:E2('alertSeverity')?.value,expiry:(E2('alertExpiry')?.value||'').trim(),message:buildSafetyAlertText(),recipients:leads.map(x=>({name:x.name,email:x.email}))};
      const r=await fetch(ENDPOINT,{method:'POST',headers:{'content-type':'application/json','x-alert-pin':pin},body:JSON.stringify(payload)});
      const data=await r.json().catch(()=>({})); if(!r.ok)throw new Error(data.error||`HTTP ${r.status}`);
      status(`Alert sent to ${leads.length} selected job lead${leads.length===1?'':'s'} in Teams.`,'ok');
    }catch(e){
      status('Teams is not connected yet. The alert center is ready, but we still need to add the Cloudflare safety-alert endpoint and connect it to your Microsoft Teams Workflow.','error');
    }finally{if(btn){btn.disabled=false;btn.textContent='Send to Selected Leads in Teams'}}
  }
  function checkConnection(){fetch(ENDPOINT+'?status=1',{cache:'no-store'}).then(r=>{if(!r.ok)throw 0;return r.json()}).then(d=>{if(d&&d.configured){const b=E2('teamsConnectionBadge');if(b){b.className='connection-badge ready';b.textContent='Teams connected'}}}).catch(()=>{})}
  const oldShow=window.showView; if(typeof oldShow==='function')window.showView=function(v){const r=oldShow.apply(this,arguments);if(v==='alerts'){setTimeout(()=>{renderAlertLeads();updateAlertPreview();checkConnection()},0)}return r};
  function init(){const m=E2('alertMessage');if(m&&!m.value)m.value=alertTemplate(E2('alertType')?.value);renderAlertLeads();updateAlertPreview();checkConnection();const b=document.querySelector('.buildbadge');if(b)b.textContent='v222';document.title='CDI Field Safety Management Tool · v222'}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

/* BUILD v222 · concealed five-click Safety Alert gate with server-side PIN validation. */
(function(){
  let taps=0, resetTimer=null, unlocked=false;
  const title=document.querySelector('.brandtext b');
  const gate=document.getElementById('alertPinGate');
  const gatePin=document.getElementById('alertGatePin');
  const gateErr=document.getElementById('alertGateError');
  const unlockBtn=document.getElementById('alertGateUnlock');
  const cancelBtn=document.getElementById('alertGateCancel');
  const endpoint=window.cdiAlertEndpoint || '/api/safety-alert';
  if(!title||!gate)return;

  function resetTaps(){taps=0;if(resetTimer){clearTimeout(resetTimer);resetTimer=null}}
  function openGate(){
    resetTaps(); gate.classList.add('open'); gateErr.classList.remove('show'); gateErr.textContent=''; gatePin.value='';
    setTimeout(()=>gatePin.focus(),50);
  }
  function closeGate(){gate.classList.remove('open');gatePin.value='';gateErr.classList.remove('show');gateErr.textContent=''}
  function fail(msg){gateErr.textContent=msg;gateErr.classList.add('show');gatePin.focus();gatePin.select()}

  title.addEventListener('click',function(e){
    e.preventDefault(); taps++;
    if(resetTimer)clearTimeout(resetTimer);
    resetTimer=setTimeout(resetTaps,4000);
    if(taps>=5)openGate();
  });

  async function unlock(){
    const pin=gatePin.value.trim();
    if(!pin){fail('Enter the Safety Alert PIN.');return}
    unlockBtn.disabled=true; unlockBtn.textContent='Checking…';
    try{
      const r=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json','x-alert-pin':pin},body:JSON.stringify({action:'unlock'})});
      const data=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(data.error||'Invalid Safety Alert PIN.');
      unlocked=true;
      const hiddenPin=document.getElementById('alertPin'); if(hiddenPin)hiddenPin.value=pin;
      closeGate();
      window.showView('alerts');
    }catch(err){
      if(err && /not configured/i.test(String(err.message||''))) fail('The Safety Alert PIN has not been configured in Cloudflare yet.');
      else fail('Incorrect Safety Alert PIN.');
    }finally{unlockBtn.disabled=false;unlockBtn.textContent='Unlock'}
  }
  unlockBtn.addEventListener('click',unlock);
  cancelBtn.addEventListener('click',closeGate);
  gatePin.addEventListener('keydown',e=>{if(e.key==='Enter')unlock();if(e.key==='Escape')closeGate()});
  gate.addEventListener('click',e=>{if(e.target===gate)closeGate()});

  const originalShowView=window.showView;
  if(typeof originalShowView==='function'){
    window.showView=function(v){
      if(v==='alerts'&&!unlocked)return false;
      const r=originalShowView.apply(this,arguments);
      return r;
    };
  }
  // Ensure the hidden alert surface cannot remain open from stale state.
  document.getElementById('alerts')?.classList.add('hidden');
  document.getElementById('nAlerts')?.remove();
  document.title='CDI Field Safety Management Tool · v222';
  const badge=document.querySelector('.buildbadge'); if(badge)badge.textContent='v222';
})();

(function(){
  function setV66(){
    document.title='CDI Field Safety Management Tool · v222';
    var b=document.querySelector('.buildbadge');
    if(b)b.textContent='v222';
  }
  setV66();
  document.addEventListener('DOMContentLoaded',setV66,{once:true});
  window.addEventListener('pageshow',setV66);
  setTimeout(setV66,300);
})();
