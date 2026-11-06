import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'com.cupissa.domis',
  appName: 'CUPISSA DOMIS',
  webDir: 'dist',
  android: { useLegacyBridge: true },
  plugins: { CapacitorHttp: { enabled: true } }
};
export default config;
