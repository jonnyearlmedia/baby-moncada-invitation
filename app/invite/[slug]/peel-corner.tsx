"use client";

import { useEffect, useId, useRef } from "react";

type Point = { x: number; y: number };

const BORDER = 9; // the airmail stripe band on the back of the card
const IDLE_MIN = 30;
const IDLE_MAX = 68;
const IDLE_PERIOD_MS = 2600;

const sub = (a: Point, b: Point) => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: Point, b: Point) => ({ x: a.x + b.x, y: a.y + b.y });
const scale = (a: Point, k: number) => ({ x: a.x * k, y: a.y * k });
const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y;
const length = (a: Point) => Math.hypot(a.x, a.y);

// Keeps the part of a polygon on one side of the fold (Sutherland Hodgman
// against a single line).
function clipToSide(polygon: Point[], mid: Point, normal: Point, cornerSide: boolean) {
  const sign = cornerSide ? 1 : -1;
  const out: Point[] = [];
  polygon.forEach((a, index) => {
    const b = polygon[(index + 1) % polygon.length];
    const da = sign * dot(sub(a, mid), normal);
    const db = sign * dot(sub(b, mid), normal);
    if (da >= 0) out.push(a);
    if ((da >= 0) !== (db >= 0)) out.push(add(a, scale(sub(b, a), da / (da - db))));
  });
  return out;
}

const rect = (x: number, y: number, w: number, h: number): Point[] => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
const toPoints = (polygon: Point[]) => polygon.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

// A real page peel, after the approach in Peel.js: the fold is the
// perpendicular bisector between the bottom right corner and where it has been
// pulled to. The front is clipped along the fold, the cut piece is mirrored
// across it to show the card's back, and the crease, curl, and the shadow
// underneath are shaded along the fold's normal. The left edge stays attached,
// so the corner can only travel as far as real paper would.
export default function PeelCorner({ faceRef, paperRef, active, onPeeled, onTouch }: {
  faceRef: React.RefObject<HTMLElement | null>;
  paperRef: React.RefObject<HTMLElement | null>;
  active: boolean;
  onPeeled: () => void;
  onTouch: () => void;
}) {
  const id = useId().replace(/:/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const under = useRef<SVGPolygonElement>(null);
  const outer = useRef<SVGPolygonElement>(null);
  const inner = useRef<SVGPolygonElement>(null);
  const shade = useRef<SVGPolygonElement>(null);
  const underGradient = useRef<SVGLinearGradientElement>(null);
  const shadeGradient = useRef<SVGLinearGradientElement>(null);
  const size = useRef({ w: 0, h: 0 });
  const drag = useRef<{ pointer: number; start: Point; moved: boolean; at: Point } | null>(null);
  const settle = useRef<{ from: Point; started: number } | null>(null);
  const last = useRef<Point | null>(null);

  useEffect(() => {
    const face = faceRef.current;
    const paper = paperRef.current;
    const svg = svgRef.current;
    if (!face || !paper || !svg) return;

    const draw = (pulled: Point | null) => {
      last.current = pulled;
      const { w, h } = size.current;
      const corner = { x: w, y: h };
      const elements = [under.current, outer.current, inner.current, shade.current];
      if (!pulled || length(sub(corner, pulled)) < 1) {
        paper.style.clipPath = "";
        elements.forEach((element) => element?.setAttribute("points", ""));
        return;
      }
      // Anchored along the left edge: the corner stays within reach of both left corners.
      let p = pulled;
      for (const anchor of [{ x: 0, y: h }, { x: 0, y: 0 }]) {
        const reach = length(sub(corner, anchor));
        const offset = sub(p, anchor);
        if (length(offset) > reach) p = add(anchor, scale(offset, reach / length(offset)));
      }
      const toCorner = sub(corner, p);
      const normal = scale(toCorner, 1 / length(toCorner));
      const mid = add(p, scale(toCorner, 0.5));
      const reflect = (point: Point) => sub(point, scale(normal, 2 * dot(sub(point, mid), normal)));

      const card = rect(0, 0, w, h);
      const front = clipToSide(card, mid, normal, false);
      const cut = clipToSide(card, mid, normal, true);
      paper.style.clipPath = `polygon(${front.map((q) => `${q.x.toFixed(1)}px ${q.y.toFixed(1)}px`).join(", ")})`;
      under.current?.setAttribute("points", toPoints(cut));
      outer.current?.setAttribute("points", toPoints(cut.map(reflect)));
      inner.current?.setAttribute("points", toPoints(clipToSide(rect(BORDER, BORDER, w - BORDER * 2, h - BORDER * 2), mid, normal, true).map(reflect)));
      shade.current?.setAttribute("points", toPoints(cut.map(reflect)));
      // Both gradients run along the fold's normal: the shadow underneath from
      // the crease toward where the corner was, the curl from the crease to the tip.
      const gradientLine = (gradient: SVGLinearGradientElement | null, to: Point) => {
        gradient?.setAttribute("x1", mid.x.toFixed(1));
        gradient?.setAttribute("y1", mid.y.toFixed(1));
        gradient?.setAttribute("x2", to.x.toFixed(1));
        gradient?.setAttribute("y2", to.y.toFixed(1));
      };
      gradientLine(underGradient.current, corner);
      gradientLine(shadeGradient.current, p);
    };

    const resize = () => {
      size.current = { w: face.offsetWidth, h: face.offsetHeight };
      svg.setAttribute("viewBox", `0 0 ${size.current.w} ${size.current.h}`);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(face);

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const idleLift = (now: number) => still ? 52 : IDLE_MIN + (IDLE_MAX - IDLE_MIN) * (0.5 - 0.5 * Math.cos((now / IDLE_PERIOD_MS) * Math.PI * 2));
    const idlePoint = (lift: number) => ({ x: size.current.w - lift * 1.1, y: size.current.h - lift * 0.85 });

    // When the card starts to flip, the peel holds until the card is edge on
    // and the front hides, instead of snapping flat first.
    const holdUntil = active ? 0 : performance.now() + 460;
    const held = last.current;
    let frame = 0;
    const tick = (now: number) => {
      if (!active && now < holdUntil) draw(held);
      else if (drag.current) draw(drag.current.at);
      else if (settle.current) {
        // Springs back to the idle curl after an unfinished pull.
        const progress = Math.min(1, (now - settle.current.started) / 380);
        const eased = 1 - (1 - progress) ** 3;
        const target = idlePoint(idleLift(now));
        draw(add(settle.current.from, scale(sub(target, settle.current.from), eased)));
        if (progress === 1) settle.current = null;
      } else draw(active ? idlePoint(idleLift(now)) : null);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      paper.style.clipPath = "";
    };
  }, [active, faceRef, paperRef]);

  function local(event: React.PointerEvent) {
    const box = faceRef.current?.getBoundingClientRect();
    return box ? { x: event.clientX - box.left, y: event.clientY - box.top } : { x: 0, y: 0 };
  }

  function onPointerDown(event: React.PointerEvent) {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    onTouch();
    const at = local(event);
    drag.current = { pointer: event.pointerId, start: at, moved: false, at: { x: Math.min(at.x, size.current.w - 30), y: Math.min(at.y, size.current.h - 24) } };
  }

  function onPointerMove(event: React.PointerEvent) {
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId) return;
    const at = local(event);
    if (length(sub(at, current.start)) > 6) current.moved = true;
    current.at = at;
  }

  function onPointerUp(event: React.PointerEvent) {
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId) return;
    drag.current = null;
    const { w, h } = size.current;
    const pulledFar = length(sub({ x: w, y: h }, current.at)) > Math.min(w, h) * 0.45;
    if (!current.moved || pulledFar) onPeeled();
    else settle.current = { from: current.at, started: performance.now() };
  }

  return <>
    <svg ref={svgRef} className="ty-peel" aria-hidden="true">
      <defs>
        <pattern id={`${id}-stripes`} patternUnits="userSpaceOnUse" width="42" height="42" patternTransform="rotate(45)">
          <rect width="14" height="42" fill="#183e5d" /><rect x="14" width="7" height="42" fill="#fffdf8" /><rect x="21" width="14" height="42" fill="#f2c46d" /><rect x="35" width="7" height="42" fill="#fffdf8" />
        </pattern>
        <linearGradient ref={underGradient} id={`${id}-under`} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#122d44" stopOpacity=".45" /><stop offset=".18" stopColor="#122d44" stopOpacity=".16" /><stop offset="1" stopColor="#122d44" stopOpacity="0" />
        </linearGradient>
        <linearGradient ref={shadeGradient} id={`${id}-shade`} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#122d44" stopOpacity=".38" />
          <stop offset=".07" stopColor="#122d44" stopOpacity=".14" />
          <stop offset=".2" stopColor="#fffdf8" stopOpacity=".5" />
          <stop offset=".42" stopColor="#fffdf8" stopOpacity=".12" />
          <stop offset="1" stopColor="#122d44" stopOpacity=".1" />
        </linearGradient>
        <filter id={`${id}-lift`} x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="-2" dy="3" stdDeviation="4" floodColor="#122d44" floodOpacity=".38" /></filter>
      </defs>
      <polygon ref={under} fill={`url(#${id}-under)`} />
      <g filter={`url(#${id}-lift)`}>
        <polygon ref={outer} fill={`url(#${id}-stripes)`} />
        <polygon ref={inner} fill="#fffdf8" />
        <polygon ref={shade} fill={`url(#${id}-shade)`} />
      </g>
    </svg>
    {active && <span className="ty-peel-grab" aria-hidden="true" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onClick={(event) => event.stopPropagation()} />}
  </>;
}
