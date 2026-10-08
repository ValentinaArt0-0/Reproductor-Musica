/**
 * Dominant-color extraction for the Zen mode background.
 *
 * Whatever the cover looks like, colors are "softened" (limited saturation and lightness) so
 * the result always stays in the calm, warm range of the app and never reaches pure
 * white or black.
 */
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Palette {
  primary: Rgb;
  secondary: Rgb;
  accent: Rgb;
}

// ---- Color helpers ------------------------------------------------------------------
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const SAND: Rgb = { r: 244, g: 241, b: 234 }; // #f4f1ea
export const INK: Rgb = { r: 47, g: 58, b: 54 }; // #2f3a36

/** Comma syntax on purpose: Framer Motion can interpolate it between two values. */
export const rgba = (c: Rgb, alpha = 1): string =>
  `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${alpha})`;

export const mix = (a: Rgb, b: Rgb, amount: number): Rgb => ({
  r: a.r + (b.r - a.r) * amount,
  g: a.g + (b.g - a.g) * amount,
  b: a.b + (b.b - a.b) * amount,
});

function rgbToHsl({ r, g, b }: Rgb): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

/** Keeps a color in the calm range: moderate saturation, mid-light lightness. */
function soften(color: Rgb): Rgb {
  const { h, s, l } = rgbToHsl(color);
  return hslToRgb(h, clamp(s, 0.18, 0.55), clamp(l, 0.45, 0.78));
}

function shiftHue(color: Rgb, degrees: number): Rgb {
  const { h, s, l } = rgbToHsl(color);
  return hslToRgb((h + degrees) % 360, s, l);
}

const distance = (a: Rgb, b: Rgb) => Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);

// ---- Palette from pixels (pure, testable) ---------------------------------------------------
/**
 * @param pixels RGBA bytes (like canvas ImageData.data).
 * @returns three distinct dominant colors, or null when the image has no usable color.
 */
export function computePalette(pixels: ArrayLike<number>): Palette | null {
  const buckets = new Map<number, { weight: number; r: number; g: number; b: number }>();

  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue; // transparent
    const color = { r: pixels[i], g: pixels[i + 1], b: pixels[i + 2] };
    const { s, l } = rgbToHsl(color);
    if (l < 0.1 || l > 0.93) continue; // near black / near white carry no mood
    const weight = 0.15 + s * s; // vivid colors dominate, grays still count a little
    const key = ((color.r >> 5) << 6) | ((color.g >> 5) << 3) | (color.b >> 5);
    const bucket = buckets.get(key) ?? { weight: 0, r: 0, g: 0, b: 0 };
    bucket.weight += weight;
    bucket.r += color.r * weight;
    bucket.g += color.g * weight;
    bucket.b += color.b * weight;
    buckets.set(key, bucket);
  }
  if (buckets.size === 0) return null;

  const ranked = Array.from(buckets.values())
    .sort((x, y) => y.weight - x.weight)
    .map((bucket): Rgb => ({ r: bucket.r / bucket.weight, g: bucket.g / bucket.weight, b: bucket.b / bucket.weight }));

  const picked: Rgb[] = [];
  for (const candidate of ranked) {
    if (picked.every((existing) => distance(existing, candidate) > 70)) picked.push(candidate);
    if (picked.length === 3) break;
  }
  while (picked.length < 3) picked.push(shiftHue(picked[0], picked.length * 30)); // mono-color covers

  return { primary: soften(picked[0]), secondary: soften(picked[1]), accent: soften(picked[2]) };
}

// ---- Fallback palettes (brand colors) ----------------------------------------------------------
const hex = (value: string): Rgb => ({
  r: parseInt(value.slice(1, 3), 16),
  g: parseInt(value.slice(3, 5), 16),
  b: parseInt(value.slice(5, 7), 16),
});

const FALLBACKS: Array<[string, string, string]> = [
  ["#7f9a8e", "#bfb7d6", "#ddd6c5"],
  ["#a59cc2", "#b9c7c1", "#d8b7a6"],
  ["#9db0a7", "#d9d4e6", "#e0c9a6"],
  ["#8d83ac", "#a8c0b5", "#e3d3b8"],
  ["#b7a58f", "#9db0a7", "#c9c2dd"],
];

/** Same seed (song id) -> same palette, so a song without cover always gets the same mood. */
export function fallbackPalette(seed: string): Palette {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const [primary, secondary, accent] = FALLBACKS[hash % FALLBACKS.length];
  return { primary: hex(primary), secondary: hex(secondary), accent: hex(accent) };
}

// ---- Browser part: read the cover pixels -----------------------------------------------------------
const cache = new Map<string, Palette | null>();

/** Downsamples the cover on a canvas. Returns null if it cannot be read (e.g. CORS). */
export async function extractPalette(url: string): Promise<Palette | null> {
  if (cache.has(url)) return cache.get(url) ?? null;

  let palette: Palette | null = null;
  try {
    const image = new Image();
    image.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("cover failed to load"));
      image.src = url;
    });
    const size = 48;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (context) {
      context.drawImage(image, 0, 0, size, size);
      palette = computePalette(context.getImageData(0, 0, size, size).data); // throws if tainted
    }
  } catch {
    palette = null;
  }

  cache.set(url, palette);
  return palette;
}
