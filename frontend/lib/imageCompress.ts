// Phone-camera screenshots are often 3-8MB, which is slow (and prone to
// failing against the backend's 5MB upload limit) over weak mobile
// connections. Downscale + re-encode to JPEG client-side before it ever
// hits the network, so the first upload attempt is small and fast.
//
// Guarded with a hard timeout: some older/in-app-browser WebViews either
// lack createImageBitmap or have it hang indefinitely on certain image
// formats, which would otherwise freeze the "preparing image" step forever.
// If it doesn't finish in time, fall back to uploading the original file.
export async function compressImage(file: File, maxDim = 1280, quality = 0.7): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < 350 * 1024 || typeof createImageBitmap !== "function") {
    return file;
  }

  const doCompress = async (): Promise<File> => {
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;
    if (width > maxDim || height > maxDim) {
      const scale = maxDim / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  };

  try {
    return await Promise.race([
      doCompress(),
      new Promise<File>((resolve) => setTimeout(() => resolve(file), 6000)),
    ]);
  } catch {
    return file; // any failure (e.g. unsupported format) → fall back to the original
  }
}
