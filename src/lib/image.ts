/**
 * Image intake for the composer.
 *
 * Photos arrive at phone-camera sizes, which are too large to keep in a chat
 * transcript (localStorage) and slower to upload. Everything is re-encoded to a
 * bounded edge length before it reaches the model.
 */

const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
const MAX_EDGE = 1280;
const QUALITY = 0.86;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") resolve(result);
      else reject(new Error("That image couldn't be read."));
    };
    reader.onerror = () => reject(new Error("That image couldn't be read."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("That image couldn't be decoded."));
    image.src = src;
  });
}

/** Downscale to MAX_EDGE and re-encode; falls back to the original data URL. */
async function shrink(dataUrl: string): Promise<string> {
  const image = await loadImage(dataUrl);
  const widest = Math.max(image.naturalWidth, image.naturalHeight);
  if (!widest) return dataUrl;

  const scale = Math.min(1, MAX_EDGE / widest);
  const width = Math.round(image.naturalWidth * scale);
  const height = Math.round(image.naturalHeight * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return dataUrl;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const encoded = canvas.toDataURL("image/webp", QUALITY);
  return encoded.startsWith("data:image/") ? encoded : dataUrl;
}

export async function prepareImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("That file isn't an image.");
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error("That image is too large — try one under 15 MB.");
  }
  const dataUrl = await readAsDataUrl(file);
  try {
    return await shrink(dataUrl);
  } catch {
    return dataUrl;
  }
}
