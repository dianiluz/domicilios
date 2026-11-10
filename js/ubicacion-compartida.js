/* Conversión local de enlaces de ubicación estática o coordenadas.
 * No lee mensajes ni el seguimiento en vivo de WhatsApp.
 */
(()=>{'use strict';const point=(lat,lng)=>{lat=Number(lat);lng=Number(lng);return Number.isFinite(lat)&&Number.isFinite(lng)&&lat>10.65&&lat<11.2&&lng>-75.25&&lng< -74.5?{lat,lng}:null};
function parse(raw){const s=String(raw||'').trim();let m=s.match(/(?:^|[^\d-])(-?\d{1,2}\.\d{3,})\s*[,; ]\s*(-?\d{1,3}\.\d{3,})/);if(m)return point(m[1],m[2]);
 for(const r of [/[@/](-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/,/!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/,/[?&](?:q|query|ll|center)=(-?\d{1,2}\.\d+)%2C(-?\d{1,3}\.\d+)/i]){m=s.match(r);if(m)return point(m[1],m[2]);}
 try{const u=new URL(s);if(!['https:','http:'].includes(u.protocol))return null;for(const k of ['q','query','ll','center','daddr','destination']){const v=u.searchParams.get(k);if(v){const a=v.match(/(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);if(a)return point(a[1],a[2]);}}}catch{}return null;}
window.RutaUbicacion=Object.freeze({parse});})();
