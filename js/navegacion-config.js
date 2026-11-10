/* Prototipo: los mosaicos comunitarios no ofrecen SLA comercial.
 * No descargar masivamente ni precargar tiles; respetar atribución y caché.
 */
window.RUTA_NAV_CONFIG = Object.freeze({
  tiles: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  motor: 'valhalla',
  valhalla: 'https://valhalla1.openstreetmap.de/route',
  osrm: 'https://router.project-osrm.org'
});
