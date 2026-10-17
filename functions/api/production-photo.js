import {respond,getUser,can,assertDb,requireWriteRequest,newId} from '../../src/workspace-security.js';
const bad=(message,status=400)=>respond({error:message},status);
const TYPES=['image/jpeg','image/png','image/webp'];
export async function onRequestPost({request,env}){
 const denied=requireWriteRequest(request);if(denied)return denied;
 try{
  assertDb(env);const user=await getUser(request,env);if(!can(user,'production','edit'))return bad('Production edit access required.',403);
  if(!env.PRODUCTION_PHOTOS)return bad('Photo storage is not configured. Add the PRODUCTION_PHOTOS R2 binding.',503);
  const form=await request.formData(),jobId=String(form.get('jobId')||''),photo=form.get('photo');
  if(!/^[0-9a-f-]{36}$/.test(jobId)||!photo||!TYPES.includes(photo.type)||photo.size>5_000_000||photo.size<50)return bad('Select a JPG, PNG, or WebP image smaller than 5 MB.');
  if(!(await env.DB.prepare('SELECT id FROM production_jobs WHERE id=?').bind(jobId).first()))return bad('Job not found.',404);
  const extension=photo.type==='image/png'?'png':photo.type==='image/webp'?'webp':'jpg';
  const key=`production/${jobId}/${newId()}.${extension}`;
  await env.PRODUCTION_PHOTOS.put(key,await photo.arrayBuffer(),{httpMetadata:{contentType:photo.type},customMetadata:{uploadedBy:user.id}});
  return respond({ok:true,key,url:`/api/production-photo?key=${encodeURIComponent(key)}`});
 }catch(e){return bad('Unable to upload image.',500);}
}
export async function onRequestGet({request,env}){
 try{
  assertDb(env);const user=await getUser(request,env);if(!can(user,'production','view'))return bad('Production access required.',403);
  if(!env.PRODUCTION_PHOTOS)return bad('Photo storage is not configured.',503);
  const key=new URL(request.url).searchParams.get('key')||'';
  if(!/^production\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(key))return bad('Invalid image key.');
  const obj=await env.PRODUCTION_PHOTOS.get(key);if(!obj)return bad('Image not found.',404);
  return new Response(obj.body,{headers:{'Content-Type':obj.httpMetadata?.contentType||'image/jpeg','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch(e){return bad('Unable to retrieve image.',500);}
}
