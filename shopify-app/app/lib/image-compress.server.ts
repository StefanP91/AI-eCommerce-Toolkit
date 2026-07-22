import sharp from "sharp";

const MAX_WIDTH = 1200;
const JPEG_QUALITY = 82;

export type CompressedImage = {
  bytes: Buffer;
  mimeType: "image/jpeg";
  sizeKb: number;
  width: number;
  height: number;
  dimensions: string;
  wasResized: boolean;
  originalSizeKb: number;
  originalDimensions: string | null;
  savingsPercent: number;
};

export async function fetchImageBuffer(imageUrl: string): Promise<{
  bytes: Buffer;
  mimeType: string;
  sizeKb: number;
} | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return null;
    const mimeType = response.headers.get("content-type") || "image/jpeg";
    if (!mimeType.startsWith("image/")) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    return {
      bytes,
      mimeType,
      sizeKb: roundKb(bytes.byteLength),
    };
  } catch {
    return null;
  }
}

export async function compressProductImage(
  source: Buffer,
): Promise<CompressedImage> {
  const originalSizeKb = roundKb(source.byteLength);
  const image = sharp(source, { failOn: "none" });
  const meta = await image.metadata();
  const originalWidth = meta.width || 0;
  const originalHeight = meta.height || 0;
  const originalDimensions =
    originalWidth > 0 && originalHeight > 0
      ? `${originalWidth}x${originalHeight}`
      : null;

  let pipeline = image.rotate();
  let wasResized = false;

  if (originalWidth > MAX_WIDTH) {
    pipeline = pipeline.resize({
      width: MAX_WIDTH,
      withoutEnlargement: true,
    });
    wasResized = true;
  }

  // Keep alpha as white background for JPEG.
  const bytes = await pipeline
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();

  const outMeta = await sharp(bytes).metadata();
  const width = outMeta.width || originalWidth || 0;
  const height = outMeta.height || originalHeight || 0;
  const sizeKb = roundKb(bytes.byteLength);

  return {
    bytes,
    mimeType: "image/jpeg",
    sizeKb,
    width,
    height,
    dimensions: width && height ? `${width}x${height}` : originalDimensions || "—",
    wasResized,
    originalSizeKb,
    originalDimensions,
    savingsPercent: savingsPercent(originalSizeKb, sizeKb),
  };
}

export function toDataUrl(bytes: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${bytes.toString("base64")}`;
}

export function savingsPercent(
  originalKb: number,
  optimizedKb: number,
): number {
  if (originalKb <= 0) return 0;
  const value = ((originalKb - optimizedKb) / originalKb) * 100;
  return Math.max(0, Math.round(value * 10) / 10);
}

function roundKb(bytes: number): number {
  return Math.round((bytes / 1024) * 10) / 10;
}
