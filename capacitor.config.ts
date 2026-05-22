import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.11d72e363a2b40aab811312fd7797cbb',
  appName: 'Encargado Las Inrival',
  webDir: 'dist',
  server: {
    url: 'https://lasinrival.lovable.app/encargado',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;