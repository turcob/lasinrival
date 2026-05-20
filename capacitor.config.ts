import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.11d72e363a2b40aab811312fd7797cbb',
  appName: 'Encargado Las Inrival',
  webDir: 'dist',
  server: {
    url: 'https://11d72e36-3a2b-40aa-b811-312fd7797cbb.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;