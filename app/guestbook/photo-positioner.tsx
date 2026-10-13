"use client";

/* eslint-disable @next/next/no-img-element -- the photo is a local blob URL the guest just picked. */

import { useRef } from "react";
import { FRAME_HEIGHT, FRAME_WIDTH, MAX_ZOOM, type PhotoCrop } from "@/lib/guestbook-frames";

const ASPECT = FRAME_HEIGHT / FRAME_WIDTH;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

// Sizes in units of the window's width: how big the photo is drawn at a zoom.
function drawnSize(width: number, height: number, zoom: number) {
  const scale = Math.max(1 / width, ASPECT / height) * zoom;
  return { w: width * scale, h: height * scale };
}

// Keeps the photo covering the whole window, the same way the frames crop it.
export function clampCrop(crop: PhotoCrop, width: number, height: number): PhotoCrop {
  const zoom = clamp(crop.zoom, 1, MAX_ZOOM);
  const { w, h } = drawnSize(width, height, zoom);
  return { zoom, x: clamp(crop.x, 0.5 / w, 1 - 0.5 / w), y: clamp(crop.y, ASPECT / 2 / h, 1 - ASPECT / 2 / h) };
}

// Drag to move and pinch (or the slider) to zoom, inside a 4:5 window that
// matches the frames.
export default function PhotoPositioner({ src, width, height, crop, onChange }: { src: string; width: number; height: number; crop: PhotoCrop; onChange: (crop: PhotoCrop) => void }) {
  const windowRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const { w, h } = drawnSize(width, height, crop.zoom);
  const left = 0.5 - crop.x * w;
  const top = ASPECT / 2 - crop.y * h;

  function onPointerDown(event: React.PointerEvent) {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
  }

  function onPointerMove(event: React.PointerEvent) {
    const previous = pointers.current.get(event.pointerId);
    const box = windowRef.current?.getBoundingClientRect();
    if (!previous || !box) return;
    const others = [...pointers.current.entries()].filter(([id]) => id !== event.pointerId).map(([, point]) => point);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (others.length === 1) {
      const [other] = others;
      const before = Math.hypot(previous.x - other.x, previous.y - other.y);
      const after = Math.hypot(event.clientX - other.x, event.clientY - other.y);
      if (before > 0) onChange(clampCrop({ ...crop, zoom: crop.zoom * (after / before) }, width, height));
      return;
    }
    const dx = (event.clientX - previous.x) / box.width;
    const dy = (event.clientY - previous.y) / box.width;
    onChange(clampCrop({ ...crop, x: crop.x - dx / w, y: crop.y - dy / h }, width, height));
  }

  function onPointerUp(event: React.PointerEvent) {
    pointers.current.delete(event.pointerId);
  }

  return <div className="gb-position">
    <div ref={windowRef} className="gb-position-window" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
      <img src={src} alt="Your photo, as it will sit in the frame" draggable={false} style={{ width: `${w * 100}%`, left: `${left * 100}%`, top: `${(top / ASPECT) * 100}%` }} />
      <span className="gb-position-grid" aria-hidden="true" />
    </div>
    <label className="gb-zoom">
      <span aria-hidden="true">−</span>
      <input type="range" min={1} max={MAX_ZOOM} step={0.01} value={crop.zoom} aria-label="Zoom" onChange={(event) => onChange(clampCrop({ ...crop, zoom: Number(event.target.value) }, width, height))} />
      <span aria-hidden="true">+</span>
    </label>
  </div>;
}
