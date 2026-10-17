/* Weather for Manpower Planner. NOAA/NWS first; alternate public forecast fallback. */
const respond=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=300','X-Content-Type-Options':'nosniff'}});
const weatherDescriptions={0:'Clear',1:'Mostly clear',2:'Partly cloudy',3:'Cloudy',45:'Fog',48:'Rime fog',51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',56:'Freezing drizzle',57:'Freezing drizzle',61:'Light rain',63:'Rain',65:'Heavy rain',66:'Freezing rain',67:'Freezing rain',71:'Light snow',73:'Snow',75:'Heavy snow',77:'Snow grains',80:'Rain showers',81:'Rain showers',82:'Heavy showers',85:'Snow showers',86:'Heavy snow showers',95:'Thunderstorms',96:'Thunderstorms',99:'Severe thunderstorms'};
async function requestJSON(url){
 const ctl=new AbortController(),id=setTimeout(()=>ctl.abort(),7500);
 try{const r=await fetch(url,{headers:{Accept:'application/geo+json, application/json;q=0.9','User-Agent':'FieldManagementWorkspace (safety weather forecast)'},signal:ctl.signal,cf:{cacheTtl:600,cacheEverything:true}});if(!r.ok)throw Error('forecast upstream '+r.status);return await r.json()}
 finally{clearTimeout(id)}
}
export async function onRequestGet(){
 try{
  const m=await requestJSON('https://api.weather.gov/points/29.4241,-98.4936');
  const forecast=await requestJSON(m.properties.forecast);
  const days={};
  for(const p of forecast.properties?.periods||[]){if(!p.isDaytime)continue;const day=String(p.startTime||'').slice(0,10);if(/^\d{4}-\d{2}-\d{2}$/.test(day))days[day]={short:String(p.shortForecast||'Forecast').slice(0,70),temp:Number(p.temperature)};}
  if(Object.keys(days).length)return respond({ok:true,source:'National Weather Service',days});
 }catch(_){/* Fall back to alternate forecast below. */}
 try{
  const url='https://api.open-meteo.com/v1/forecast?latitude=29.4241&longitude=-98.4936&daily=weather_code,temperature_2m_max&temperature_unit=fahrenheit&timezone=America%2FChicago&forecast_days=16';
  const payload=await requestJSON(url),data=payload.daily||{},days={};
  for(let i=0;i<(data.time||[]).length;i++){const day=data.time[i],code=Number(data.weather_code?.[i]),temp=Number(data.temperature_2m_max?.[i]);if(/^\d{4}-\d{2}-\d{2}$/.test(day)&&Number.isFinite(temp))days[day]={short:weatherDescriptions[code]||'Forecast available',temp:Math.round(temp)}}
  if(Object.keys(days).length)return respond({ok:true,source:'Open-Meteo forecast fallback',days});
 }catch(_){/* Explicit error; client will show Unavailable. */}
 return respond({ok:false,error:'Forecast is currently unavailable.'},503);
}
