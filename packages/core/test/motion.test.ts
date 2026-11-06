/*
 * Prism Window Manager (@prism-wm)
 * Copyright (C) 2023-2026 Banshee Technologies S.L.
 * Authors: Claudio González, Néstor González
 * https://www.banshee.pro/
 *
 * @license AGPL-3.0-or-later
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { describe, it, expect } from "vitest";
import { stepSpring, WindowMotion, DEFAULT_WINDOW_MOTION, PWM_WOBBLE_SPRING } from "../src/motion.js";
import { WindowManagerStore } from "../src/store.js";

const FRAME = 1000 / 60;

function run(motion: WindowMotion, from: number, frames: number, onFrame?: (t: number, i: number) => void): { time: number; moving: boolean } {
  let t = from;
  let moving = true;
  for (let i = 0; i < frames; i++) {
    t += FRAME;
    onFrame?.(t, i);
    moving = motion.step(t);
  }
  return { time: t, moving };
}

function settleTime(motion: WindowMotion, from: number, limitMs = 2000): number {
  let t = from;
  while (t - from < limitMs) {
    t += FRAME;
    if (!motion.step(t)) return t - from;
  }
  return Infinity;
}

describe("stepSpring", () => {
  it("converges on the target with a short overshoot", () => {
    let s = { value: 10, velocity: 0 };
    let min = Infinity;
    for (let i = 0; i < 60; i++) {
      s = stepSpring(s, 0, PWM_WOBBLE_SPRING, 1 / 60);
      min = Math.min(min, s.value);
    }
    expect(min).toBeLessThan(0);
    expect(min).toBeGreaterThan(-5);
    expect(Math.abs(s.value)).toBeLessThan(0.01);
  });

  it("is stable for large time steps", () => {
    const s = stepSpring({ value: 1, velocity: 0 }, 0, PWM_WOBBLE_SPRING, 0.5);
    expect(Number.isFinite(s.value)).toBe(true);
    expect(Math.abs(s.value)).toBeLessThan(1);
  });

  it("does nothing for a zero or negative step", () => {
    expect(stepSpring({ value: 3, velocity: 2 }, 0, PWM_WOBBLE_SPRING, 0)).toEqual({ value: 3, velocity: 2 });
    expect(stepSpring({ value: 3, velocity: 2 }, 0, PWM_WOBBLE_SPRING, -1)).toEqual({ value: 3, velocity: 2 });
  });
});

describe("WindowMotion", () => {
  it("is at rest with no transform until something moves", () => {
    const m = new WindowMotion();
    expect(m.transform).toBeNull();
    expect(m.step(0)).toBe(false);
    expect(m.step(FRAME)).toBe(false);
  });

  it("tilts in the direction of a horizontal drag, within the limits", () => {
    const m = new WindowMotion();
    m.dragStart(0, 0);
    m.step(0);
    let x = 0;
    run(m, 0, 20, () => {
      x += 40;
      m.dragMove(x, 0);
    });
    const pose = m.pose;
    expect(pose.rotateZ).toBeGreaterThan(1);
    expect(pose.rotateY).toBeGreaterThan(1);
    expect(Math.abs(pose.rotateX)).toBeLessThan(0.01);
    expect(pose.rotateZ).toBeLessThanOrEqual(DEFAULT_WINDOW_MOTION.maxTilt * 1.5);
    expect(pose.rotateY).toBeLessThanOrEqual(DEFAULT_WINDOW_MOTION.maxLean * 1.5);
    expect(m.transform).toMatch(/^perspective\(1400px\) rotateX\(-?[\d.]+deg\) rotateY\([\d.]+deg\) rotateZ\([\d.]+deg\) scale\(1\)$/);
  });

  it("leans the other way for a leftward or vertical drag", () => {
    const left = new WindowMotion();
    left.dragStart(1000, 0);
    left.step(0);
    let x = 1000;
    run(left, 0, 10, () => left.dragMove((x -= 30), 0));
    expect(left.pose.rotateZ).toBeLessThan(0);

    const down = new WindowMotion();
    down.dragStart(0, 0);
    down.step(0);
    let y = 0;
    run(down, 0, 10, () => down.dragMove(0, (y += 30)));
    expect(down.pose.rotateX).toBeLessThan(0);
    expect(Math.abs(down.pose.rotateZ)).toBeLessThan(0.01);
  });

  it("never exceeds the configured clamp, however fast the pointer", () => {
    const m = new WindowMotion();
    m.dragStart(0, 0);
    m.step(0);
    let x = 0;
    let peak = 0;
    run(m, 0, 30, () => {
      m.dragMove((x += 2000), 0);
      peak = Math.max(peak, Math.abs(m.pose.rotateZ));
    });
    expect(peak).toBeLessThanOrEqual(DEFAULT_WINDOW_MOTION.maxTilt * 1.5);
  });

  it("settles back to rest after release with a short bounce", () => {
    const m = new WindowMotion();
    m.dragStart(0, 0);
    m.step(0);
    let x = 0;
    const { time } = run(m, 0, 15, () => m.dragMove((x += 40), 0));
    m.dragEnd();
    let crossed = false;
    let t = time;
    for (let i = 0; i < 24; i++) {
      t += FRAME;
      m.step(t);
      if (m.pose.rotateZ < 0) crossed = true;
    }
    expect(crossed).toBe(true);
    expect(Math.abs(m.pose.rotateZ)).toBeLessThan(0.2);
    expect(settleTime(m, t)).toBeLessThan(800);
    expect(m.transform).toBeNull();
  });

  it("stops working while the pointer is held still", () => {
    const m = new WindowMotion();
    m.dragStart(0, 0);
    m.step(0);
    m.dragMove(50, 0);
    expect(m.step(FRAME)).toBe(true);
    expect(settleTime(m, FRAME)).toBeLessThan(1500);
    expect(m.isDragging).toBe(true);
  });

  it("pops the scale on a snap bounce and settles to 1", () => {
    const m = new WindowMotion();
    m.bounce();
    expect(m.transform).not.toBeNull();
    m.step(0);
    let peak = 1;
    let trough = 1;
    let t = 0;
    for (let i = 0; i < 30; i++) {
      t += FRAME;
      m.step(t);
      peak = Math.max(peak, m.pose.scale);
      trough = Math.min(trough, m.pose.scale);
    }
    expect(peak).toBeGreaterThan(1.01);
    expect(peak).toBeLessThan(1.05);
    expect(trough).toBeLessThan(1);
    expect(settleTime(m, t)).toBeLessThan(800);
    expect(m.pose.scale).toBe(1);
  });

  it("clamps long frame gaps", () => {
    const m = new WindowMotion();
    m.bounce();
    m.step(0);
    m.step(10_000);
    expect(Number.isFinite(m.pose.scale)).toBe(true);
    expect(m.pose.scale).toBeGreaterThan(0.9);
  });

  it("accepts a partial config", () => {
    const m = new WindowMotion({ maxTilt: 0, maxLean: 0, perspective: 800 });
    m.dragStart(0, 0);
    m.step(0);
    let x = 0;
    run(m, 0, 10, () => m.dragMove((x += 40), 0));
    expect(m.pose.rotateZ).toBe(0);
    m.bounce();
    expect(m.transform).toContain("perspective(800px)");
  });
});

describe("store motion", () => {
  it("defaults to standard and honours the option", () => {
    expect(new WindowManagerStore().motion).toBe("standard");
    expect(new WindowManagerStore().getState().motion).toBe("standard");
    expect(new WindowManagerStore({ motion: "playful" }).motion).toBe("playful");
  });

  it("switches at runtime and notifies only on change", () => {
    const store = new WindowManagerStore();
    let calls = 0;
    store.subscribe(() => calls++);
    store.setMotion("playful");
    store.setMotion("playful");
    expect(store.motion).toBe("playful");
    expect(calls).toBe(1);
    store.setMotion("standard");
    expect(store.getState().motion).toBe("standard");
    expect(calls).toBe(2);
  });
});
