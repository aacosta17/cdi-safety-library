/* Progressive UI refinements. Existing routes, permissions and API contracts remain authoritative. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const visible=el=>!!el&&!el.hidden&&!el.classList.contains('hidden')&&el.getClientRects().length>0;
const focusable=el=>[...el.querySelectorAll('button,a[href],input,select,textarea,[tabindex]')].filter(n=>visible(n)&&!n.disabled&&n.tabIndex>=0&&!n.closest('[inert]'));
function start(){
  // Connect legacy labels to inputs, including rows created after page load.
  let controlId=0;
  function labels(root){
    root.querySelectorAll('.field>label:not([for])').forEach(label=>{
      const field=label.parentElement,control=field.querySelector('input:not([type=hidden]),select,textarea');
      if(!control||label.contains(control))return;
      if(!control.id){do{controlId++;control.id='workspace-control-'+controlId;}while(document.querySelectorAll('#'+control.id).length>1);}
      label.htmlFor=control.id;
    });
  }
  if(document.body.classList.contains('module-production'))labels(document);
  const dynamicIds=['attendanceRows','usedRows','personnelRows','taskRows','dailyRequestRows'];
  for(const id of dynamicIds){const el=$(id);if(el)new MutationObserver(()=>labels(el)).observe(el,{childList:true});}
  document.querySelectorAll('.fw-perm-row').forEach(row=>row.querySelector('select')?.setAttribute('aria-label',(row.querySelector('strong')?.textContent||'Module')+' permission'));
  document.querySelectorAll('.table-wrap').forEach(el=>{el.tabIndex=0;el.setAttribute('role','region');el.setAttribute('aria-label',el.closest('.card,.panel')?.querySelector('h2,h3')?.textContent||'Scrollable data table');});
  for(const id of ['banner','status','libStats','saveStatus','rosterCount']){$(id)?.setAttribute('role','status');$(id)?.setAttribute('aria-atomic','true');}
  // Same-origin shortcut works from embedded tools as well as the outer shell.
  document.addEventListener('keydown',e=>{if(parent!==window&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();parent.postMessage({type:'fw-open-command'},new URL(document.baseURI).origin);}});
  if(document.body.classList.contains('workspace-host')){
    window.addEventListener('message',e=>{if(e.origin!==location.origin||e.data?.type!=='fw-open-command')return;if([...document.querySelectorAll('iframe')].some(f=>f.contentWindow===e.source))$('wsSearch')?.click();});
    const search=$('libSearch'),category=$('libCategory');
    if(search&&category){
      search.type='search';
      for(const [input,title] of [[search,'Search hazards and controls'],[category,'Category']]){const wrap=document.createElement('div');wrap.className='filter-field';const label=document.createElement('label');label.htmlFor=input.id;label.textContent=title;input.before(wrap);wrap.append(label,input);}
      const reset=document.createElement('button');reset.type='button';reset.id='libReset';reset.className='btn filter-reset';reset.textContent='Reset filters';
      reset.addEventListener('click',()=>{search.value='';category.value='';search.dispatchEvent(new Event('input',{bubbles:true}));search.focus();});
      category.closest('.libfilters').append(reset);
    }
    // Keep long account tables usable with a keyboard and on a narrow screen.
    const table=$('fwUsersTable');if(table&&!table.parentElement.classList.contains('table-wrap')){const wrap=document.createElement('div');wrap.className='table-wrap';wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label','Employee access list');table.before(wrap);wrap.append(table);}
  }
  if(document.body.classList.contains('module-ptp')){
    const shell=$('scope').closest('.shell');
    for(const heading of [...shell.children].filter(el=>el.classList.contains('boxlabel'))){
      const group=document.createElement('section');group.className='ptp-section';heading.before(group);
      let node=heading;do{const next=node.nextElementSibling;group.append(node);node=next;}while(node&&!node.matches('.boxlabel,.followups,.toolbar'));
    }
    $('taskFollowups').classList.add('ptp-section');
    const summary=document.createElement('strong');summary.id='ptpSelectionSummary';shell.querySelector('.toolbar p').prepend(summary);
    function selection(){const tasks=shell.querySelectorAll('input[name=task]:checked').length,conditions=shell.querySelectorAll('input[name=condition]:checked').length;summary.textContent=tasks+' task'+(tasks===1?'':'s')+' · '+conditions+' condition'+(conditions===1?'':'s')+' selected';}
    shell.addEventListener('change',selection);selection();
    const stale=document.createElement('p');stale.id='ptpStale';stale.hidden=true;stale.setAttribute('role','status');stale.textContent='Your inputs changed. Generate the content again to include these changes.';$('results').querySelector('.headrow').after(stale);
    shell.addEventListener('input',()=>{if(!$('results').hidden)stale.hidden=false;});shell.addEventListener('change',()=>{if(!$('results').hidden)stale.hidden=false;});
    $('generate').addEventListener('click',()=>{if(!$('scope').value.trim()||!shell.querySelector('input[name=task]:checked'))return;stale.hidden=true;});
  }
  if(document.body.classList.contains('module-audit')){
    const nav=document.createElement('nav');nav.className='audit-steps';nav.setAttribute('aria-label','Audit steps');
    const names=['Job','Scope','Core review','Task review','Finish'];
    names.forEach((name,i)=>{const b=document.createElement('button');b.type='button';b.innerHTML='<b>'+(i+1)+'</b><span>'+name+'</span>';b.setAttribute('aria-label','Step '+(i+1)+': '+name);b.addEventListener('click',()=>window.showStep(i+1));nav.append(b);});
    document.querySelector('.progress-wrap').append(nav);
    const save=$('saveStatus');if(save)document.querySelector('.sticky-nav').append(save);
    const track=document.querySelector('.progress-track');track.setAttribute('role','progressbar');track.setAttribute('aria-label','Audit step progress');track.setAttribute('aria-valuemin','1');track.setAttribute('aria-valuemax','5');
    function state(){const screens=[...document.querySelectorAll('.screen')],index=screens.findIndex(el=>el.classList.contains('active'));[...nav.children].forEach((b,i)=>{if(i===index)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});track.setAttribute('aria-valuenow',String(index+1));track.setAttribute('aria-valuetext',names[index]||'Job');document.querySelectorAll('.chip,.choice').forEach(b=>b.setAttribute('aria-pressed',String(b.classList.contains('active'))));}
    new MutationObserver(state).observe(document.querySelector('main'),{childList:true,subtree:true,attributes:true,attributeFilter:['class']});state();
  }
  // Legacy overlays gain focus containment and restore the launching control.
  // Close the uppermost dialog first, so Escape in Copy does not close Edit job.
  const specs=document.body.classList.contains('module-planner')?[
    ['jobOverlay','closeJob'],['workforceOverlay','workforceClose'],['reportOverlay','reportClose'],['mpWaiveAllOverlay','mpWaiveAllClose'],['copyOverlay','copyClose']
  ]:document.body.classList.contains('module-audit')?[['reportOverlay',null]]:[];
  if(specs.length){
    const entries=specs.map(([id,close])=>({el:$(id),close,opener:null})).filter(x=>x.el);let stack=[],trigger=null;
    document.addEventListener('click',e=>{trigger=e.target.closest('button,a,input')||document.activeElement;},true);
    const isOpen=entry=>entry.el.id==='reportOverlay'&&document.body.classList.contains('module-audit')?entry.el.classList.contains('open'):!entry.el.classList.contains('hidden')&&!entry.el.hidden;
    function sync(){
      const removed=stack.filter(entry=>!isOpen(entry));stack=stack.filter(isOpen);
      for(const entry of entries.filter(entry=>isOpen(entry)&&!stack.includes(entry))){entry.opener=trigger||document.activeElement;stack.push(entry);entry.el.setAttribute('role','dialog');entry.el.setAttribute('aria-modal','true');if(!entry.el.hasAttribute('aria-labelledby'))entry.el.setAttribute('aria-label','Audit report preview');}
      const top=stack.at(-1);document.body.classList.toggle('refine-modal-open',!!top);
      if(removed.length){const restore=removed.at(-1).opener;if(visible(restore)&&(!top||top.el.contains(restore)))restore.focus({preventScroll:true});}
      if(top&&!top.el.contains(document.activeElement)){(focusable(top.el)[0]||top.el).focus({preventScroll:true});}
    }
    for(const entry of entries)new MutationObserver(sync).observe(entry.el,{attributes:true,attributeFilter:['class','hidden']});
    document.addEventListener('keydown',e=>{const top=stack.at(-1);if(!top)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();if(top.close)$(top.close).click();else window.closeReport();return;}if(e.key==='Tab'){const nodes=focusable(top.el),first=nodes[0],last=nodes.at(-1);if(!first){e.preventDefault();return;}if((e.shiftKey&&document.activeElement===first)||(!e.shiftKey&&document.activeElement===last)||!top.el.contains(document.activeElement)){e.preventDefault();(e.shiftKey?last:first).focus();}}},true);
    document.addEventListener('focusin',e=>{const top=stack.at(-1);if(top&&!top.el.contains(e.target))focusable(top.el)[0]?.focus({preventScroll:true});});
    sync();
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
