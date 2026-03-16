/**
 * Image Annotation Module
 *
 * Draws bounding boxes and activity labels on images using Jimp.
 * Returns annotated images as base64 data URLs.
 */

import { Jimp, JimpMime } from "jimp";
import type { DetectionResult, ActivityLabel } from "./activityClassifier.js";

/** Color map for each activity (RGBA as 0xRRGGBBAA) */
const ACTIVITY_COLORS: Record<ActivityLabel, number> = {
  walking:     0x3b82f6ff, // blue
  sitting:     0x22c55eff, // green
  running:     0xeab308ff, // yellow
  falling:     0xef4444ff, // red
  using_phone: 0xf97316ff, // orange
  fighting:    0xdc2626ff, // dark red
};

/**
 * Draws a rectangle outline on a Jimp image.
 */
function drawRect(
  image: Jimp,
  x: number,
  y: number,
  w: number,
  h: number,
  color: number,
  thickness = 3
): void {
  const imgW = image.bitmap.width;
  const imgH = image.bitmap.height;

  for (let t = 0; t < thickness; t++) {
    // Top edge
    for (let px = x; px < x + w && px < imgW; px++) {
      if (y + t < imgH) image.setPixelColor(color, px, y + t);
    }
    // Bottom edge
    for (let px = x; px < x + w && px < imgW; px++) {
      if (y + h - t < imgH && y + h - t >= 0)
        image.setPixelColor(color, px, y + h - t);
    }
    // Left edge
    for (let py = y; py < y + h && py < imgH; py++) {
      if (x + t < imgW) image.setPixelColor(color, x + t, py);
    }
    // Right edge
    for (let py = y; py < y + h && py < imgH; py++) {
      if (x + w - t < imgW && x + w - t >= 0)
        image.setPixelColor(color, x + w - t, py);
    }
  }
}

/**
 * Annotate image with bounding boxes.
 * Returns base64-encoded PNG data URL.
 */
export async function annotateImage(
  imageBuffer: Buffer,
  detections: DetectionResult[]
): Promise<string> {
  const image = await Jimp.fromBuffer(imageBuffer);

  for (const det of detections) {
    const { bbox, activity, confidence } = det;
    const color = ACTIVITY_COLORS[activity] ?? 0xffffffff;

    // Draw bounding box
    drawRect(
      image,
      Math.max(0, bbox.x),
      Math.max(0, bbox.y),
      Math.min(bbox.width, image.bitmap.width - bbox.x),
      Math.min(bbox.height, image.bitmap.height - bbox.y),
      color,
      3
    );

    // Draw a small filled label background square at top of bbox
    const labelY = Math.max(0, bbox.y - 20);
    const labelW = Math.min(120, image.bitmap.width - bbox.x);
    for (let ly = labelY; ly < labelY + 18 && ly < image.bitmap.height; ly++) {
      for (let lx = bbox.x; lx < bbox.x + labelW && lx < image.bitmap.width; lx++) {
        image.setPixelColor(color, lx, ly);
      }
    }
  }

  const base64 = await image.getBase64(JimpMime.png);
  return base64;
}

/**
 * Get image dimensions from buffer without full decode.
 */
export async function getImageDimensions(
  buffer: Buffer
): Promise<{ width: number; height: number }> {
  const image = await Jimp.fromBuffer(buffer);
  return { width: image.bitmap.width, height: image.bitmap.height };
}
