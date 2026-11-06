/* Appearance setup only: never touches jobs, employee records, or authentication. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
function api(){try{if(parent!==window&&parent.origin===location.origin&&parent.FieldAppearance)return parent.FieldAppearance}catch(_){}return window.FieldAppearance}
const DEFAULT={background:'charcoal',fontSize:'normal',density:'comfortable',cardStyle:'rounded',intensity:'balanced',animations:'on'};
const PRESETS={
 midnight:{name:'Midnight Blue',mode:'dark',color:'#3b82f6',preferences:{...DEFAULT,background:'midnight'}},
 obsidian:{name:'Obsidian',mode:'dark',color:'#8b5cf6',preferences:{...DEFAULT,background:'black'}},
 emerald:{name:'Emerald',mode:'dark',color:'#16a34a',preferences:{...DEFAULT,background:'charcoal'}},
 professional:{name:'Professional',mode:'light',color:'#1d4ed8',preferences:{...DEFAULT,background:'charcoal'}}
};
const isHex=v=>/^#[0-9a-f]{6}$/i.test(v);
function rgb(hex){const n=parseInt(hex.slice(1),16);return[(n>>16)&255,(n>>8)&255,n&255].map(v=>v/255)}
function toHsl(hex){
 const [r,g,b]=rgb(hex),max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
 let h=0,s=0,l=(max+min)/2;
 if(d){s=d/(1-Math.abs(2*l-1));switch(max){case r:h=(g-b)/d+(g<b?6:0);break;case g:h=(b-r)/d+2;break;default:h=(r-g)/d+4}h*=60}
 return[Math.round(h),Math.round(s*100),Math.round(l*100)];
}
function toHex(h,s,l){
 h=((Number(h)%360)+360)%360;s=Math.max(0,Math.min(1,Number(s)/100));l=Math.max(0,Math.min(1,Number(l)/100));
 const a=s*Math.min(l,1-l);
 const f=n=>{const k=(n+h/30)%12;return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,9-k,1))))};
 return '#'+[f(0),f(8),f(4)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
let current=[0,80,50],rendering=false;
function say(message){$('psStatus').textContent=message}
function applyColor(value){
 if(!isHex(value)){say('Enter a valid six-digit HEX color, such as #2563EB.');$('psHex').setAttribute('aria-invalid','true');return}
 $('psHex').removeAttribute('aria-invalid');
 api().setColor(value);current=toHsl(value);refresh();
 say('Color updated and saved on this device.');
}
function grid(){
 const container=$('psColorGrid'),fragment=document.createDocumentFragment();
 const saturation=Number($('psSaturation').value);
 for(const lightness of [92,84,76,68,60,52,44,36,28,20]){
  for(let hue=0;hue<360;hue+=15){
   const color=toHex(hue,saturation,lightness);
   const button=document.createElement('button');button.type='button';button.style.setProperty('--swatch',color);
   button.title=color.toUpperCase();button.setAttribute('aria-label','Select color '+color.toUpperCase());
   button.dataset.color=color;fragment.append(button);
  }
 }
 container.replaceChildren(fragment);
}
function saved(){
 const area=$('psSavedThemes');area.replaceChildren();
 const themes=api().getSavedThemes?.()||[];
 if(!themes.length){const p=document.createElement('p');p.className='ps-empty';p.textContent='No custom themes saved yet.';area.append(p);return}
 for(const theme of themes){
  const item=document.createElement('div');item.className='ps-saved-item';
  const swatch=document.createElement('span');swatch.className='ps-swatch';swatch.style.background=theme.color;
  const name=document.createElement('strong');name.textContent=theme.name;
  const use=document.createElement('button');use.type='button';use.textContent='Apply';use.addEventListener('click',()=>{api().applyTheme(theme);refresh();say('Applied '+theme.name+'.')});
  const del=document.createElement('button');del.type='button';del.textContent='Delete';del.className='ps-delete';
  del.setAttribute('aria-label','Delete theme '+theme.name);del.addEventListener('click',()=>{if(confirm('Delete saved theme "'+theme.name+'"?')){api().deleteTheme(theme.id);saved();say('Theme removed.')}});item.append(swatch,name,use,del);area.append(item);
 }
}
function refresh(){
 if(rendering)return;rendering=true;
 try{
  const a=api(),color=a.getColor(),settings=a.getPreferences(),mode=a.get();
  current=toHsl(color);
  $('psColorSwatch').style.backgroundColor=color;$('psNativeColor').value=color;$('psHex').value=color.toUpperCase();
  $('psSaturation').value=String(current[1]);$('psBrightness').value=String(current[2]);
  $('psSaturationValue').textContent=current[1]+'%';$('psBrightnessValue').textContent=current[2]+'%';
  document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
  document.querySelectorAll('[data-background]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.background===settings.background)));
  document.querySelectorAll('[data-pref]').forEach(el=>el.value=settings[el.dataset.pref]);
  document.querySelectorAll('[data-preset]').forEach(b=>{
   const p=PRESETS[b.dataset.preset];
   b.setAttribute('aria-pressed',String(p.color.toLowerCase()===color.toLowerCase()&&p.mode===mode&&Object.keys(DEFAULT).every(k=>p.preferences[k]===settings[k])));
  });
  grid();
 }finally{rendering=false}
}
document.addEventListener('DOMContentLoaded',()=>{
 $('psColorGrid').addEventListener('click',e=>{const cell=e.target.closest('button[data-color]');if(cell)applyColor(cell.dataset.color)});
 $('psSaturation').addEventListener('input',e=>{const hex=toHex(current[0],Number(e.target.value),current[2]);applyColor(hex)});
 $('psBrightness').addEventListener('input',e=>{const hex=toHex(current[0],current[1],Number(e.target.value));applyColor(hex)});
 $('psNativeColor').addEventListener('input',e=>applyColor(e.target.value));
 $('psHex').addEventListener('change',e=>applyColor(e.target.value.trim()));
 $('psHex').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();applyColor(e.target.value.trim());e.target.blur()}});
 document.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>{api().set(button.dataset.mode);refresh();say('Appearance mode saved.')}));
 document.querySelectorAll('[data-background]').forEach(button=>button.addEventListener('click',()=>{api().setPreferences({background:button.dataset.background});refresh();say('Dark background saved.')}));
 document.querySelectorAll('[data-pref]').forEach(select=>select.addEventListener('change',()=>{api().setPreferences({[select.dataset.pref]:select.value});refresh();say('Page setup updated across the workspace.')}));
 document.querySelectorAll('[data-preset]').forEach(button=>button.addEventListener('click',()=>{const p=PRESETS[button.dataset.preset];api().applyTheme(p);refresh();say('Applied '+p.name+'.')}));
 $('psSaveForm').addEventListener('submit',e=>{e.preventDefault();const input=$('psThemeName'),record=api().saveTheme(input.value);if(record){input.value='';saved();say('Saved theme '+record.name+'.')}else say('Enter a theme name to save.')});
 $('psReset').addEventListener('click',()=>{if(!confirm('Reset your appearance to the original green, dark, charcoal theme?'))return;api().resetPreferences();api().setColor('#347644');api().set('dark');refresh();say('Appearance reset to defaults.')});
 document.addEventListener('fw-appearance-updated',()=>{if(!rendering)refresh()});
 window.addEventListener('storage',()=>{refresh();saved()});
 refresh();saved();
});
})();
