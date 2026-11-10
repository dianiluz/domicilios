/* RUTA CUPISSA | Navegacion web interna sin Google ni Waze.
 * Leaflet + OSM tiles (prototipo) + Valhalla (demostracion comunitaria) / OSRM (respaldo).
 * Las API comunitarias NO ofrecen SLA ni precision de trafico; para produccion
 * configure un servicio de rutas contratado o alojado por la organizacion.
 */
(()=>{
'use strict';
let active=null;
const el=id=>document.getElementById(id);
const cfg=()=>window.RUTA_NAV_CONFIG||{};
const rad=n=>n*Math.PI/180;
const kmText=m=>m>=1000?(m/1000).toFixed(m<10000?1:0)+' km':Math.max(0,Math.round(m/10)*10)+' m';
const point=(lat,lng)=>({lat:Number(lat),lng:Number(lng)});
const valid=p=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&Math.abs(p.lat)<=90&&Math.abs(p.lng)<=180;
function meters(a,b){if(!valid(a)||!valid(b))return Infinity;const dlat=rad(b.lat-a.lat),dlon=rad(b.lng-a.lng),v=Math.sin(dlat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dlon/2)**2;return 12742000*Math.atan2(Math.sqrt(v),Math.sqrt(1-v));}
function escapeHTML(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
const voiceAvailable=()=>typeof window.speechSynthesis!=='undefined'&&typeof window.SpeechSynthesisUtterance!=='undefined';
function say(s,what,force=false){if(active!==s||!voiceAvailable()||(!s.voice&&!force))return;try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(what);u.lang='es-CO';u.rate=.94;u.volume=1;speechSynthesis.speak(u)}catch(e){console.warn('Voz deshabilitada:',e)}}
function status(text){const n=el('rn-status');if(n)n.textContent=text;}
function instruction(text){const n=el('rn-next');if(n)n.textContent=text;}
function report(s,text){if(active!==s)return;status(text);}
function close(){const s=active;active=null;if(!s)return;if(s.gps!=null)navigator.geolocation.clearWatch(s.gps);if(s.abort)s.abort.abort();if(s.recalcTimer)clearTimeout(s.recalcTimer);if(s.frame)cancelAnimationFrame(s.frame);if(s.cameraFrame)cancelAnimationFrame(s.cameraFrame);if(s.map)s.map.remove();try{speechSynthesis.cancel()}catch{}el('rn-shell')?.remove()}
function fit(s){if(!s.map)return;const b=new maplibregl.LngLatBounds();if(s.destination)b.extend([s.destination.lng,s.destination.lat]);if(s.position)b.extend([s.position.lng,s.position.lat]);if(s.route?.positions?.length){const pts=s.route.positions;for(let i=0;i<pts.length;i+=Math.max(1,Math.floor(pts.length/160)))b.extend([pts[i][1],pts[i][0]]);}if(!b.isEmpty())s.map.fitBounds(b,{padding:45,maxZoom:16,pitch:0,bearing:0,duration:500})}
function setVoice(s){s.voice=!s.voice;const b=el('rn-voice');if(b)b.textContent=s.voice?'Silenciar voz':'Activar voz';if(!s.voice){try{speechSynthesis.cancel()}catch{}}else say(s,s.lastText||'Indicaciones activadas')}
function drawUI(title){
 const shell=document.createElement('section');shell.id='rn-shell';shell.setAttribute('role','dialog');shell.setAttribute('aria-modal','true');shell.setAttribute('aria-label','Navegación RUTA CUPISSA');
 shell.innerHTML=`<div class="rn-top"><div class="rn-brand"><strong>RUTA CUPISSA</strong><span>Modo conducción · Moto / carro</span></div><span id="rn-follow-status" class="rn-follow-status">GPS EN SEGUIMIENTO</span><button type="button" id="rn-close" aria-label="Cerrar navegación">✕ Cerrar</button></div>
 <div id="rn-map" role="application" aria-label="Mapa del trayecto"><div class="rn-view-indicator" id="rn-view-indicator">VISTA DE CONDUCCIÓN · ESPERANDO RUMBO</div><div class="rn-gps-indicator" id="rn-gps-indicator">GPS: esperando ubicación</div><div class="rn-map-warning" id="rn-map-warning" hidden>El proveedor del mapa no respondió. La ruta y el GPS pueden seguir funcionando.</div></div>
 <div class="rn-panel"><div class="rn-destination"><span>DESTINO</span><strong>${escapeHTML(title)}</strong></div><div class="rn-maneuver"><div id="rn-arrow" aria-hidden="true">➜</div><div><div id="rn-next" aria-live="polite">Preparando mapa…</div><div id="rn-info">GPS y ruta por inicializar</div></div></div><div class="rn-progress"><div id="rn-progress-bar"></div></div><div class="rn-signal" id="rn-signal">La precisión del GPS puede variar según el dispositivo.</div><div id="rn-status" class="rn-status" aria-live="polite">Esperando ubicación…</div>
 <div class="rn-actions"><button type="button" id="rn-voice">Silenciar voz</button><button type="button" id="rn-repeat">Repetir</button><button type="button" id="rn-center">Centrar · Seguir ruta</button><button type="button" id="rn-orient">Rumbo ↑</button><button type="button" id="rn-recalc">Recalcular</button><button type="button" id="rn-point">Corregir destino</button></div>
 <small class="rn-caution">Vista de conducción 3D inclinada, con rumbo GPS cuando está disponible. Ruta orientativa sin tráfico en vivo. Respeta las señales de tránsito. La voz y el GPS pueden detenerse si se bloquea el teléfono. No manipules la pantalla mientras conduces.</small></div>`;
 document.body.appendChild(shell);
 el('rn-close').onclick=close;
 const name=el('rn-follow-status');if(name)name.textContent='GPS EN SEGUIMIENTO';
}
function setupMap(s){
 if(!window.maplibregl||!maplibregl.supported())throw Error('No se pudo iniciar la vista 3D. Comprueba que el navegador tenga WebGL habilitado.');
 const tile=cfg().tiles||'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
 s.map=new maplibregl.Map({container:'rn-map',style:{version:8,sources:{osm:{type:'raster',tiles:[tile],tileSize:256,attribution:'© OpenStreetMap contributors'}},layers:[{id:'osm-base',type:'raster',source:'osm'}]},center:[-74.7964,10.9639],zoom:16,pitch:60,bearing:0,maxPitch:70,attributionControl:true,antialias:true});
 s.map.addControl(new maplibregl.NavigationControl({showCompass:true,showZoom:true,visualizePitch:true}),'top-right');
 s.map.on('error',ev=>{if(ev?.error&&active===s){const warn=el('rn-map-warning');if(warn)warn.hidden=false;}});
 s.map.on('load',()=>{
  if(active!==s)return;
  s.map.addSource('rn-route',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
  s.map.addLayer({id:'rn-route-outline',type:'line',source:'rn-route',paint:{'line-color':'#ffffff','line-width':14,'line-opacity':.95},layout:{'line-join':'round','line-cap':'round'}});
  s.map.addLayer({id:'rn-route-line',type:'line',source:'rn-route',paint:{'line-color':'#e91e78','line-width':8},layout:{'line-join':'round','line-cap':'round'}});
  s.map.addSource('rn-destination',{type:'geojson',data:{type:'Feature',geometry:{type:'Point',coordinates:[s.destination.lng,s.destination.lat]},properties:{}}});
  s.map.addLayer({id:'rn-destination-dot',type:'circle',source:'rn-destination',paint:{'circle-radius':10,'circle-color':'#1f1523','circle-stroke-color':'#ffffff','circle-stroke-width':4}});
  if(s.route)renderRoute(s);
  if(s.position){moveMarker(s,s.position,s.accuracy);centerCamera(s,s.position,true)}
 });
 const userGesture=()=>pauseFollow(s);
 s.map.on('dragstart',userGesture);s.map.on('rotatestart',userGesture);s.map.on('pitchstart',userGesture);
 s.map.on('zoomstart',()=>{if(!s.cameraChanging)pauseFollow(s)});
 s.map.on('click',ev=>{if(!s.picking)return;s.destination=point(ev.lngLat.lat,ev.lngLat.lng);updateDestination(s);s.picking=false;s.needsPick=false;el('rn-point').textContent='Corregir destino';report(s,'Destino seleccionado. Recalculando…');compute(s,true)});
 el('rn-voice').onclick=()=>setVoice(s);
 el('rn-repeat').onclick=()=>say(s,s.lastText||'Continúa siguiendo la ruta',true);
 el('rn-center').onclick=()=>{s.follow=true;s.headingUp=true;updateFollowButton(s);if(s.position){centerCamera(s,s.displayPosition||s.position,true);report(s,'Cámara 3D centrada en tu ubicación y orientada hacia la vía.');}else report(s,'Esperando GPS. Activa los permisos de ubicación.');};
 el('rn-orient').onclick=()=>{s.headingUp=!s.headingUp;updateOrientation(s);if(s.position)centerCamera(s,s.displayPosition||s.position,true)};
 el('rn-recalc').onclick=()=>compute(s,true);
 el('rn-point').onclick=()=>{s.picking=!s.picking;el('rn-point').textContent=s.picking?'Toca el punto en el mapa':'Corregir destino';report(s,s.picking?'Toca la entrada exacta en el mapa.':'Selección cancelada.')};
}
function updateDestination(s){const src=s.map?.getSource('rn-destination');if(src)src.setData({type:'Feature',geometry:{type:'Point',coordinates:[s.destination.lng,s.destination.lat]},properties:{}})}
function renderRoute(s){const src=s.map?.getSource('rn-route');if(src&&s.route)src.setData({type:'Feature',geometry:{type:'LineString',coordinates:s.route.positions.map(p=>[p[1],p[0]])},properties:{}})}
// Decodificador polyline 6 (Valhalla). Rechaza geometrias truncadas.
function decode6(encoded){let result=[],index=0,lat=0,lon=0;while(index<encoded.length){const values=[];for(let k=0;k<2;k++){let shift=0,v=0,b;do{if(index>=encoded.length||shift>35)throw Error('Geometría de ruta no válida');b=encoded.charCodeAt(index++)-63;v|=(b&31)<<shift;shift+=5}while(b>=32);values.push(v&1?~(v>>1):v>>1)}lat+=values[0];lon+=values[1];result.push([lat/1e6,lon/1e6]);if(result.length>60000)throw Error('Ruta demasiado extensa')}return result}
function normalizeOSRM(route){const positions=route.geometry?.coordinates?.map(v=>[v[1],v[0]])||[];
 let steps=[];for(const leg of route.legs||[])for(const st of leg.steps||[])steps.push(st);
 const cum=buildCum(positions);
 const maneuvers=steps.map(st=>{const p=point(st.maneuver.location[1],st.maneuver.location[0]);const near=nearest(positions,cum,p);return {index:near.index,at:near.progress,text:osrmText(st),kind:st.maneuver.type,modifier:st.maneuver.modifier||''}}).sort((a,b)=>a.at-b.at);
 return {positions,cum,maneuvers,distance:route.distance,duration:route.duration,engine:'OSRM (respaldo)'};}
const dirs={'left':'a la izquierda','right':'a la derecha','slight left':'ligeramente a la izquierda','slight right':'ligeramente a la derecha','sharp left':'pronunciadamente a la izquierda','sharp right':'pronunciadamente a la derecha','straight':'recto','uturn':'en U'};
function osrmText(step){const m=step.maneuver||{},t=m.type||'',d=dirs[m.modifier]||'',street=step.name?' hacia '+step.name:'';
 if(t==='arrive')return 'Has llegado al destino';if(t==='depart')return 'Inicia el recorrido'+(step.name?' por '+step.name:'');
 if(t==='roundabout'||t==='rotary')return 'Entra a la glorieta'+(m.exit?' y toma la salida '+m.exit:'');
 if(t==='merge')return 'Incorpórate '+d+street;if(t==='fork')return 'Mantente '+d+street;
 if(t==='turn'||t==='end of road'||t==='on ramp'||t==='off ramp')return 'Gira '+d+street;
 if(t==='new name'||t==='continue')return 'Continúa '+d+(step.name?' por '+step.name:'');
 return 'Continúa '+d+street;}
function buildCum(points){const dist=[0];for(let i=1;i<points.length;i++)dist[i]=dist[i-1]+meters(point(...points[i-1]),point(...points[i]));return dist}
function normalizeValhalla(data){const leg=data.trip?.legs?.[0];if(!leg||!leg.shape)throw Error('No llegó la geometría de la ruta');const positions=decode6(leg.shape),cum=buildCum(positions);
 const maneuvers=(leg.maneuvers||[]).map(m=>({index:m.begin_shape_index||0,at:cum[Math.min(cum.length-1,m.begin_shape_index||0)],text:String(m.instruction||m.verbal_pre_transition_instruction||'Continúa por la ruta'),kind:m.type||0,modifier:''}));
 return {positions,cum,maneuvers,distance:data.trip?.summary?.length*1000||cum[cum.length-1],duration:data.trip?.summary?.time||0,engine:'Valhalla'};}
async function requestValhalla(origin,destination,signal){const url=cfg().valhalla||'https://valhalla1.openstreetmap.de/route';const payload={locations:[{lat:origin.lat,lon:origin.lng},{lat:destination.lat,lon:destination.lng}],costing:'auto',units:'kilometers',language:'es-ES',directions_options:{units:'kilometers',language:'es-ES'}};
 const r=await fetch(url+'?json='+encodeURIComponent(JSON.stringify(payload)),{signal,headers:{'X-Client-Id':'ruta.cupissa.com'}});
 if(!r.ok)throw Error('Valhalla HTTP '+r.status);const data=await r.json();return normalizeValhalla(data);}
async function requestOSRM(origin,destination,signal){const base=cfg().osrm||'https://router.project-osrm.org';const u=`${base}/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson&steps=true`;
 const r=await fetch(u,{signal});if(!r.ok)throw Error('OSRM HTTP '+r.status);const data=await r.json();if(!data.routes?.[0])throw Error('El servidor no encontró un recorrido');return normalizeOSRM(data.routes[0]);}
async function fetchRoute(origin,destination,signal){const primary=cfg().motor||'valhalla';if(primary==='osrm')return requestOSRM(origin,destination,signal);try{return await requestValhalla(origin,destination,signal)}catch(err){if(signal.aborted)throw err;console.warn('Valhalla no respondió, utilizando respaldo:',err);return requestOSRM(origin,destination,signal)}}
// Proyección sobre segmentos: avance incluso cuando el GPS no coincide con un vértice.
function nearest(positions,cum,pos){let best={distance:Infinity,progress:0,index:0};if(!positions?.length||!valid(pos))return best;
 const cos=Math.cos(rad(pos.lat)),scale=111195;
 for(let i=0;i<positions.length-1;i++){
 const a=positions[i],b=positions[i+1],ax=(a[1]-pos.lng)*cos*scale,ay=(a[0]-pos.lat)*scale,bx=(b[1]-pos.lng)*cos*scale,by=(b[0]-pos.lat)*scale,dx=bx-ax,dy=by-ay;
 const t=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/(dx*dx+dy*dy||1))),x=ax+t*dx,y=ay+t*dy,d=Math.hypot(x,y);
 if(d<best.distance)best={distance:d,progress:cum[i]+t*(cum[i+1]-cum[i]),index:i+t};
 }return best;}
function updateFollowButton(s){
 const b=el('rn-center');if(!b)return;
 b.textContent=s.follow?'● Siguiendo GPS':'◎ Reanudar seguimiento';
 b.setAttribute('aria-pressed',String(s.follow));
 const st=el('rn-follow-status');if(st)st.textContent=s.follow?'GPS EN SEGUIMIENTO':'SEGUIMIENTO PAUSADO';
}
function pauseFollow(s){
 if(!s.follow||active!==s)return;
 s.follow=false;updateFollowButton(s);
 report(s,'Moviste el mapa. Pulsa «Reanudar seguimiento» para centrarlo otra vez.');
}
// Camera 3D nativa MapLibre: el GPS queda en el tercio inferior de la vista.
function updateOrientation(s){
 if(!s.map)return;
 const heading=s.headingUp&&s.hasBearing&&Number.isFinite(s.lastBearing)?s.lastBearing:0;
 const ui=el('rn-view-indicator');
 if(ui)ui.textContent=s.headingUp?(s.hasBearing?`VISTA 3D · RUMBO ${Math.round(heading)}°`:'VISTA 3D · ESPERANDO RUMBO'):'NORTE ARRIBA · VISTA 3D';
 const btn=el('rn-orient');if(btn){btn.textContent=s.headingUp?'Rumbo ↑':'Norte ↑';btn.setAttribute('aria-pressed',String(s.headingUp));}
}
function centerCamera(s,p,force=false){
 if(!s.map||!s.follow||!valid(p)||!s.map.getSource('rn-route'))return;
 updateOrientation(s);
 const b=s.headingUp&&s.hasBearing?s.lastBearing:0;
 const height=s.map.getContainer().clientHeight;
 // La cámara se inclina 60 grados: carretera delante y vehículo cerca del tercio inferior.
 // offset desplaza el punto GPS por debajo del centro; no adelanta artificialmente el GPS.
 const target={center:[p.lng,p.lat],zoom:18.1,pitch:60,bearing:b,offset:[0,Math.max(35,Math.min(175,height*.22))],duration:force?0:Math.max(280,Math.min(650,550)),essential:true};
 if(!force&&s.lastCamera&&meters(s.lastCamera,p)<1.8&&Math.abs((s.lastCameraBearing||0)-b)<3)return;
 if(!force&&s.lastCameraTick&&performance.now()-s.lastCameraTick<280)return;
 s.lastCameraTick=performance.now();
 s.lastCamera=p;s.lastCameraBearing=b;
 s.cameraChanging=true;
 // jumpTo garantiza que el centro y rumbo se actualicen incluso con GPS frecuente;
 // easeTo suaviza sin interpolaciones de rumbo por el camino largo.
 if(force)s.map.jumpTo(target);else s.map.easeTo(target);
 s.cameraChanging=false;
}
function bearing(a,b){const y=Math.sin(rad(b.lng-a.lng))*Math.cos(rad(b.lat));const x=Math.cos(rad(a.lat))*Math.sin(rad(b.lat))-Math.sin(rad(a.lat))*Math.cos(rad(b.lat))*Math.cos(rad(b.lng-a.lng));return (Math.atan2(y,x)*180/Math.PI+360)%360;}
function moveMarker(s,position,accuracy){
 const previous=s.displayPosition||position;
 const gap=meters(previous,position);
 const angle=Number.isFinite(s.heading)?s.heading:(gap>6&&accuracy<=65?bearing(previous,position):s.lastBearing||0);
 s.lastBearing=angle;
 if(Number.isFinite(s.heading)||(gap>6&&accuracy<=65))s.hasBearing=true;
 updateOrientation(s);
 if(!s.map.getSource('rn-route'))return;
 if(!s.positionMarker){
  const node=document.createElement('div');node.className='rn-driver-direction';node.innerHTML='<div class="rn-driver-core"></div>';
  s.positionMarker=new maplibregl.Marker({element:node,anchor:'center',rotationAlignment:'map',pitchAlignment:'viewport'}).setLngLat([position.lng,position.lat]).addTo(s.map);
 }
 if(s.frame)cancelAnimationFrame(s.frame);
 const from={...previous};
 const smooth=accuracy<=65&&gap<130;
 const start=performance.now(),duration=smooth?Math.min(1100,Math.max(300,gap*32)):0;
 const animate=now=>{
  if(active!==s)return;
  const t=duration?Math.min(1,(now-start)/duration):1,ease=t*t*(3-2*t);
  const current=point(from.lat+(position.lat-from.lat)*ease,from.lng+(position.lng-from.lng)*ease);
  s.positionMarker.setLngLat([current.lng,current.lat]);
  // Icono apuntando hacia la parte superior en modo rumbo-arriba.
  s.positionMarker.setRotation(angle);
  s.displayPosition=current;
  centerCamera(s,current);
  if(t<1)s.frame=requestAnimationFrame(animate);else s.frame=null;
 };
 s.frame=requestAnimationFrame(animate);
}
function showLocation(s,position,accuracy){
 const quality=accuracy<=30?'buena':accuracy<=75?'media':'baja';
 const indicator=el('rn-gps-indicator');if(indicator){indicator.textContent=`GPS ±${Math.round(accuracy)} m · precisión ${quality}`;indicator.dataset.quality=quality;}
 moveMarker(s,position,accuracy);
 const signal=el('rn-signal');if(signal){signal.textContent=accuracy>100?'GPS impreciso: la ubicación podría estar a '+Math.round(accuracy)+' m de este punto. Prueba desde el teléfono al aire libre.':accuracy>45?'GPS con precisión media (±'+Math.round(accuracy)+' m). El mapa sigue la ubicación recibida.':'GPS con buena precisión (±'+Math.round(accuracy)+' m). Seguimiento automático activo.';}
}
function nextInstruction(s){if(!s.route||!s.position)return;
 const r=s.route,n=nearest(r.positions,r.cum,s.position);if(n.distance>100&&s.accuracy<70){s.offCount++;if(s.offCount>=3&&Date.now()-s.lastCalc>45000){s.offCount=0;window.RutaNotificaciones?.emit('Ruta desviada','Recalculando trayecto desde tu ubicación actual.',false);compute(s,true);return}}else s.offCount=0;
 // Evitar saltos hacia atrás por ruido del GPS.
 if(s.accuracy<90)s.progress=Math.max(s.progress||0,n.progress-35);
 const maxProgress=r.cum[r.cum.length-1]||1;const bar=el('rn-progress-bar');if(bar)bar.style.width=Math.max(0,Math.min(100,(s.progress/maxProgress)*100))+'%';
 const remaining=Math.max(0,r.cum[r.cum.length-1]-s.progress),dest=meters(s.position,s.destination);
 if(dest<35&&s.accuracy<=65){instruction('Has llegado al destino');el('rn-arrow').textContent='✓';el('rn-info').textContent='Destino alcanzado';if(!s.arrived){s.arrived=true;s.lastText='Has llegado al destino';say(s,s.lastText);window.RutaNotificaciones?.emit('Llegaste al destino',s.title,false)}return;}
 const next=r.maneuvers.find(m=>m.at>s.progress+16&&m.kind!=='arrive'&&m.kind!==4)||r.maneuvers[r.maneuvers.length-1];
 if(!next){instruction('Continúa hasta el destino');return;}
 const d=Math.max(0,next.at-s.progress),txt=next.text||'Continúa siguiendo la ruta',idx=r.maneuvers.indexOf(next);
 s.lastText=`En ${kmText(d)}, ${txt.charAt(0).toLowerCase()+txt.slice(1)}`;
 instruction(s.lastText);el('rn-arrow').textContent=/izquierda/i.test(txt)?'↰':/derecha/i.test(txt)?'↱':/llegad|destino/i.test(txt)?'✓':'↑';
 el('rn-info').textContent=`Restan ${kmText(remaining)} · ${Math.max(1,Math.ceil(remaining/Math.max(3, (r.distance/r.duration)||6)/60))} min aprox. · GPS ±${Math.round(s.accuracy)} m`;
 const tier=d<=85?'near':d<=320?'approach':null;
 if(s.voice&&tier&&s.accuracy<=70){const key=idx+':'+tier;if(!s.spoken.has(key)){s.spoken.add(key);say(s,s.lastText)}}
 if(n.distance>90&&s.accuracy>=70)report(s,'Señal GPS imprecisa; espera una mejor ubicación antes de recalcular.');
}
async function compute(s,force=false){if(active!==s||!s.position||!valid(s.destination))return;
 if(s.loading){if(force)s.pending=true;return}
 if(!force&&Date.now()-s.lastCalc<35000)return;s.lastCalc=Date.now();
 s.loading=true;report(s,'Calculando recorrido y maniobras…');instruction('Buscando la mejor ruta disponible…');
 s.abort?.abort();const abort=new AbortController();s.abort=abort;const guard=setTimeout(()=>abort.abort(),15000);
 try{const r=await fetchRoute(s.position,s.destination,abort.signal);if(active!==s)return;
 if(!r.positions?.length||r.positions.length<2||!r.maneuvers?.length)throw Error('Ruta incompleta. Verifica el destino.');
 s.route=r;s.progress=0;s.spoken=new Set();s.arrived=false;s.offCount=0;s.lastCalc=Date.now();
 renderRoute(s);
 if(s.follow&&s.position){centerCamera(s,s.displayPosition||s.position,true);}else fit(s);nextInstruction(s);report(s,`Ruta trazada · ${kmText(r.distance)} · ${Math.ceil(r.duration/60)} min aprox. · Motor ${r.engine}. Sin tráfico en vivo.`);
 }catch(err){if(active===s){if(!s.route)window.RutaNotificaciones?.emit('No se pudo trazar la ruta',err.message,false);report(s,err.name==='AbortError'?'El servidor de rutas tardó demasiado; intenta recalcular.':'No se pudo calcular la ruta: '+err.message);instruction('Puedes corregir el destino tocando el mapa.');}}
 finally{clearTimeout(guard);s.loading=false;if(s.pending&&active===s){s.pending=false;setTimeout(()=>{if(active===s)compute(s,true)},1000)}}
}
function positionUpdate(s,p){if(active!==s)return;const coords=p.coords,pt=point(coords.latitude,coords.longitude);if(!valid(pt))return;
 s.position=pt;s.accuracy=Number(coords.accuracy)||999;if(s.accuracy>125&&!s.gpsWarned){s.gpsWarned=true;window.RutaNotificaciones?.emit('Señal GPS imprecisa','Comprueba permisos y señal de ubicación.',false)}else if(s.accuracy<70)s.gpsWarned=false;s.heading=Number.isFinite(coords.heading)?coords.heading:null;showLocation(s,pt,s.accuracy);
 if(s.needsPick)return;if(!s.route){compute(s);return}if(s.accuracy<130)nextInstruction(s);
}
async function geocodeDestination(address){
 const raw=String(address||'').trim();const m=raw.match(/^(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)$/);if(m)return point(m[1],m[2]);
 // Usa la búsqueda ya incluida por RUTA CUPISSA, sin crear nuevas claves.
 if(typeof window.geoSearch==='function'){const results=await window.geoSearch(raw);if(results?.[0]?.exact)return point(results[0].la,results[0].ln)}


 return null;}
async function open(order,options={}){
 close();const address=String(order?.address||'Destino del servicio');
 const source=(order?.dest_lat!=null&&order?.dest_lng!=null)?point(order.dest_lat,order.dest_lng):null;
 drawUI(address);
 const hasDestination=valid(source);
 const s=active={title:address,destination:hasDestination?source:point(10.9639,-74.7964),position:null,accuracy:999,voice:true,follow:true,headingUp:true,hasCentered:false,programmaticMove:false,displayPosition:null,lastBearing:0,hasBearing:false,frame:null,heading:null,gps:null,route:null,poly:null,loading:false,pending:false,lastCalc:0,progress:0,spoken:new Set(),offCount:0,arrived:false,lastText:'',abort:null,map:null,picking:false,needsPick:!hasDestination};
 if(!voiceAvailable()){s.voice=false;el('rn-voice').disabled=true;el('rn-voice').textContent='Voz no disponible'}
 try{setupMap(s);updateFollowButton(s);requestAnimationFrame(()=>s.map?.resize())}catch(err){instruction(err.message);return}
 if(options.admin){report(s,'Vista administrativa del destino: puedes inclinar y girar el mapa en 3D.');instruction('Destino del servicio');s.map.once('load',()=>{if(hasDestination)s.map.jumpTo({center:[source.lng,source.lat],zoom:17,pitch:60})});return;}
 if(!window.isSecureContext){instruction('Para activar el GPS utiliza HTTPS.');report(s,'Este sitio debe abrirse mediante HTTPS.');return}
 if(!navigator.geolocation){instruction('GPS no disponible en este navegador.');return}
 // Inicia GPS antes de la geocodificación: evita pantalla inmóvil mientras la búsqueda remota responde.
 s.gps=navigator.geolocation.watchPosition(p=>{
  positionUpdate(s,p);
 },err=>{report(s,'GPS: '+err.message+'. Activa la ubicación en el navegador.');},{enableHighAccuracy:true,maximumAge:4000,timeout:14000});
 // El centro inicial también puede determinarse con ubicación almacenada del dispositivo.
 if(!hasDestination){
  report(s,'Localizando destino; GPS ya está activo.');instruction('Obteniendo dirección de entrega…');
  try{const result=await Promise.race([geocodeDestination(address),new Promise(r=>setTimeout(()=>r(null),6500))]);
   if(active!==s)return;
   if(valid(result)){s.destination=result;s.needsPick=false;updateDestination(s);if(s.position)compute(s,true);else report(s,'Destino encontrado. Esperando GPS…')}
   else{report(s,'No se encontró dirección exacta. Toca «Corregir destino» para indicar el punto.');instruction('Elige el destino en el mapa antes de iniciar la ruta.');}
  }catch(err){if(active===s)report(s,'Selecciona el destino exacto en el mapa.')} 
 }else report(s,'Mapa abierto. Esperando GPS para mostrar la ruta…');
}
async function startOrder(id){if(typeof sb==='undefined'||typeof me==='undefined'||!me||me.role!=='courier'){alert('Debes iniciar sesión como conductor.');return}
 const {data,error}=await sb.from('orders').select('id,address,dest_lat,dest_lng,courier_id,status').eq('id',id).single();
 if(error||!data)return alert('No se pudo consultar la ruta de este servicio.');
 if(data.courier_id!==me.id)return alert('Este servicio no está asignado a tu cuenta.');
 if(data.status==='entregado'||data.status==='cancelado')return alert('El servicio ya no está activo.');
 await open(data);
}
const css=document.createElement('style');css.textContent=`
#rn-shell{position:fixed;inset:0;z-index:9999;background:#faf8f9;display:flex;flex-direction:column;color:#18131c;font-family:Inter,system-ui,Arial,sans-serif}#rn-shell *{box-sizing:border-box}
#rn-shell .rn-top{display:flex;align-items:center;justify-content:space-between;gap:12px;background:#14101a;color:#fff;padding:12px 18px;min-height:66px;border-bottom:3px solid #f4699a}
#rn-shell .rn-brand{display:flex;flex-direction:column;gap:3px}#rn-shell .rn-brand strong{font-size:17px;font-weight:800;letter-spacing:.4px}#rn-shell .rn-brand span{font-size:11px;color:#e6b9cb}
#rn-shell .rn-follow-status{font-size:10px;letter-spacing:.7px;font-weight:800;border:1px solid #fa9ec0;border-radius:99px;padding:7px 10px;color:#ffd5e5}
#rn-shell button{cursor:pointer;border:0;border-radius:12px;padding:11px 15px;background:#e91e78;color:#fff;font-size:13px;font-weight:750;transition:background .15s}
#rn-shell button:hover{background:#bc175f}#rn-shell button:focus-visible{outline:3px solid #e91e78;outline-offset:2px}
#rn-shell .rn-top button{background:#35293b;border:1px solid #5d4055}
#rn-map{flex:1;min-height:190px;background:#e5e8e4;position:relative}
#rn-map .rn-gps-indicator{position:absolute;top:51px;left:14px;z-index:850;background:#fff;padding:9px 13px;border-radius:24px;box-shadow:0 4px 16px #16121c33;font-size:12px;font-weight:800;color:#165c46}
#rn-map .rn-gps-indicator[data-quality="baja"]{color:#a43d20}
#rn-map .rn-view-indicator{position:absolute;top:10px;left:14px;z-index:850;background:#18131ce8;color:#fff;padding:9px 12px;border-radius:12px;font-size:11px;font-weight:800;letter-spacing:.35px;pointer-events:none}
#rn-map .maplibregl-canvas{outline:none}#rn-map .maplibregl-ctrl-attrib{font-size:10px}
#rn-map .rn-map-warning{position:absolute;top:94px;left:14px;z-index:850;background:#fff0dd;padding:10px;border-radius:10px;max-width:300px;font-size:12px}
#rn-map .rn-map-warning[hidden]{display:none}
.rn-driver-icon{background:transparent!important;border:0!important}
.rn-driver-direction{position:relative;display:grid;place-items:center;width:44px;height:44px;background:#19131e;border:4px solid #fff;border-radius:14px 14px 16px 16px;box-shadow:0 4px 16px #0007;transition:transform .3s linear}
.rn-driver-direction:before{content:'';position:absolute;top:-17px;left:11px;border-left:7px solid transparent;border-right:7px solid transparent;border-bottom:16px solid #19131e}
.rn-driver-core{width:13px;height:13px;border-radius:50%;background:#f4699a;border:2px solid #fff}
#rn-shell .rn-panel{padding:10px 18px 12px;background:#fff;box-shadow:0 -7px 25px #1c11231d;max-height:37vh;overflow-y:auto;flex-shrink:0;border-top:3px solid #f4699a}
#rn-shell .rn-destination{display:flex;gap:10px;align-items:baseline;font-size:12px;color:#786974;white-space:normal}#rn-shell .rn-destination span{font-size:10px;font-weight:800;letter-spacing:1px}#rn-shell .rn-destination strong{color:#241822;overflow-wrap:anywhere;font-size:13px}
#rn-shell .rn-maneuver{display:flex;align-items:center;gap:14px;margin:10px 0}#rn-arrow{font-size:44px;font-weight:800;color:#e91e78;line-height:1;flex:0 0 50px}
#rn-next{font-size:22px;line-height:1.2;font-weight:800;color:#201724}#rn-info{font-size:13px;color:#665761;margin-top:5px}
#rn-shell .rn-progress{height:7px;background:#f6e0e9;border-radius:12px;overflow:hidden;margin:8px 0}#rn-progress-bar{height:100%;width:0;background:linear-gradient(90deg,#f4699a,#db137a);transition:width .4s linear}
#rn-shell .rn-signal{font-size:12px;color:#7d4c31;background:#fff8ed;padding:8px 10px;border-radius:9px;border-left:3px solid #e9a34b;margin:8px 0}
#rn-status{font-size:12px;color:#4e4351;background:#f6f3f6;padding:9px 11px;border-radius:9px;margin:8px 0}
#rn-shell .rn-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:9px}
#rn-shell .rn-actions button{background:#2b202e}#rn-shell #rn-center[aria-pressed="true"]{background:#217a62}
#rn-shell .rn-caution{display:block;color:#796b77;font-size:11px;line-height:1.5;margin-top:10px}
@media(max-width:600px){#rn-shell .rn-top{padding:9px 12px;min-height:57px}#rn-shell .rn-brand strong{font-size:14px}#rn-shell .rn-follow-status{display:none}#rn-next{font-size:18px}#rn-shell .rn-panel{max-height:36vh;padding:9px 12px}#rn-shell .rn-actions button{padding:9px;font-size:12px}#rn-shell .rn-maneuver{margin:7px 0}}
`;document.head.appendChild(css);
window.RutaNavegacion={startOrder,open,stop:close};
})();
