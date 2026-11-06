"use client";

import { useEffect, useRef } from "react";

import { hexToRgb, safeHexColor } from "@/components/public/tiers/color-utils";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  o: number;
  depth: number;
};

/**
 * Live canvas particle field — the "professional" tier's hero backdrop:
 * drifting brand-tinted dust with subtle pointer parallax and a radial
 * "ground glow" anchored to the bottom of the frame. Cheap by design
 * (particle count scaled to area, capped at devicePixelRatio 2) and
 * `prefers-reduced-motion`-aware: draws a single static frame and skips the
 * animation loop + pointer listener entirely rather than merely slowing it
 * down. Cleans up its ResizeObserver / pointermove listener / rAF on unmount.
 *
 * Must be placed inside a `position: relative` (or similar) ancestor — the
 * "professional"-tier hero already is, via tier-styles.tsx. Renders behind
 * the hero's real text via a negative z-index (see `-z-20` below), so DOM
 * order relative to the hero's copy doesn't matter.
 */
export default function ParticleField({ accent }: { accent: string }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const [r, g, b] = hexToRgb(safeHexColor(accent, "#d4af6a"));
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let particles: Particle[] = [];
    let raf = 0;
    const pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };

    function seedParticles() {
      const area = width * height;
      const count = Math.max(24, Math.min(140, Math.round(area / 9000)));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.12,
        vy: -0.06 - Math.random() * 0.14,
        r: 0.6 + Math.random() * 1.8,
        o: 0.25 + Math.random() * 0.5,
        depth: 0.3 + Math.random() * 0.7,
      }));
    }

    function drawGlow() {
      const grad = ctx!.createRadialGradient(
        width / 2,
        height,
        0,
        width / 2,
        height,
        Math.max(width, height) * 0.75,
      );
      grad.addColorStop(0, `rgba(${r},${g},${b},0.16)`);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx!.fillStyle = grad;
      ctx!.fillRect(0, 0, width, height);
    }

    function drawParticle(p: Particle, ox: number, oy: number) {
      ctx!.beginPath();
      ctx!.arc(p.x + ox * p.depth, p.y + oy * p.depth, p.r, 0, Math.PI * 2);
      ctx!.fillStyle = `rgba(${r},${g},${b},${p.o})`;
      ctx!.fill();
    }

    function drawStaticFrame() {
      ctx!.clearRect(0, 0, width, height);
      drawGlow();
      for (const p of particles) drawParticle(p, 0, 0);
    }

    function resize() {
      const rect = root!.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      canvas!.width = Math.round(width * dpr);
      canvas!.height = Math.round(height * dpr);
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      seedParticles();
      if (reduceMotion) drawStaticFrame();
    }

    function step() {
      ctx!.clearRect(0, 0, width, height);
      drawGlow();
      pointer.x += (pointer.tx - pointer.x) * 0.06;
      pointer.y += (pointer.ty - pointer.y) * 0.06;
      const ox = (pointer.x - 0.5) * 40;
      const oy = (pointer.y - 0.5) * 24;
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -10) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;
        drawParticle(p, ox, oy);
      }
      raf = requestAnimationFrame(step);
    }

    function onPointerMove(e: PointerEvent) {
      const rect = root!.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      pointer.tx = (e.clientX - rect.left) / rect.width;
      pointer.ty = (e.clientY - rect.top) / rect.height;
    }

    const ro = new ResizeObserver(resize);
    ro.observe(root);
    resize();

    if (!reduceMotion) {
      // Listen on window (not the canvas itself) so this purely decorative
      // layer can stay pointer-events-none without losing parallax tracking.
      window.addEventListener("pointermove", onPointerMove);
      raf = requestAnimationFrame(step);
    }

    return () => {
      ro.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [accent]);

  return (
    <div
      ref={rootRef}
      className="pointer-events-none absolute inset-0 -z-20 overflow-hidden"
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
