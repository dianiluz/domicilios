/* Ubicaciones confirmadas por el personal (almacenamiento local por navegador).
   No sincroniza entre dispositivos; no se deben introducir datos personales en este índice. */
(()=>{'use strict';const KEY='ruta-cupissa-addresses-v1';
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').replace(/[^a-z0-9]/g,'');
const all=()=>{try{const a=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(a)?a.filter(x=>Number.isFinite(x.la)&&Number.isFinite(x.ln)).slice(0,300):[]}catch{return[]}};
function saveConfirmed(title,city,lat,lng){const t=String(title||'').trim(),la=Number(lat),ln=Number(lng);if(!t||!city||!Number.isFinite(la)||!Number.isFinite(ln))return false;
let a=all().filter(x=>!(x.city===city&&normalize(x.t)===normalize(t)));a.unshift({t,city,la,ln,source:'guardada',exact:true,ts:new Date().toISOString()});try{localStorage.setItem(KEY,JSON.stringify(a.slice(0,300)));return true}catch{return false}}
function find(text,city){const q=normalize(text);return all().filter(x=>x.city===city&&(normalize(x.t).includes(q)||q.includes(normalize(x.t)))).slice(0,7).map(x=>({...x,s:x.city+' · Dirección confirmada',source:'guardada'}))}
window.RutaDirecciones=Object.freeze({all,find,saveConfirmed});})();
