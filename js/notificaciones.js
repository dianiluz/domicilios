/* CUPISSA: avisos de sesión, sincronización por Realtime y comprobación periódica.
 * NOTA: no son Web Push de servidor; la pestaña/PWA debe estar en ejecución.
 */
(()=>{'use strict';
let db,user,channel,timer,initialized=false,unread=0;
const known=new Map(),history=[];
const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const idOf=(table,row)=>table+':'+row.id;
const stamp=()=>new Date().toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'});
function ensure(){if(document.getElementById('cupissa-notices'))return;
 const node=document.createElement('aside');node.id='cupissa-notices';node.innerHTML='<button id="cupissa-bell" type="button" title="Notificaciones" aria-label="Ver notificaciones">Avisos <b id="cupissa-notice-count"></b></button><section id="cupissa-notice-panel" hidden><div class="cupissa-notice-title"><b>Notificaciones</b><button id="cupissa-permission" type="button">Activar avisos del dispositivo</button></div><div id="cupissa-notice-list">Sin notificaciones nuevas.</div><p class="cupissa-notice-help">Avisos de la aplicación abierta. Para recibirlos con la app completamente cerrada se necesita configurar Web Push en el servidor.</p></section><div id="cupissa-toast-stack" aria-live="polite"></div>';
 document.body.append(node);
 document.getElementById('cupissa-bell').onclick=()=>{const p=document.getElementById('cupissa-notice-panel');p.hidden=!p.hidden;if(!p.hidden){unread=0;document.getElementById('cupissa-notice-count').textContent='';render()}};
 document.getElementById('cupissa-permission').onclick=async()=>{if(!('Notification' in window)){emit('Este navegador no admite avisos del sistema.','Los avisos dentro de la aplicación seguirán funcionando.',false);return}const result=await Notification.requestPermission();emit(result==='granted'?'Avisos del dispositivo activos':'Permiso de avisos no concedido',result==='granted'?'Se mostrarán cuando la app siga abierta en segundo plano.':'Puedes continuar recibiendo avisos en pantalla.',false)};
}
function render(){const node=document.getElementById('cupissa-notice-list');if(node)node.innerHTML=history.length?history.map(h=>`<div class="cupissa-notice-item"><small>${esc(h.time)}</small><strong>${esc(h.title)}</strong><div>${esc(h.body)}</div></div>`).join(''):'Sin notificaciones nuevas.'}
function emit(title,body='',system=true){ensure();history.unshift({title,body,time:stamp()});history.splice(60);unread++;const badge=document.getElementById('cupissa-notice-count');if(badge)badge.textContent=unread>99?'99+':unread;render();
 const item=document.createElement('div');item.className='cupissa-toast';item.innerHTML=`<strong>${esc(title)}</strong><span>${esc(body)}</span>`;document.getElementById('cupissa-toast-stack').append(item);setTimeout(()=>item.remove(),6500);
 if(system&&document.visibilityState==='hidden'&&'Notification' in window&&Notification.permission==='granted'){
  navigator.serviceWorker?.ready.then(r=>r.showNotification(title,{body,icon:'logo/icon-192.png',tag:'cupissa-'+title,renotify:true})).catch(()=>{});
 }
 if(system&&navigator.vibrate)try{navigator.vibrate([100,70,100])}catch{}
}
function relevant(table,row){if(!row)return false;if(user.role==='admin')return true;
 if(table==='orders')return row.courier_id===user.id;
 if(table==='messages')return row.courier_id===user.id&&row.sender_role!=='courier';
 return false;
}
function descriptor(table,row,previous){if(table==='orders'){
 const name=row.address||row.client_name||'Servicio';
 if(!previous)return ['Nuevo servicio',name];
 if(previous.courier_id!==row.courier_id)return [row.courier_id?'Servicio asignado':'Servicio sin asignar',name];
 if(previous.status!==row.status)return ['Servicio: '+(row.status||'actualizado'),name];
 if(!previous.transfer_photo&&row.transfer_photo)return ['Comprobante recibido',name];
 if(!previous.signature&&row.signature)return ['Firma registrada',name];
 if(!previous.photo&&row.photo)return ['Evidencia de entrega',name];
 return null;
 }
 if(table==='messages'){if(row.sender_id===user.id)return null;return ['Nuevo mensaje',row.kind&&row.kind!=='texto'?row.kind+': '+(row.body||''):(row.body||'Mensaje recibido')];}
 if(table==='solicitudes_servicio')return previous?['Solicitud: '+(row.status||'actualizada'),row.destination||'Solicitud de cliente']:['Nueva solicitud de cliente',row.destination||'Pendiente de revisión'];
 if(table==='mensajes_chat')return row.sender_role===user.role?null:['Mensaje de cliente',row.message||'Nuevo mensaje'];
 return null;
}
function observe(table,row,first=false){if(!row?.id||!relevant(table,row))return;
 const key=idOf(table,row),prev=known.get(key);
 if(prev&&(table==='messages'||table==='mensajes_chat'))return;
 if(prev&&JSON.stringify(prev)===JSON.stringify(row))return;
 known.set(key,row);
 if(first||initialized===false||(!prev&&row.created_at&&Date.now()-new Date(row.created_at).getTime()>90000))return;
 const info=descriptor(table,row,prev);if(info)emit(...info);
}
async function poll(){if(!db||!user)return;
 try{
  const start=new Date(Date.now()-24*3600*1000).toISOString();
  const requests=[['orders',db.from('orders').select('id,address,client_name,courier_id,status,created_at,transfer_photo,signature,photo').gte('created_at',start).order('created_at',{ascending:false}).limit(100)],
   ['messages',db.from('messages').select('id,courier_id,sender_id,sender_role,body,kind,created_at').gte('created_at',start).order('created_at',{ascending:false}).limit(100)]];
  if(user.role==='admin')requests.push(['solicitudes_servicio',db.from('solicitudes_servicio').select('id,destination,status').order('created_at',{ascending:false}).limit(60)],['mensajes_chat',db.from('mensajes_chat').select('id,passenger_id,sender_role,message,created_at').order('created_at',{ascending:false}).limit(60)]);
  const result=await Promise.all(requests.map(async ([name,q])=>[name,await q]));
  for(const [table,response] of result)if(!response.error)for(const row of (response.data||[]).reverse())observe(table,row,!initialized);
  initialized=true;
 }catch(err){console.warn('No se pudieron comprobar notificaciones:',err)}
}
async function start(dbClient,profile){stop();db=dbClient;user=profile;initialized=false;unread=0;known.clear();history.length=0;ensure();render();
 await poll();
 if(!db||!user)return;
 channel=db.channel('cupissa-notificaciones-'+user.id)
  .on('postgres_changes',{event:'*',schema:'public',table:'orders'},p=>{if(p.new?.id)observe('orders',p.new)})
  .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},p=>{if(p.new?.id)observe('messages',p.new)})
  .on('postgres_changes',{event:'*',schema:'public',table:'solicitudes_servicio'},p=>{if(user?.role==='admin'&&p.new?.id)observe('solicitudes_servicio',p.new)})
  .on('postgres_changes',{event:'INSERT',schema:'public',table:'mensajes_chat'},p=>{if(user?.role==='admin'&&p.new?.id)observe('mensajes_chat',p.new)})
  .subscribe();
 timer=setInterval(poll,22000);
}
function stop(){if(timer)clearInterval(timer);timer=null;if(db&&channel)db.removeChannel(channel);channel=null;initialized=false;user=null;}
window.RutaNotificaciones={start,stop,emit};
const css=document.createElement('style');css.textContent=`#cupissa-notices{position:fixed;right:12px;top:74px;z-index:10020;font:13px system-ui;color:#24131c;pointer-events:none}#cupissa-notices button{pointer-events:auto}#cupissa-bell{display:block;margin-left:auto;border:1px solid #fff;background:#21121b;color:#fff;box-shadow:0 4px 18px #0003;border-radius:25px;padding:10px 15px;font-weight:700}#cupissa-notice-count:not(:empty){background:#f4699a;color:#210915;padding:2px 7px;border-radius:20px;margin-left:4px}#cupissa-notice-panel{pointer-events:auto;background:#fff;width:min(360px,calc(100vw - 24px));max-height:65vh;overflow:auto;border:1px solid #eadce5;border-radius:16px;box-shadow:0 12px 38px #0004;margin-top:8px;padding:12px}#cupissa-notice-panel[hidden]{display:none}.cupissa-notice-title{display:flex;justify-content:space-between;align-items:center;gap:8px}.cupissa-notice-title button{width:auto;background:#f4699a;color:#000;font-size:11px;padding:7px;border-radius:9px}.cupissa-notice-item{padding:9px;border-bottom:1px solid #eee;overflow-wrap:anywhere}.cupissa-notice-item small{display:block;color:#777}.cupissa-notice-item strong{display:block}.cupissa-notice-help{font-size:11px;color:#777}#cupissa-toast-stack{position:fixed;top:120px;right:12px;display:flex;flex-direction:column;gap:8px;width:min(340px,calc(100vw - 24px));pointer-events:none}.cupissa-toast{padding:12px;border-left:4px solid #f4699a;border-radius:12px;background:#fff;box-shadow:0 5px 24px #0004;display:flex;flex-direction:column;gap:4px;animation:cupissa-toast-in .2s ease}.cupissa-toast span{overflow-wrap:anywhere}@keyframes cupissa-toast-in{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}@media(max-width:600px){#cupissa-notices{top:63px;right:8px}#cupissa-bell{padding:8px 11px;font-size:11px}}`;document.head.append(css);
})();
