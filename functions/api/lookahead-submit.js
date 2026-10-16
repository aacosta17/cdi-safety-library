/** Cloudflare Pages Functions endpoint.
 * Sends original importable PDF to a fixed review mailbox (Resend) and/or posts a Teams Workflow notification.
 * Environment variables: LOOKAHEAD_SUBMISSION_CODE, REVIEW_EMAIL, RESEND_API_KEY, RESEND_FROM, TEAMS_WORKFLOW_URL.
 * Recommend Cloudflare Access + Turnstile/WAF/rate limiting for real production deployment.
 */
function fail(message,status=400){return new Response(JSON.stringify({ok:false,error:message}),{status,headers:{'content-type':'application/json','cache-control':'no-store'}})}
async function codeMatches(provided,expected){if(!provided||!expected)return false;const enc=new TextEncoder();const a=new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(provided)));const b=new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(expected)));let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0}
function validate(r){return !!r&&r.schema==='cdi-lookahead/v1'&&typeof r.id==='string'&&r.id.length<80&&/^[\w-]+$/.test(r.id)&&typeof r.project==='string'&&r.project.length>=2&&r.project.length<141&&typeof r.number==='string'&&r.number.length>0&&r.number.length<61&&typeof r.pm==='string'&&r.pm.length<101&&typeof r.email==='string'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)&&typeof r.tasks==='string'&&r.tasks.length>0&&r.tasks.length<3501&&/^\d{4}-\d{2}-\d{2}$/.test(r.start||'')&&/^\d{4}-\d{2}-\d{2}$/.test(r.end||'')&&r.start<=r.end&&Array.isArray(r.labor)&&r.labor.length<=40&&Array.isArray(r.materials)&&r.materials.length<=60}
const text=s=>String(s??'').replace(/[\r\n\t<>]/g,' ').slice(0,220);
export async function onRequestPost({request,env}){
 if(!env.LOOKAHEAD_SUBMISSION_CODE)return fail('Automatic delivery is not configured. Download the PDF and send it manually.',503);
 if(!(await codeMatches(request.headers.get('X-CDI-Submission-Key')||'',env.LOOKAHEAD_SUBMISSION_CODE)))return fail('Submission access code is incorrect.',401);
 const len=Number(request.headers.get('content-length')||'0');if(len>1800000)return fail('The uploaded PDF is too large.',413);
 let body;try{body=await request.json()}catch{return fail('Invalid request payload')};
 const r=body?.request,base64=body?.pdfBase64;if(!validate(r)||typeof base64!=='string'||base64.length>1500000||base64.length<120||!base64.startsWith('JVBERi0'))return fail('The request or PDF is invalid.');
 if(!env.RESEND_API_KEY&&!env.TEAMS_WORKFLOW_URL)return fail('No delivery channel is configured.',503);
 const delivery=[],warnings=[];
 if(env.RESEND_API_KEY&&env.REVIEW_EMAIL&&env.RESEND_FROM){
  try{const result=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({from:env.RESEND_FROM,to:[env.REVIEW_EMAIL],reply_to:r.email,subject:`PM Look-Ahead — ${text(r.number)} — ${text(r.start)} to ${text(r.end)}`,text:`PM: ${text(r.pm)} (${text(r.email)})\nProject: ${text(r.project)} / ${text(r.number)}\nWork dates: ${text(r.start)} to ${text(r.end)}\n\nReview by opening the attached original PDF in Field Management Workspace Tool > Manpower Planner > Look-Ahead Requests > Import PDF. Approval is required before calendar publication.`,attachments:[{filename:'CDI-LookAhead-'+text(r.number).replace(/[^a-zA-Z0-9_-]/g,'_')+'.pdf',content:base64}]})});if(!result.ok)throw new Error('Email provider returned HTTP '+result.status);delivery.push('email')}catch(err){warnings.push('Email delivery failed: '+err.message)}}
 if(env.TEAMS_WORKFLOW_URL){
  try{const card={type:'message',attachments:[{contentType:'application/vnd.microsoft.card.adaptive',content:{type:'AdaptiveCard',version:'1.4',body:[{type:'TextBlock',text:'New PM Look-Ahead Request',weight:'Bolder',size:'Medium'},{type:'TextBlock',text:`${text(r.project)} • ${text(r.number)}`,wrap:true},{type:'FactSet',facts:[{title:'PM',value:text(r.pm)},{title:'Dates',value:`${text(r.start)} to ${text(r.end)}`},{title:'Positions',value:String(r.labor.reduce((t,l)=>t+(Number(l.quantity)||0),0))}]},{type:'TextBlock',text:'Original importable PDF is sent to the review mailbox when email delivery is configured. Import it from the Look-Ahead Requests page.',wrap:true}]}}]};const response=await fetch(env.TEAMS_WORKFLOW_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(card)});if(!response.ok)throw new Error('Teams returned HTTP '+response.status);delivery.push('Teams')}catch(err){warnings.push('Teams notification failed: '+err.message)}}
 if(!delivery.length)return fail('No delivery channel accepted the request. '+warnings.join(' '),502);
 return new Response(JSON.stringify({ok:true,channels:delivery,warnings}),{status:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
}
export async function onRequestGet(){return fail('Use POST for PM Look-Ahead submissions.',405)}
