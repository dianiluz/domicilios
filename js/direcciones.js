/* Direcciones verificadas en Supabase; localStorage como respaldo temporal.
 * No se almacenan nombres de clientes ni teléfonos en este índice.
 */
(()=>{'use strict';const KEY='ruta-cupissa-addresses-v2';
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const client=()=>window.sb||null;
function all(){try{const x=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(x)?x.filter(p=>Number.isFinite(p.la)&&Number.isFinite(p.ln)).slice(0,300):[]}catch{return []}}
function findLocal(text,city){const q=normalize(text);return all().filter(x=>x.city===city&&normalize(x.t).includes(q)).slice(0,8).map(x=>({...x,s:city+' · Ubicación verificada',source:'guardada',exact:true}));}
async function find(text,city){const local=findLocal(text,city);const db=client();if(!db||String(text).trim().length<3)return local;
 try{const {data,error}=await db.from('ruta_direcciones').select('direccion,municipio,lat,lng').eq('municipio',city).ilike('direccion','%'+String(text).trim().replace(/[%_,]/g,' ')+'%').limit(12);if(error)throw error;
 const seen=new Set();return [...(data||[]).map(x=>({t:x.direccion,city:x.municipio,la:+x.lat,ln:+x.lng,s:city+' · Verificada en CUPISSA',source:'guardada',exact:true})),...local].filter(x=>{const k=x.la.toFixed(6)+','+x.ln.toFixed(6);if(seen.has(k))return false;seen.add(k);return true}).slice(0,12)
 }catch(err){console.info('Las direcciones en Supabase no están disponibles:',err.message);return local}}
async function list(city){const db=client();if(!db)return all().filter(x=>x.city===city);try{const {data,error}=await db.from('ruta_direcciones').select('direccion,municipio,lat,lng').eq('municipio',city).order('updated_at',{ascending:false}).limit(100);if(error)throw error;return (data||[]).map(x=>({t:x.direccion,city:x.municipio,la:+x.lat,ln:+x.lng,source:'guardada',exact:true}));}catch{return all().filter(x=>x.city===city)}}
async function saveConfirmed(title,city,lat,lng){const t=String(title||'').trim(),la=Number(lat),ln=Number(lng);if(!t||!city||!Number.isFinite(la)||!Number.isFinite(ln)||la<10.65||la>11.2||ln< -75.25||ln> -74.5)return false;
 let xs=all().filter(x=>!(x.city===city&&normalize(x.t)===normalize(t)));xs.unshift({t,city,la,ln,source:'guardada',exact:true,ts:new Date().toISOString()});try{localStorage.setItem(KEY,JSON.stringify(xs.slice(0,300)))}catch{}
 const db=client();if(!db)return false;try{const {error}=await db.from('ruta_direcciones').upsert({direccion:t,municipio:city,lat:la,lng:ln,verified_by:(await db.auth.getUser()).data.user?.id},{onConflict:'municipio,direccion'});if(error)throw error;return true}catch(err){console.warn('Dirección solo guardada en este dispositivo:',err.message);return false}}
window.RutaDirecciones=Object.freeze({all,find,list,findLocal,saveConfirmed});
})();
