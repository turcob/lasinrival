// Helper para capturar foto con cámara nativa (Capacitor) y fallback web.
// En el APK usa @capacitor/camera; en el navegador devuelve null para que
// el componente siga usando el <input type="file"> tradicional.

export async function isNativePlatform(): Promise<boolean> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export async function tomarFotoNativa(): Promise<File | null> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return null;

    const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');

    const photo = await Camera.getPhoto({
      quality: 70,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Prompt, // permite elegir cámara o galería
      saveToGallery: false,
      promptLabelHeader: 'Comprobante de transferencia',
      promptLabelPhoto: 'Elegir de galería',
      promptLabelPicture: 'Tomar foto',
    });

    if (!photo.dataUrl) return null;

    const res = await fetch(photo.dataUrl);
    const blob = await res.blob();
    const ext = (photo.format || 'jpg').toLowerCase();
    const filename = `comprobante-${Date.now()}.${ext}`;
    return new File([blob], filename, { type: blob.type || `image/${ext}` });
  } catch (e) {
    console.error('[nativeCamera] error', e);
    return null;
  }
}