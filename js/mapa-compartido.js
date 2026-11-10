/* CUPISSA Domis — mapa compartido para administración, selección de destinos y navegación.
 * OpenStreetMap se usa sin API key. Servicio comunitario best-effort: para uso intensivo
 * en producción contratar un proveedor de mosaicos con SLA.
 */
(()=>{'use strict';
const centers=Object.freeze({'Barranquilla':[10.9639,-74.7964],'Soledad':[10.9184,-74.7646],'Malambo':[10.8595,-74.7744],'Puerto Colombia':[11.016,-74.886],'Galapa':[10.896,-74.887]});
const OSM='https://tile.openstreetmap.org/{z}/{x}/{y}.png';
function attach(map){
 if(!map||!window.L)throw Error('No se pudo inicializar Leaflet.');
 const layer=L.tileLayer(OSM,{
  attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>',
  minZoom:2,maxNativeZoom:19,maxZoom:20,keepBuffer:2,updateWhenIdle:true,
  crossOrigin:false
 });
 layer.addTo(map);
 // Un mosaico defectuoso no se considera funcional: mostrar aviso sin bloquear el GPS.
 let errors=0;
 const container=map.getContainer();
 let notice;
 function warn(){
  if(notice||errors<4)return;
  notice=document.createElement('div');notice.className='cupissa-map-error';
  notice.setAttribute('role','status');
  notice.textContent='No fue posible cargar las calles. Comprueba la conexión a internet y vuelve a abrir el mapa.';
  container.appendChild(notice);
 }
 layer.on('tileerror',()=>{errors++;warn()});
 layer.on('tileload',()=>{errors=0;if(notice){notice.remove();notice=null}});
 map.whenReady(()=>requestAnimationFrame(()=>map.invalidateSize({pan:false})));
 return ()=>{if(map.hasLayer(layer))map.removeLayer(layer);if(notice)notice.remove()};
}
window.RutaMapa=Object.freeze({attach,centers});
})();
