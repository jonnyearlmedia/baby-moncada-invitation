import type { GuestbookFrame } from "@/lib/guestbook";

export const FRAME_WIDTH = 1080;
export const FRAME_HEIGHT = 1350;

export const FRAME_OPTIONS: { id: GuestbookFrame; label: string }[] = [
  { id: "boarding", label: "Boarding pass" },
  { id: "polaroid", label: "Polaroid" },
  { id: "stamp", label: "Passport stamp" },
  { id: "none", label: "No frame" },
];

const NAVY = "#183e5d";
const PAPER = "#fffdf8";
const MUTED = "#5b7183";
const SKY = "#dce9f2";

type Fonts = { serif: string; mono: string; script: string };

function readFonts(): Fonts {
  const styles = getComputedStyle(document.body);
  const read = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
  return {
    serif: read("--font-ticket-serif", "Georgia, serif"),
    mono: read("--font-ticket-mono", "ui-monospace, monospace"),
    script: read("--font-ticket-script", "cursive"),
  };
}

async function ensureFonts(fonts: Fonts) {
  if (!document.fonts) return;
  await Promise.allSettled([
    document.fonts.load(`400 80px ${fonts.serif}`),
    document.fonts.load(`600 30px ${fonts.mono}`),
    document.fonts.load(`600 90px ${fonts.script}`),
  ]);
}

export async function loadPhoto(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Crops like object-fit: cover, biased upward because selfies put faces in the top half.
function drawCover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (image.naturalWidth - sw) / 2;
  const sy = (image.naturalHeight - sh) * 0.4;
  ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
}

function roundedClip(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.clip();
}

function spaced(ctx: CanvasRenderingContext2D, value: string) {
  if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = value;
}

function drawBoarding(ctx: CanvasRenderingContext2D, image: HTMLImageElement, fonts: Fonts) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, FRAME_WIDTH, FRAME_HEIGHT);

  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, FRAME_WIDTH, 140);
  ctx.fillStyle = PAPER;
  ctx.font = `600 32px ${fonts.mono}`;
  spaced(ctx, "6px");
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText("MONCADA AIRWAYS", 60, 72);
  ctx.textAlign = "right";
  ctx.fillText("FLT JF926", FRAME_WIDTH - 60, 72);

  ctx.save();
  roundedClip(ctx, 60, 190, 960, 820, 20);
  drawCover(ctx, image, 60, 190, 960, 820);
  ctx.restore();

  ctx.strokeStyle = "rgba(24,62,93,.35)";
  ctx.lineWidth = 4;
  ctx.setLineDash([18, 14]);
  ctx.beginPath();
  ctx.moveTo(48, 1062);
  ctx.lineTo(FRAME_WIDTH - 48, 1062);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = SKY;
  for (const x of [0, FRAME_WIDTH]) {
    ctx.beginPath();
    ctx.arc(x, 1062, 30, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = MUTED;
  ctx.font = `600 24px ${fonts.mono}`;
  spaced(ctx, "5px");
  ctx.fillText("DESTINATION", 64, 1142);
  ctx.fillStyle = NAVY;
  ctx.font = `400 84px ${fonts.serif}`;
  spaced(ctx, "0px");
  ctx.fillText("Baby Moncada", 60, 1226);
  ctx.fillStyle = MUTED;
  ctx.font = `600 24px ${fonts.mono}`;
  spaced(ctx, "4px");
  ctx.fillText("09.26.26 · GATE REUNION ROOM · SEAT OPEN", 64, 1290);

  ctx.fillStyle = NAVY;
  const bars = [3, 1, 2, 1, 1, 2, 3, 1, 1, 3, 2, 1];
  for (let x = 836, index = 0; x < 1016; index += 1) {
    const width = bars[index % bars.length] * 4;
    if (index % 2 === 0) ctx.fillRect(x, 1112, Math.min(width, 1016 - x), 150);
    x += width + 3;
  }
}

function drawPolaroid(ctx: CanvasRenderingContext2D, image: HTMLImageElement, fonts: Fonts) {
  ctx.fillStyle = "#fbfaf6";
  ctx.fillRect(0, 0, FRAME_WIDTH, FRAME_HEIGHT);
  drawCover(ctx, image, 70, 70, 940, 1000);
  ctx.strokeStyle = "rgba(0,0,0,.08)";
  ctx.lineWidth = 2;
  ctx.strokeRect(70, 70, 940, 1000);

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = NAVY;
  ctx.font = `600 104px ${fonts.script}`;
  spaced(ctx, "0px");
  ctx.fillText("Baby Moncada", FRAME_WIDTH / 2, 1200);
  ctx.fillStyle = MUTED;
  ctx.font = `600 28px ${fonts.mono}`;
  spaced(ctx, "10px");
  ctx.fillText("09 · 26 · 26", FRAME_WIDTH / 2, 1276);
}

function drawStamp(ctx: CanvasRenderingContext2D, image: HTMLImageElement, fonts: Fonts) {
  drawCover(ctx, image, 0, 0, FRAME_WIDTH, FRAME_HEIGHT);
  ctx.strokeStyle = PAPER;
  ctx.lineWidth = 56;
  ctx.strokeRect(0, 0, FRAME_WIDTH, FRAME_HEIGHT);
  ctx.strokeStyle = "rgba(24,62,93,.55)";
  ctx.lineWidth = 3;
  ctx.strokeRect(44, 44, FRAME_WIDTH - 88, FRAME_HEIGHT - 88);

  ctx.save();
  ctx.translate(810, 1090);
  ctx.rotate(-0.21);
  ctx.fillStyle = "rgba(255,253,248,.84)";
  ctx.beginPath();
  ctx.arc(0, 0, 178, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = NAVY;
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.arc(0, 0, 170, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 146, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = NAVY;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `600 20px ${fonts.mono}`;
  spaced(ctx, "3px");
  ctx.fillText("MONCADA AIRWAYS", 0, -76);
  ctx.font = `400 76px ${fonts.serif}`;
  spaced(ctx, "2px");
  ctx.fillText("ARRIVED", 0, -6);
  ctx.fillRect(-104, 42, 208, 4);
  ctx.font = `600 30px ${fonts.mono}`;
  spaced(ctx, "6px");
  ctx.fillText("09.26.26", 0, 84);
  ctx.restore();

  ctx.save();
  ctx.translate(96, 118);
  ctx.rotate(0.12);
  ctx.strokeStyle = NAVY;
  ctx.fillStyle = "rgba(255,253,248,.84)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(0, 0, 380, 96, 14);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = NAVY;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `600 26px ${fonts.mono}`;
  spaced(ctx, "5px");
  ctx.fillText("✈ BABY ON BOARD", 190, 50);
  ctx.restore();
}

function toBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Photo could not be prepared")), "image/jpeg", quality));
}

export async function renderFrame(image: HTMLImageElement, frame: GuestbookFrame, maxBytes: number) {
  const fonts = readFonts();
  await ensureFonts(fonts);
  const canvas = document.createElement("canvas");
  canvas.width = FRAME_WIDTH;
  canvas.height = FRAME_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");
  if (frame === "boarding") drawBoarding(ctx, image, fonts);
  else if (frame === "polaroid") drawPolaroid(ctx, image, fonts);
  else if (frame === "stamp") drawStamp(ctx, image, fonts);
  else drawCover(ctx, image, 0, 0, FRAME_WIDTH, FRAME_HEIGHT);
  for (const quality of [0.86, 0.74, 0.6]) {
    const blob = await toBlob(canvas, quality);
    if (blob.size <= maxBytes) return blob;
  }
  throw new Error("Photo is too large");
}
