export type LensGeometry = {
  left: number;
  top: number;
  bgW: number;
  bgH: number;
  bgX: number;
  bgY: number;
};

/** Map a container-relative pointer to a zoomed, centered object-contain image. */
export function lensGeometry(
  px: number,
  py: number,
  boxW: number,
  boxH: number,
  natW: number,
  natH: number,
  lens: number,
  zoom = 3,
): LensGeometry | null {
  const positive = (n: number) => Number.isFinite(n) && n > 0;
  if (
    ![boxW, boxH, natW, natH, lens, zoom].every(positive) ||
    !Number.isFinite(px) ||
    !Number.isFinite(py)
  )
    return null;
  const scale = Math.min(boxW / natW, boxH / natH);
  const width = natW * scale;
  const height = natH * scale;
  const imageX = px - (boxW - width) / 2;
  const imageY = py - (boxH - height) / 2;
  if (imageX < 0 || imageY < 0 || imageX > width || imageY > height) return null;
  return {
    left: px,
    top: py,
    bgW: width * zoom,
    bgH: height * zoom,
    bgX: lens / 2 - imageX * zoom,
    bgY: lens / 2 - imageY * zoom,
  };
}
