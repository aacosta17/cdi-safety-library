/* Global workspace color preference, layered over the existing light/dark toggle. */
(()=>{'use strict';
const KEY='fw-brand-color-v1',DEFAULT='#347644',origin=new URL(document.baseURI).origin;
const CHOICES=[
 ['Classic Green',DEFAULT],['Emerald','#16a34a'],['Teal','#0d9488'],['Cyan','#0891b2'],
 ['Blue','#2563eb'],['Royal Blue','#1d4ed8'],['Indigo','#4f46e5'],['Purple','#7c3aed'],
 ['Violet','#9333ea'],['Pink','#db2777'],['Red','#dc2626'],['Orange','#ea580c'],
 ['Amber','#ca8a04'],['Gold','#a16207'],['Slate','#475569'],['Black','#111827']
];
const valid=v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);
const norm=v=>valid(v)?v.toLowerCase():DEFAULT;
const rgb=s=>{const v=parseInt(s.slice(1),16);return[(v>>16)&255,(v>>8)&255,v&255]};
const toHex=v=>'#'+v.map(n=>Math.round(Math.max(0,Math.min(255,n))).toString(16).padStart(2,'0')).join('');
const mix=(a,b,t)=>{const x=rgb(a),y=rgb(b);return toHex(x.map((n,i)=>n*(1-t)+y[i]*t))};
const lum=s=>rgb(s).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>{const x=lum(a),y=lum(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
function readable(color,bg,toward){
 if(contrast(color,bg)>=4.5)return color;
 for(let i=1;i<=100;i++){const next=mix(color,toward,i/100);if(contrast(next,bg)>=4.5)return next}
 return toward;
}
let chosen=DEFAULT;
try{chosen=norm(localStorage.getItem(KEY))}catch(_){}
try{if(parent!==window&&parent.origin===origin)chosen=norm(parent.FieldAppearance?.getColor?.()||chosen)}catch(_){}
function mode(){return document.documentElement.dataset.theme==='light'?'light':'dark'}
function palette(){
 const dark=mode()==='dark',bg=dark?'#161c25':'#ffffff';
 const accent=chosen===DEFAULT?(dark?'#b8ed83':'#347644'):readable(chosen,bg,dark?'#ffffff':'#000000');
 const feature=dark?mix(chosen,'#161c25',.30):mix(chosen,'#ffffff',.22);
 return {
  '--ui-accent':accent,'--ui-accent-ink':contrast('#10141a',accent)>contrast('#ffffff',accent)?'#10141a':'#ffffff',
  '--ui-tint':mix(chosen,bg,dark?.77:.91),
  '--brand-color':chosen,'--brand-feature-bg':feature,
  '--brand-feature-ink':contrast('#10141a',feature)>contrast('#ffffff',feature)?'#10141a':'#ffffff',
  '--brand-report':readable(chosen,'#ffffff','#000000'),
  '--brand-report-soft':mix(chosen,'#ffffff',.91)
 };
}
function paint(doc){
 const root=doc.documentElement;if(!root)return;
 const colors=palette();
 for(const [key,val] of Object.entries(colors))root.style.setProperty(key,val);
 const meta=doc.querySelector('meta[name="theme-color"]');if(meta&&mode()==='dark')meta.content='#0d1117';
 doc.querySelectorAll('[data-accent-choice]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.accentChoice===chosen)));
 doc.querySelectorAll('.fw-accent-preview').forEach(el=>el.style.backgroundColor=chosen);
 const input=doc.getElementById('fwCustomAccent');if(input)input.value=chosen;
 const label=doc.getElementById('fwColorHex');if(label)label.textContent=chosen.toUpperCase();
}
function paintFrame(frame){
 try{
  const doc=frame.contentDocument;
  if(doc?.documentElement){
   paint(doc);
   if(doc.head&&!doc.querySelector('link[href*="theme-colors.css"]')){
    const link=doc.createElement('link');link.id='fw-brand-colors-css';link.rel='stylesheet';
    link.href=new URL('css/theme-colors.css?v=20261104-darkfix',document.baseURI).href;doc.head.append(link);
   }
  }
  frame.contentWindow?.postMessage({type:'fw-brand-color',color:chosen},origin==='null'?'*':origin);
 }catch(_){/* Some third-party frames cannot be themed. */}
}
function paintAll(){paint(document);document.querySelectorAll('iframe').forEach(paintFrame)}
function setColor(value,save=true){
 if(!valid(value))return false;
 chosen=norm(value);
 if(save)try{localStorage.setItem(KEY,chosen)}catch(_){}
 paintAll();return true;
}
function colorChanged(){paintAll()}
const original=window.FieldAppearance||{};
if(typeof original.set==='function'){
 const previous=original.set.bind(original);
 original.set=(theme)=>{previous(theme);colorChanged()};
}
original.setColor=setColor;original.getColor=()=>chosen;original.resetColor=()=>setColor(DEFAULT);
window.FieldAppearance=original;
paint(document); // Apply the saved color before the page styles are loaded.
window.addEventListener('storage',e=>{if(e.key===KEY)setColor(norm(e.newValue),false);else if(e.key==='fw-appearance-v2')setTimeout(colorChanged,0)});
window.addEventListener('message',e=>{
 if(e.origin!==origin||e.source!==parent||e.data?.type!=='fw-brand-color')return;
 setColor(norm(e.data.color),false);
});
function picker(){
 if(document.getElementById('fwColorPicker'))return;
 const trigger=document.createElement('button');trigger.type='button';trigger.className='fw-color-trigger no-print';
 trigger.setAttribute('aria-label','Change workspace theme color');trigger.setAttribute('aria-haspopup','dialog');
 trigger.innerHTML='<span class="fw-accent-preview" aria-hidden="true"></span><span>Color</span>';
 const topbar=document.querySelector('.workspace-top-actions');
 if(topbar)topbar.append(trigger);
 else if(window===parent){const bar=document.querySelector('.standalone-appearance');if(!bar)return;bar.append(trigger)}
 else return;
 const dialog=document.createElement('dialog');dialog.id='fwColorPicker';dialog.className='fw-color-dialog no-print';
 dialog.setAttribute('aria-label','Workspace theme color');
 dialog.innerHTML=`<div class="fw-color-header"><div><strong>Theme color</strong><p>Select a color for every page and report.</p></div><button type="button" class="fw-color-close" aria-label="Close settings">×</button></div>
 <div class="fw-color-grid" role="group" aria-label="Preset theme colors">${CHOICES.map(([name,value])=>`<button type="button" data-accent-choice="${value}" aria-label="${name}" title="${name}" style="--swatch:${value}"><span></span></button>`).join('')}</div>
 <label class="fw-custom-label" for="fwCustomAccent">Custom color <input type="color" id="fwCustomAccent" aria-label="Choose any color" value="${DEFAULT}"><output id="fwColorHex">${DEFAULT.toUpperCase()}</output></label>
 <div class="fw-color-footer"><button type="button" id="fwResetAccent">Reset to green</button><span>Saved automatically</span></div>`;
 document.body.append(dialog);
 trigger.addEventListener('click',()=>{paint(document);dialog.showModal()});
 dialog.querySelector('.fw-color-close').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});
 dialog.querySelectorAll('[data-accent-choice]').forEach(button=>button.addEventListener('click',()=>setColor(button.dataset.accentChoice)));
 dialog.querySelector('#fwCustomAccent').addEventListener('input',e=>setColor(e.target.value));
 dialog.querySelector('#fwResetAccent').addEventListener('click',()=>setColor(DEFAULT));
 paint(document);
}
function watchFrames(){
 const tracked=new WeakSet();
 function scan(){document.querySelectorAll('iframe').forEach(frame=>{
  if(tracked.has(frame))return;tracked.add(frame);
  frame.addEventListener('load',()=>paintFrame(frame));
  if(frame.contentDocument?.readyState==='complete')paintFrame(frame);
 })}
 scan();new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});
}
document.addEventListener('DOMContentLoaded',()=>{picker();watchFrames();paintAll()});
})();
