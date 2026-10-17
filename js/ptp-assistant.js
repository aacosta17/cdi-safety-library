/* Standalone company-neutral PTP content assistant. Deterministic task prompts, not generative AI. */
(()=>{'use strict';const $=id=>document.getElementById(id),escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tasks=[
{id:'survey',name:'Survey and layout',step:'Survey the work area; verify dimensions, routing, drawings and location of existing services.',hazard:'Unknown utilities, obstructions, nearby traffic or uncoordinated trades.',control:'Review current drawings and site conditions; identify existing utilities, confirm access and coordinate affected trades before starting.'},
{id:'conduit',name:'Conduit / raceway installation',step:'Measure, cut, bend, support and install conduit and boxes along the approved route.',hazard:'Sharp edges, hand injuries, dropped material, drilling dust and contact with concealed services.',control:'Inspect the route before drilling, locate concealed services, use appropriate hand/eye protection, deburr conduit and secure supports and materials.'},
{id:'pull',name:'Wire / cable pulling',step:'Prepare raceway and pull conductors or communications cable to the planned destination.',hazard:'Hand pinch points, pull-line recoil, manual handling strain and cable damage.',control:'Confirm pathway capacity and pulling method, communicate between pull points, keep hands clear of pinch points and use suitable pull tension and handling methods.'},
{id:'terminate',name:'Terminations / device installation',step:'Mount equipment and terminate conductors, devices or controls according to approved documents.',hazard:'Exposure to electrical energy, incorrect connections, sharp wire ends and repetitive hand-tool use.',control:'Use the authorized isolation/verification process, appropriate tools and PPE, confirm labeling and torque or termination requirements before closing equipment.'},
{id:'test',name:'Testing / commissioning',step:'Inspect, test and document completed installation before turnover.',hazard:'Unexpected energization, arc/electrical exposure and unintended equipment operation.',control:'Use an approved test plan, qualified personnel and rated test equipment; verify isolation or approved energized-work controls before connecting or operating systems.'},
{id:'security',name:'Security / low-voltage devices',step:'Install and connect low-voltage cable, cameras, access-control or other security devices.',hazard:'Cuts, concealed utilities, work at elevation and interference with active building systems.',control:'Confirm permitted mounting locations, support methods and system isolation, use suitable access equipment and protect existing systems and occupants.'},
{id:'core',name:'Drilling / penetration',step:'Layout and make approved holes or penetrations through designated surfaces.',hazard:'Strike of hidden electrical/plumbing services, silica/dust exposure, falling debris and damaged fire-rated assemblies.',control:'Obtain required location/penetration authorization, scan or otherwise verify services as required, control dust/debris and restore fire/smoke ratings using the approved system.'},
{id:'demo',name:'Removal / demolition',step:'Identify, isolate and remove designated equipment, wire or materials.',hazard:'Unexpected energization, unstable supports, falling debris and unknown materials.',control:'Confirm removal scope, verify isolation and services, control the work zone and dispose of materials using the approved procedure.'},
{id:'excavate',name:'Excavation / underground',step:'Prepare the approved excavation area and complete underground raceway or cable work.',hazard:'Buried utilities, trench collapse, moving equipment and falls into excavations.',control:'Locate and verify utilities, obtain required excavation authorization, apply approved protective systems and separation from equipment and open excavations.'},
{id:'hot',name:'Hot work / cutting',step:'Complete approved welding, grinding, brazing or other hot work as required.',hazard:'Fire, burns, fumes, sparks and damage to nearby materials.',control:'Obtain required hot-work approval, protect combustibles, provide appropriate fire prevention and monitoring, ventilation and task-specific PPE.'},
{id:'lift',name:'Hoisting / material handling',step:'Move and position equipment and bulk materials into the designated installation area.',hazard:'Crush and pinch points, suspended loads and strains from handling.',control:'Plan the load path, verify capacity and rigging where applicable, use authorized operators and establish clear exclusion and communication arrangements.'}
];
const conditions=[
{id:'overhead',name:'Overhead work / falling objects',hazard:'Dropped tools/materials and exposure to persons below.',control:'Secure tools and materials, establish a controlled area below and coordinate with nearby workers.'},
{id:'occupied',name:'Occupied / active facility',hazard:'Public or other-worker exposure, restricted access and accidental disruption.',control:'Coordinate notifications and work-zone boundaries; maintain designated egress and protect occupants and active systems.'},
{id:'weather',name:'Outdoor weather / heat',hazard:'Heat stress, weather exposure, lightning or slippery surfaces.',control:'Review current site weather, provide suitable hydration/rest and stop or modify work when conditions exceed site rules.'},
{id:'dust',name:'Dust / respiratory exposure',hazard:'Respirable dust, flying particles and poor visibility.',control:'Use appropriate source controls and approved dust collection/ventilation, with PPE consistent with site exposure assessment.'},
{id:'noise',name:'Noise / vibration',hazard:'High noise and hand-arm vibration exposure.',control:'Assess exposure; use hearing protection, maintained tools and appropriate duration/rotation controls.'},
{id:'traffic',name:'Vehicle / equipment movement',hazard:'Struck-by exposure from trucks, lifts or moving construction equipment.',control:'Designate access routes, high-visibility controls as appropriate and coordinate spotting and separation from mobile equipment.'},
{id:'ladders',name:'Limited access / uneven floors',hazard:'Slips, trips, unstable access and falls.',control:'Inspect and clear approach routes, keep equipment on suitable surfaces and use approved access methods.'},
{id:'othertrade',name:'Conflicting work by other trades',hazard:'Simultaneous activities, falling objects and incompatible work zones.',control:'Coordinate daily with affected trade leads, sequence conflicting work and establish boundaries or stop-work points.'},
{id:'unknown',name:'Unknown scope / changed conditions',hazard:'Unidentified hazards and work beyond approved plans.',control:'Pause and reassess, notify the supervisor and update the PTP before proceeding with changed conditions.'}
];
$('taskOptions').innerHTML=tasks.map(t=>`<label class="check"><input type="checkbox" value="${t.id}" name="task"> ${escapeHtml(t.name)}</label>`).join('');
$('conditionOptions').innerHTML=conditions.map(t=>`<label class="check"><input type="checkbox" value="${t.id}" name="condition"> ${escapeHtml(t.name)}</label>`).join('');

const dynamicRequirements={
 energy:{tasks:['terminate','test','demo','pull','conduit'],access:[],conditions:[]},
 lift:{tasks:[],access:['lift','scaffold'],conditions:[]},
 penetration:{tasks:['core','conduit','security'],access:[],conditions:[]},
 hot:{tasks:['hot'],access:[],conditions:[]},
 rigging:{tasks:['lift'],access:[],conditions:[]},
 excavate:{tasks:['excavate'],access:[],conditions:[]},
 dust:{tasks:['core','hot'],access:[],conditions:['dust']},
 weather:{tasks:[],access:[],conditions:['weather']},
 occupied:{tasks:[],access:[],conditions:['occupied','traffic','othertrade']}
};
const followupOptions={energy:'fElectrical',lift:'fLift',penetration:'fPenetration',hot:'fHot',rigging:'fLoad',excavate:'fGround',dust:'fDust',weather:'fHeat',occupied:'fPeople'};
function getFollowups(){
 const tasksPicked=selected('task'),conditionsPicked=selected('condition'),access=$('access').value,energy=$('energy').value;
 const used=[];
 document.querySelectorAll('.followup').forEach(el=>{
  const type=el.dataset.for,r=dynamicRequirements[type];
  const active=r.tasks.some(id=>tasksPicked.includes(id))||r.conditions.some(id=>conditionsPicked.includes(id))||r.access.includes(access)||(type==='energy'&&['adjacent','deenergized'].includes(energy));
  el.hidden=!active;if(active)used.push(type);
 });
 $('taskFollowups').hidden=!used.length;
 return used;
}
function showResources(){
 const tags=new Set([...selected('task'),...selected('condition'),$('access').value,$('energy').value,'all']);
 if(tags.has('weather'))tags.add('outdoor');
 const resources=(window.FIELD_SAFETY_RESOURCES||[]).filter(r=>r.triggers.some(t=>tags.has(t))).slice(0,10);
 const cards=resources.map(r=>`<article class="resource-card"><span class="tag">${escapeHtml(r.category)}</span><h3>${escapeHtml(r.title)}</h3><p>${escapeHtml(r.explanation)}</p><a href="${escapeHtml(r.url)}" target="_blank" rel="noopener noreferrer">Read: ${escapeHtml(r.source)} ↗</a></article>`).join('');
 $('recommendedResources').innerHTML=cards;$('personalizedResources').hidden=false;
}

let rows=[];const selected=n=>[...document.querySelectorAll(`input[name=${n}]:checked`)].map(x=>x.value);
const status=s=>{$('status').textContent=s;$('status').hidden=!s;};
function add(step,hazard,control){rows.push({step,hazard,control})}
function generate(){const requiredFollowups=getFollowups();const chosen=selected('task'),context=selected('condition'),area=$('workarea').value.trim(),scope=$('scope').value.trim(),energy=$('energy').value,access=$('access').value,tools=$('equipment').value.trim(),special=$('special').value.trim();
 if(!scope||!chosen.length){status('Describe the work and select at least one specific task to generate a useful plan.');return}
 rows=[];const contextHazards=context.map(c=>conditions.find(t=>t.id===c)).filter(Boolean);
 add(`Review the planned work with the crew: ${scope}. Confirm work area${area?': '+area:''}.`,
 'Incomplete task understanding, unknown site conditions and conflicting work activities.'+(special?' Project restrictions require verification.':''),
 'Conduct a crew briefing and walkdown; verify the scope, access, adjacent activities and required approvals'+(special?'; address: '+special:'')+'.');
 if(energy==='unknown')add('Determine the electrical exposure status and required authorization before work.', 'Electrical isolation status is not confirmed; unexpected energization or contact may occur.', 'Do not begin electrical exposure work until a qualified person verifies conditions and confirms the approved isolation or energized-work procedure.');
 if(energy==='deenergized')add('Confirm and maintain the verified electrical isolation for the work.', 'Re-energization, incorrect circuit identification or stored electrical energy.', 'Follow the employer-approved isolation/lockout and absence-of-voltage verification procedure; only authorized/qualified personnel perform verification.');
 if(energy==='adjacent')add('Plan tasks near energized systems and establish electrical boundaries before starting.', 'Shock, arc flash and inadvertent contact with energized equipment.', 'Use qualified personnel, approved boundaries and protective methods. Do not perform energized work without explicit authorization and required controls.');
 if(access==='ladder')add('Inspect and position approved ladders for the planned access.', 'Falls, ladder instability, overreaching and dropped tools.', 'Inspect equipment; select a suitable ladder; maintain secure positioning and climbing practices, and use fall controls required for the task and site.');
 if(access==='lift')add('Inspect, position and operate the approved mobile elevating work platform.', 'Tip-over, falls, crushing/entrapment, overhead contact and dropped materials.', 'Use trained/authorized operators, completed pre-use checks, suitable ground and exclusion zones; follow equipment and site fall-protection requirements.');
 if(access==='scaffold')add('Verify and use the approved elevated platform or scaffold.', 'Falls, incomplete access, unstable working platform and falling objects.', 'Use only an inspected/released platform under site rules; maintain approved access, loading, guardrails and required protection.');
 for(const id of chosen){const t=tasks.find(x=>x.id===id);if(t)add(t.step,t.hazard,t.control)}
 if(contextHazards.length)add('Coordinate additional work-area hazards and controls before and during the task.',contextHazards.map(x=>x.hazard).join(' '),contextHazards.map(x=>x.control).join(' '));

 const followupAdvice={
  energy:['Determine and document the electrical work boundary and isolation verification.','Electric shock or arc exposure if electrical conditions are assumed rather than verified.','Stop electrical exposure work and have authorized qualified workers complete required identification, isolation, testing and protection before starting.'],
  lift:['Confirm the selected access equipment, pre-use checks and work-area conditions.','Equipment instability, tip-over, crush/entrapment and dropped objects from elevated equipment.','Verify operator authorization, pre-use inspection, ground capacity, overhead clearance, exclusion zones and equipment-specific fall protection and rescue plan.'],
  penetration:['Verify planned drilling / penetration locations and existing services.','Contact with concealed electrical, structural or other utilities, uncontrolled dust and impaired fire barriers.','Confirm drawings and required scanning/approvals before penetration; apply tool, dust and firestop controls based on the work.'],
  hot:['Confirm hot-work authorization and fire controls.','Ignition of adjacent combustibles, burns, smoke and sparks.','Verify applicable permit, combustible protection, equipment inspections and necessary fire watch/fire extinguisher provisions.'],
  rigging:['Plan movement and lifting of materials and equipment.','Crushed hands or feet, uncontrolled load movement, overload or struck-by incidents.','Verify weight, approved handling method, equipment capacity, travel path, stable staging, spotters and exclusion zones.'],
  excavate:['Verify underground utility locations and excavation conditions.','Striking buried services, cave-in or uncontrolled access to the excavation.','Coordinate required utility locating and site approvals, protective system, competent-person review and access/egress before entry.'],
  dust:['Select dust or silica controls for the actual work method.','Inhalation of hazardous airborne dust or flying particles during drilling/cutting.','Determine material and exposure hazards; implement appropriate collection, wet methods or other controls, and any required respiratory program.'],
  weather:['Review expected heat, wind, storms and changeable outdoor conditions.','Heat illness, lightning, slips and loss of equipment stability in adverse weather.','Check real jobsite conditions and alerts; determine suitable work/rest, cooling, hydration and stop-work provisions under site rules.'],
  occupied:['Protect occupants and adjacent crews during the planned work.','Struck-by, overhead objects, unauthorized work-zone entry or disruption of active systems.','Coordinate with affected personnel, maintain access/egress, establish protective work-zone boundaries and control simultaneous activities.']
 };
 const unresolved=[];
 requiredFollowups.forEach(type=>{
  const value=$(followupOptions[type]).value;
  if(value==='unconfirmed'){unresolved.push(document.querySelector(`[data-for="${type}"] label`)?.textContent||type);const advice=followupAdvice[type];add(...advice)}
 });
 if(requiredFollowups.length&&!unresolved.length)add('Confirm that the described controls remain effective immediately before work begins.','Task conditions or work methods may change after this plan is prepared.','Review completed assessments with the crew, verify current work conditions and re-evaluate if the scope, equipment or hazards change.');

 if(tools)add(`Inspect and safely use the specified tools and equipment: ${tools}.`,'Defective tools, improper use and tool-specific electrical, mechanical or struck-by hazards.','Use appropriate inspected tools, qualified operators when required, manufacturer instructions and equipment-specific guards and PPE.');
 add('Inspect completed work, remove debris and restore the work area for turnover.','Trips, leftover sharp material, unsecured equipment and incomplete identification of changes.','Perform a final crew walkdown, remove waste, confirm the work area is safe, label/secure equipment and report unresolved conditions.');
 draw();$('results').hidden=false;$('results').scrollIntoView({behavior:'smooth',block:'start'});status('');
 $('ptpReadiness').hidden=!unresolved.length;
 if(unresolved.length)$('ptpReadiness').textContent='DRAFT — '+unresolved.length+' task-specific item(s) not verified: '+unresolved.join('; ')+'. Confirm these requirements with the crew before relying on this PTP.';
 showResources();
 $('caution').hidden=energy!=='unknown';if(energy==='unknown')$('caution').textContent='Electrical exposure has not been verified. Do not begin electrical tasks until the appropriate qualified personnel complete the site-specific assessment and authorization.';
}
function lists(){return{steps:rows.map((r,i)=>`${i+1}. ${r.step}`).join('\n\n'),hazards:rows.map((r,i)=>`${i+1}. ${r.hazard}`).join('\n\n'),controls:rows.map((r,i)=>`${i+1}. ${r.control}`).join('\n\n')}}
function draw(){const v=lists();$('stepsOutput').value=v.steps;$('hazardsOutput').value=v.hazards;$('controlsOutput').value=v.controls;$('stepEditor').innerHTML=rows.map((r,i)=>`<div class="editline"><span>${i+1}.</span><textarea data-row="${i}" data-col="step" aria-label="Work step ${i+1}">${escapeHtml(r.step)}</textarea><textarea data-row="${i}" data-col="hazard" aria-label="Hazard ${i+1}">${escapeHtml(r.hazard)}</textarea><textarea data-row="${i}" data-col="control" aria-label="Mitigation ${i+1}">${escapeHtml(r.control)}</textarea></div>`).join('')}
async function copy(text){try{await navigator.clipboard.writeText(text);status('Copied to clipboard.')}catch{const e=document.createElement('textarea');e.value=text;document.body.append(e);e.select();const worked=document.execCommand('copy');e.remove();status(worked?'Copied to clipboard.':'Clipboard access is unavailable here; select the text and copy it manually.')}}
document.querySelectorAll('input[name="task"],input[name="condition"]').forEach(el=>el.addEventListener('change',getFollowups));
$('energy').addEventListener('change',getFollowups);$('access').addEventListener('change',getFollowups);getFollowups();
$('generate').addEventListener('click',generate);
$('copySteps').addEventListener('click',()=>copy($('stepsOutput').value));$('copyHazards').addEventListener('click',()=>copy($('hazardsOutput').value));$('copyControls').addEventListener('click',()=>copy($('controlsOutput').value));
$('copyAll').addEventListener('click',()=>copy('WORK STEPS\n'+$('stepsOutput').value+'\n\nASSOCIATED HAZARDS\n'+$('hazardsOutput').value+'\n\nMITIGATIONS / CONTROLS\n'+$('controlsOutput').value));$('print').addEventListener('click',()=>window.print());
$('applyEdits').addEventListener('click',()=>{document.querySelectorAll('#stepEditor [data-row]').forEach(el=>rows[Number(el.dataset.row)][el.dataset.col]=el.value.trim());draw();status('Updated all three numbered categories. Review before copying.')});
$('startOver').addEventListener('click',()=>{if(!confirm('Clear the questionnaire and generated PTP content?'))return;location.reload()});
})();
