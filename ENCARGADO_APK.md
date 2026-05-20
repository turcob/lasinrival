# Generar APK del módulo Encargado

Esta app usa **Capacitor** para empaquetar la versión web del módulo `/encargado` como APK Android nativo. Lovable no compila el APK directamente: el build final se hace en tu máquina con Android Studio.

La configuración actual (`capacitor.config.ts`) usa **hot-reload desde Lovable**: el APK carga la URL del preview en vivo, así no hace falta recompilar al cambiar la web. Para una versión 100% offline / Play Store, ver el bloque final.

## Requisitos en tu máquina

- Node.js 18+
- [Android Studio](https://developer.android.com/studio) (instala el SDK Android y un emulador, o conectá un teléfono con depuración USB activada)
- Java JDK 17 (lo trae Android Studio)

## Pasos (primera vez)

1. **Exportar el proyecto a GitHub** desde Lovable (botón *Export to GitHub*) y clonarlo:
   ```bash
   git clone <tu-repo>
   cd <tu-repo>
   npm install
   ```

2. **Agregar la plataforma Android** (solo la primera vez):
   ```bash
   npx cap add android
   npx cap update android
   ```

3. **Build web + sync con Android**:
   ```bash
   npm run build
   npx cap sync android
   ```

4. **Abrir en Android Studio**:
   ```bash
   npx cap open android
   ```
   Esperá a que Gradle termine de sincronizar.

5. **Generar el APK**:
   - En Android Studio: menú **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
   - Cuando termine, aparece un aviso con un link **locate**. El archivo está en:
     `android/app/build/outputs/apk/debug/app-debug.apk`
   - Copialo al teléfono e instalalo (habilitando "Orígenes desconocidos").

## Probar en un dispositivo / emulador rápido

```bash
npx cap run android
```

## Actualizar la app después de cambios en Lovable

Como el APK está configurado para cargar la URL del preview (`capacitor.config.ts → server.url`), **no hace falta recompilar el APK** cuando cambia el código web. Simplemente:

1. En Lovable, hacé los cambios.
2. Abrí la app en el teléfono → ya cargan los cambios.

Si cambiás `capacitor.config.ts`, plugins nativos o íconos, repetí:
```bash
git pull
npm install
npm run build
npx cap sync android
```
y volvé a generar el APK desde Android Studio.

## Pantalla inicial: directo al login del Encargado

El usuario verá la pantalla de login y, al entrar, va a `/encargado`. Si querés que el APK abra siempre la ruta `/encargado` aunque cierre sesión, en `capacitor.config.ts` cambiá:
```ts
server: {
  url: 'https://11d72e36-3a2b-40aa-b811-312fd7797cbb.lovableproject.com/encargado?forceHideBadge=true',
  cleartext: true,
}
```

## Cámara nativa

Ya está instalado `@capacitor/camera`. En el sheet de cobro, cuando el medio de pago es **transferencia**, el botón abre la cámara nativa Android (o galería) en lugar del selector de archivos del navegador. No requiere configuración extra: los permisos se piden la primera vez que se usa.

## Build para producción / Play Store (sin hot-reload)

Si querés un APK que **no dependa del preview de Lovable** (recomendado para Play Store):

1. Editá `capacitor.config.ts` y **eliminá el bloque `server`** completo.
2. `npm run build && npx cap sync android`
3. En Android Studio: **Build → Generate Signed Bundle / APK** y seguí los pasos para firmar.

Más info: https://lovable.dev/blog/mobile-development-with-capacitor