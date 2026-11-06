import { Capacitor, CapacitorHttp, registerPlugin } from '@capacitor/core';
import { Camera, CameraDirection, CameraResultType, CameraSource } from '@capacitor/camera';
import { LocalNotifications } from '@capacitor/local-notifications';

const BackgroundGeolocation = registerPlugin('BackgroundGeolocation');
window.Capacitor = Capacitor;
window.CUPISSA_BG = BackgroundGeolocation;
window.CUPISSA_NOTIFICATIONS = LocalNotifications;
window.CUPISSA_CAMERA = {
  async getPhoto(options = {}) {
    return Camera.getPhoto({
      quality: options.quality ?? 85,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
      direction: CameraDirection.Rear,
      saveToGallery: false
    });
  }
};

// Supabase REST/Auth requests use Capacitor's native HTTP stack on Android.
// This avoids relying on WebView background fetch throttling during a shift.
window.CUPISSA_FETCH = async (input, init = {}) => {
  if (!Capacitor.isNativePlatform()) return fetch(input, init);
  const url = typeof input === 'string' ? input : input.url;
  const method = init.method || input.method || 'GET';
  const headers = Object.fromEntries(new Headers(init.headers || input.headers || {}).entries());
  let data = init.body;
  if (data instanceof URLSearchParams) data = data.toString();
  if (data instanceof Blob) data = await data.text();
  if (data instanceof ArrayBuffer) data = new TextDecoder().decode(data);
  const result = await CapacitorHttp.request({
    url,
    method,
    headers,
    data,
    responseType: 'text',
    connectTimeout: 20000,
    readTimeout: 30000
  });
  const status = result.status || 200;
  const body = [204, 205, 304].includes(status) ? null :
    (typeof result.data === 'string' ? result.data : JSON.stringify(result.data ?? null));
  return new Response(body, { status, headers: result.headers || {} });
};

window.dispatchEvent(new Event('cupissa-native-ready'));
