/* Global workspace color preference, layered over the existing light/dark toggle. */
(()=>{'use strict';
const KEY='fw-brand-color-v1',PREF_KEY='fw-page-setup-v1',SAVED_KEY='fw-saved-themes-v1',DEFAULT='#347644',origin=new URL(document.baseURI).origin;
const DEFAULT_PREFS={background:'charcoal',fontSize:'normal',density:'comfortable',cardStyle:'rounded',intensity:'balanced',animations:'on'};
const ALLOWED={background:['black','charcoal','midnight'],fontSize:['small','normal','large'],density:['compact','comfortable'],cardStyle:['square','rounded','extra'],intensity:['subtle','balanced','vibrant'],animations:['on','off']};
const DARK_SURFACES={
 black:['#08090c','#11141a','#1b2028','#252c36','#343d49'],
 charcoal:['#0d1117','#161c25','#202936','#283443','#303c4d'],
 midnight:['#0b1424','#132036','#1b2c45','#263a56','#334963']
};
function cleanPrefs(raw){const result={...DEFAULT_PREFS};if(raw&&typeof raw==='object')for(const [key,choices] of Object.entries(ALLOWED)){if(choices.includes(raw[key]))result[key]=raw[key]}return result}
function readJSON(key,fallback){try{const value=JSON.parse(localStorage.getItem(key));return value===null?fallback:value}catch(_){return fallback}}
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
let preferences=cleanPrefs(readJSON(PREF_KEY,{}));
try{chosen=norm(localStorage.getItem(KEY))}catch(_){}
try{if(parent!==window&&parent.origin===origin){chosen=norm(parent.FieldAppearance?.getColor?.()||chosen);preferences=cleanPrefs(parent.FieldAppearance?.getPreferences?.()||preferences)}}catch(_){}
function mode(){return document.documentElement.dataset.theme==='light'?'light':'dark'}
function palette(){
 const dark=mode()==='dark',bg=dark?DARK_SURFACES[preferences.background][1]:'#ffffff';
 const accent=chosen===DEFAULT?(dark?'#b8ed83':'#347644'):readable(chosen,bg,dark?'#ffffff':'#000000');
 const tintStrength=preferences.intensity==='subtle'?.91:preferences.intensity==='vibrant'?.62:.77;
 const feature=dark?mix(chosen,bg,preferences.intensity==='subtle'?.80:preferences.intensity==='vibrant'?.16:.30):mix(chosen,'#ffffff',preferences.intensity==='subtle'?.70:preferences.intensity==='vibrant'?.08:.22);
 return {
  '--ui-accent':accent,'--ui-accent-ink':contrast('#10141a',accent)>contrast('#ffffff',accent)?'#10141a':'#ffffff',
  '--ui-tint':mix(chosen,bg,dark?tintStrength:Math.min(.97,tintStrength+.14)),
  '--brand-color':chosen,'--brand-feature-bg':feature,
  '--brand-feature-ink':contrast('#10141a',feature)>contrast('#ffffff',feature)?'#10141a':'#ffffff',
  '--brand-report':readable(chosen,'#ffffff','#000000'),
  '--brand-report-soft':mix(chosen,'#ffffff',.91)
 };
}
function paint(doc){
 const root=doc.documentElement;if(!root)return;
 for(const [name,value] of Object.entries(preferences))root.dataset[name]=value;
 const surfaceNames=['--ui-bg','--ui-surface','--ui-raised','--ui-hover','--ui-line'];
 if(mode()==='dark')DARK_SURFACES[preferences.background].forEach((color,i)=>root.style.setProperty(surfaceNames[i],color));
 else surfaceNames.forEach(name=>root.style.removeProperty(name));
 const scale=preferences.fontSize==='small'?.9:preferences.fontSize==='large'?1.15:1;
 root.style.setProperty('--ui-text-scale',String(scale));
 for(const [name,base] of [['--ui-body-font',14],['--ui-small-font',12],['--ui-label-font',12],['--ui-heading-font',30],['--ui-card-title-font',15]])root.style.setProperty(name,(base*scale).toFixed(1)+'px');
 root.style.setProperty('--ui-card-radius',preferences.cardStyle==='square'?'7px':preferences.cardStyle==='extra'?'24px':'16px');
 const colors=palette();
 for(const [key,val] of Object.entries(colors))root.style.setProperty(key,val);
 const meta=doc.querySelector('meta[name="theme-color"]');if(meta&&mode()==='dark')meta.content='#0d1117';
 doc.querySelectorAll('[data-accent-choice]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.accentChoice===chosen)));
 doc.querySelectorAll('.fw-accent-preview').forEach(el=>el.style.backgroundColor=chosen);
 const input=doc.getElementById('fwCustomAccent');if(input)input.value=chosen;
 const label=doc.getElementById('fwColorHex');if(label)label.textContent=chosen.toUpperCase();
 try{doc.dispatchEvent(new CustomEvent('fw-appearance-updated'))}catch(_){}
}
function paintFrame(frame){
 try{
  const doc=frame.contentDocument;
  if(doc?.documentElement){
   paint(doc);
   if(doc.head&&!doc.querySelector('link[href*="theme-colors.css"]')){
    const link=doc.createElement('link');link.id='fw-brand-colors-css';link.rel='stylesheet';
    link.href=new URL('css/theme-colors.css?v=20261106-setup',document.baseURI).href;doc.head.append(link);
   }
  }
  frame.contentWindow?.postMessage({type:'fw-brand-color',color:chosen,preferences},origin==='null'?'*':origin);
 }catch(_){/* Some third-party frames cannot be themed. */}
}
function paintAll(){paint(document);document.querySelectorAll('iframe').forEach(paintFrame)}
function setColor(value,save=true){
 if(!valid(value))return false;
 chosen=norm(value);
 if(save)try{localStorage.setItem(KEY,chosen)}catch(_){}
 paintAll();return true;
}
function setPreferences(partial,save=true){
 if(!partial||typeof partial!=='object')return false;
 const allowed={};for(const [key,choices] of Object.entries(ALLOWED))if(choices.includes(partial[key]))allowed[key]=partial[key];
 preferences={...preferences,...allowed};
 if(save)try{localStorage.setItem(PREF_KEY,JSON.stringify(preferences))}catch(_){}
 paintAll();return true;
}
function savedThemes(){
 const records=readJSON(SAVED_KEY,[]);
 return Array.isArray(records)?records.filter(x=>x&&typeof x.id==='string'&&typeof x.name==='string'&&valid(x.color)).slice(0,8):[];
}
function saveTheme(name){
 const safe=String(name||'').trim().slice(0,32);if(!safe)return null;
 const record={id:'theme-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6),name:safe,color:chosen,mode:mode(),preferences:{...preferences}};
 let list=savedThemes().filter(x=>x.name.toLowerCase()!==safe.toLowerCase());
 list=[record,...list].slice(0,8);
 try{localStorage.setItem(SAVED_KEY,JSON.stringify(list))}catch(_){return null}
 paintAll();return record;
}
function deleteTheme(id){
 const current=savedThemes(),next=current.filter(x=>x.id!==id);
 if(next.length===current.length)return false;
 try{localStorage.setItem(SAVED_KEY,JSON.stringify(next))}catch(_){return false}
 paintAll();return true;
}
function applyTheme(record){
 if(!record||!valid(record.color))return false;
 setPreferences(cleanPrefs(record.preferences));
 setColor(record.color);
 if(typeof original.set==='function')original.set(record.mode==='light'?'light':'dark');
 return true;
}
function colorChanged(){paintAll()}
const original=window.FieldAppearance||{};
if(typeof original.set==='function'){
 const previous=original.set.bind(original);
 original.set=(theme)=>{previous(theme);colorChanged()};
}
original.setColor=setColor;original.getColor=()=>chosen;original.resetColor=()=>setColor(DEFAULT);
original.setPreferences=setPreferences;original.getPreferences=()=>({...preferences});
original.getSavedThemes=savedThemes;original.saveTheme=saveTheme;original.deleteTheme=deleteTheme;original.applyTheme=applyTheme;
original.resetPreferences=()=>setPreferences(DEFAULT_PREFS);
window.FieldAppearance=original;
paint(document); // Apply the saved color before the page styles are loaded.
window.addEventListener('storage',e=>{
 if(e.key===KEY)setColor(norm(e.newValue),false);
 else if(e.key===PREF_KEY)setPreferences(cleanPrefs(readJSON(PREF_KEY,{})),false);
 else if(e.key===SAVED_KEY)paintAll();
 else if(e.key==='fw-appearance-v2')setTimeout(colorChanged,0);
});
window.addEventListener('message',e=>{
 if(e.origin!==origin||e.source!==parent||e.data?.type!=='fw-brand-color')return;
 if(e.data.preferences)setPreferences(e.data.preferences,false);
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
 if(topbar&&typeof window.showFieldModule==='function'){
  const full=document.createElement('button');full.type='button';full.className='fw-open-settings';full.textContent='Full Page Setup';
  full.addEventListener('click',()=>{dialog.close();window.showFieldModule('pageSetupHost')});
  dialog.querySelector('.fw-color-footer').prepend(full);
 }
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
