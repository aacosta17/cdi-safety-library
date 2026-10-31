/* Theme is a display preference only; never stores workspace data. */
(()=>{'use strict';
const origin=new URL(document.baseURI).origin;const key='fw-appearance-v2',root=document.documentElement;
let initial='dark';
try{const saved=localStorage.getItem(key);if(saved==='light'||saved==='dark')initial=saved;}catch(_){}
try{if(parent!==window&&parent.origin===origin)initial=parent.document.documentElement.dataset.theme||initial;}catch(_){}
function apply(theme){theme=theme==='light'?'light':'dark';root.dataset.theme=theme;root.style.colorScheme=theme;document.querySelectorAll('[data-theme-choice]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.themeChoice===theme)));document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='dark'?'#101715':'#f3f6f2');}
apply(initial);
window.FieldAppearance={set(theme){apply(theme);try{localStorage.setItem(key,root.dataset.theme)}catch(_){};document.querySelectorAll('iframe').forEach(f=>{try{f.contentWindow.postMessage({type:'fw-appearance',theme:root.dataset.theme},origin)}catch(_){}});},get:()=>root.dataset.theme};
window.addEventListener('storage',e=>{if(e.key===key)apply(e.newValue)});
window.addEventListener('message',e=>{if(e.origin!==origin||e.source!==parent||e.data?.type!=='fw-appearance')return;apply(e.data.theme)});
document.addEventListener('click',e=>{const b=e.target.closest('[data-theme-choice]');if(b)window.FieldAppearance.set(b.dataset.themeChoice)});
document.addEventListener('DOMContentLoaded',()=>{
 document.querySelectorAll('iframe').forEach(f=>f.addEventListener('load',()=>{try{f.contentWindow.postMessage({type:'fw-appearance',theme:root.dataset.theme},origin)}catch(_){}}));
 if(window===parent&&!document.body.classList.contains('workspace-host')){const bar=document.createElement('div');bar.className='standalone-appearance no-print';bar.innerHTML='<span>Appearance</span><button type="button" data-theme-choice="dark">Dark</button><button type="button" data-theme-choice="light">Light</button>';document.body.prepend(bar);}
 apply(root.dataset.theme);
});
})();
