"use client";

import { useEffect, useRef, type CSSProperties } from "react";

type FadeDirection = "left" | "right" | "top" | "bottom" | "none";
type ColorMode = "single" | "multiple";

export interface BlinkingSquaresProps {
  gridSize?: number;
  fillPercent?: number;
  colorMode?: ColorMode;
  squareColor?: string;
  colors?: string[];
  twinkleSpeed?: number;
  opacity?: number;
  fadeDirection?: FadeDirection;
  fadePercent?: number;
  fadeIntensity?: number;
  hasCursorInteraction?: boolean;
  cursorRadius?: number;
  cursorBoost?: number;
  className?: string;
  style?: CSSProperties;
}

const COMPONENT_DEFAULTS = {
  gridSize: 40,
  fillPercent: 70,
  colorMode: "single" as ColorMode,
  squareColor: "#BB29FF",
  colors: ["#BB29FF", "#29D9FF", "#FF2975"],
  twinkleSpeed: 30,
  opacity: 1,
  fadeDirection: "right" as FadeDirection,
  fadePercent: 100,
  fadeIntensity: 25,
  hasCursorInteraction: false,
  cursorRadius: 140,
  cursorBoost: 60,
};

function parseColor(c: string): [number, number, number] {
  if (!c) return [255, 255, 255];
  const s = c.trim();
  if (s.startsWith("#")) {
    const hex = s.slice(1);
    if (hex.length === 3) {
      return [
        parseInt(hex[0] + hex[0], 16),
        parseInt(hex[1] + hex[1], 16),
        parseInt(hex[2] + hex[2], 16),
      ];
    }
    if (hex.length === 6 || hex.length === 8) {
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
      ];
    }
  }
  const m = s.match(/rgba?\(([^)]+)\)/i);
  if (m) {
    const parts = m[1].split(",").map((v) => parseFloat(v.trim()));
    return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
  }
  return [255, 255, 255];
}

/**
 * Blinking Squares — a grid of squares that twinkle independently.
 * Based on Originkit BlinkingSquares.
 */
export function BlinkingSquares(props: BlinkingSquaresProps) {
  const {
    gridSize = COMPONENT_DEFAULTS.gridSize,
    fillPercent = COMPONENT_DEFAULTS.fillPercent,
    colorMode = COMPONENT_DEFAULTS.colorMode,
    squareColor = COMPONENT_DEFAULTS.squareColor,
    colors = COMPONENT_DEFAULTS.colors,
    twinkleSpeed = COMPONENT_DEFAULTS.twinkleSpeed,
    opacity = COMPONENT_DEFAULTS.opacity,
    fadeDirection = COMPONENT_DEFAULTS.fadeDirection,
    fadePercent = COMPONENT_DEFAULTS.fadePercent,
    fadeIntensity = COMPONENT_DEFAULTS.fadeIntensity,
    hasCursorInteraction = COMPONENT_DEFAULTS.hasCursorInteraction,
    cursorRadius = COMPONENT_DEFAULTS.cursorRadius,
    cursorBoost = COMPONENT_DEFAULTS.cursorBoost,
    className,
    style,
  } = props;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const cellsRef = useRef<
    Array<{ phase: number; rate: number; tint: number }>
  >([]);
  const cellsKeyRef = useRef("");
  const startRef = useRef(
    typeof performance !== "undefined" ? performance.now() : 0,
  );
  const pointerRef = useRef({ x: -9999, y: -9999, active: false });
  const propsRef = useRef({
    gridSize,
    fillPercent,
    colorMode,
    squareColor,
    colors,
    twinkleSpeed,
    opacity,
    fadeDirection,
    fadePercent,
    fadeIntensity,
    hasCursorInteraction,
    cursorRadius,
    cursorBoost,
  });

  propsRef.current = {
    gridSize,
    fillPercent,
    colorMode,
    squareColor,
    colors,
    twinkleSpeed,
    opacity,
    fadeDirection,
    fadePercent,
    fadeIntensity,
    hasCursorInteraction,
    cursorRadius,
    cursorBoost,
  };

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ensureCells = (cols: number, rows: number) => {
      const key = `${cols}x${rows}`;
      if (
        cellsKeyRef.current === key &&
        cellsRef.current.length === cols * rows
      ) {
        return;
      }
      const arr = new Array(cols * rows);
      for (let i = 0; i < arr.length; i++) {
        const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
        const r1 = s - Math.floor(s);
        const s2 = Math.sin(i * 7.137 + 33.71) * 12345.6789;
        const r2 = s2 - Math.floor(s2);
        const s3 = Math.sin(i * 3.51 + 5.91) * 9876.54321;
        const r3 = s3 - Math.floor(s3);
        arr[i] = {
          phase: r1 * Math.PI * 2,
          rate: 0.6 + r2 * 0.8,
          tint: r3,
        };
      }
      cellsRef.current = arr;
      cellsKeyRef.current = key;
    };

    const draw = (now: number) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const { w, h } = sizeRef.current;
      if (w <= 0 || h <= 0) return;

      const p = propsRef.current;
      const cells = Math.max(2, Math.floor(p.gridSize));
      const longSide = Math.max(w, h);
      const cellSize = longSide / cells;
      const cols = Math.max(1, Math.ceil(w / cellSize));
      const rows = Math.max(1, Math.ceil(h / cellSize));
      ensureCells(cols, rows);

      ctx.clearRect(0, 0, w, h);

      const palette: Array<[number, number, number]> =
        p.colorMode === "multiple" &&
        Array.isArray(p.colors) &&
        p.colors.length > 0
          ? p.colors.slice(0, 5).map((c) => parseColor(c))
          : [parseColor(p.squareColor)];

      const t = (now - startRef.current) / 1000;
      const speed = Math.max(0, p.twinkleSpeed) * 0.05;
      const strength = 1;
      const masterOpacity = Math.max(0, Math.min(1, p.opacity));
      const fill = Math.max(0.1, Math.min(1, (p.fillPercent ?? 70) / 100));
      const inset = (1 - fill) * 0.5;

      const f = Math.max(0, Math.min(1, (p.fadePercent ?? 0) / 100));
      const fStart = 1 - f;
      const fEnd = 1;
      const noFade = f <= 0;
      const falloff =
        0.2 + (Math.max(0, Math.min(100, p.fadeIntensity ?? 25)) / 100) * 5.8;

      const cursor = pointerRef.current;
      const hasCursor = p.hasCursorInteraction && cursor.active;
      const cr = Math.max(1, p.cursorRadius);
      const cb = Math.max(0, p.cursorBoost) / 100;
      const cr2 = cr * cr;

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x;
          const cell = cellsRef.current[i];
          if (!cell) continue;

          let u: number;
          switch (p.fadeDirection) {
            case "left":
              u = 1 - x / Math.max(1, cols - 1);
              break;
            case "top":
              u = 1 - y / Math.max(1, rows - 1);
              break;
            case "bottom":
              u = y / Math.max(1, rows - 1);
              break;
            case "none":
              u = 0;
              break;
            case "right":
            default:
              u = x / Math.max(1, cols - 1);
          }

          let envelope: number;
          if (p.fadeDirection === "none" || noFade) {
            envelope = 1;
          } else if (u <= fStart) {
            envelope = 1;
          } else if (u >= fEnd) {
            envelope = 0;
          } else {
            const k = (u - fStart) / Math.max(0.0001, fEnd - fStart);
            envelope = Math.pow(1 - k, falloff);
          }

          const cx = x * cellSize;
          const cy = y * cellSize;

          let reveal = 0;
          if (hasCursor) {
            const dx = cx + cellSize * 0.5 - cursor.x;
            const dy = cy + cellSize * 0.5 - cursor.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < cr2) {
              const k = 1 - d2 / cr2;
              reveal = k * k * cb;
            }
          }

          const osc =
            0.5 +
            0.5 *
              Math.sin(t * speed * cell.rate * Math.PI * 2 + cell.phase);
          const twinkle = 1 - strength + strength * osc;
          const env2 = Math.min(1, envelope + reveal);
          const finalAlpha = env2 * twinkle * masterOpacity;
          if (finalAlpha <= 0.002) continue;

          const sx = cx + cellSize * inset;
          const sy = cy + cellSize * inset;
          const sw = cellSize * fill;
          const sh = cellSize * fill;

          const ci =
            palette.length > 1
              ? Math.min(
                  palette.length - 1,
                  Math.floor(cell.tint * palette.length),
                )
              : 0;
          const [r, g, b] = palette[ci];

          ctx.fillStyle = `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${finalAlpha.toFixed(3)})`;
          ctx.fillRect(sx, sy, sw, sh);
        }
      }
    };

    const loop = (now: number) => {
      draw(now);
      rafRef.current = requestAnimationFrame(loop);
    };

    const resize = (entry?: ResizeObserverEntry) => {
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      const cr = entry?.contentRect;
      const rectW =
        cr?.width ||
        container.clientWidth ||
        container.getBoundingClientRect().width;
      const rectH =
        cr?.height ||
        container.clientHeight ||
        container.getBoundingClientRect().height;
      const w = Math.max(1, Math.floor(rectW) || 1);
      const h = Math.max(1, Math.floor(rectH) || 1);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      sizeRef.current = { w, h };
      cellsKeyRef.current = "";
    };

    resize();
    const ro = new ResizeObserver((entries) => resize(entries[0]));
    ro.observe(container);

    startRef.current = performance.now();
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      ro.disconnect();
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !hasCursorInteraction) return;

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      pointerRef.current.x = e.clientX - rect.left;
      pointerRef.current.y = e.clientY - rect.top;
      pointerRef.current.active = true;
    };
    const onLeave = () => {
      pointerRef.current.active = false;
      pointerRef.current.x = -9999;
      pointerRef.current.y = -9999;
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [hasCursorInteraction]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        ...style,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ display: "block", width: "100%", height: "100%" }}
      />
    </div>
  );
}
