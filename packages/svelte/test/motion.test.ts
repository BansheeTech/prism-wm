/*
 * Prism Window Manager (@prism-wm)
 * Copyright (C) 2023-2026 Banshee Technologies S.L.
 * Authors: Claudio González, Néstor González
 * https://www.banshee.pro/
 *
 * @license AGPL-3.0-or-later
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { tick } from "svelte";
import { render, fireEvent, cleanup } from "@testing-library/svelte";
import PrismWindowManager from "../src/PrismWindowManager.svelte";
import { createWindowManager } from "../src/store";
import Stub from "./Stub.svelte";
import type { PrismMotion } from "@prism-wm/core";

const VP = { getViewport: () => ({ width: 1024, height: 768 }) };

async function setup(storeMotion: PrismMotion, propMotion?: PrismMotion) {
  const store = createWindowManager({ ...VP, motion: storeMotion });
  store.openWindow("a", { title: "A", x: 100, y: 100, width: 600, height: 400 });
  const view = render(PrismWindowManager, {
    props: { store, resolveComponent: () => Stub, ...(propMotion ? { motion: propMotion } : {}) },
  });
  await tick();
  vi.advanceTimersByTime(300);
  await tick();
  const el = view.container.querySelector(".pwm-window") as HTMLElement;
  return { store, view, el };
}

async function dragRight(container: HTMLElement) {
  const strip = container.querySelector(".pwm-window-header-draggable") as HTMLElement;
  await fireEvent.pointerDown(strip, { button: 0, pointerId: 1, clientX: 200, clientY: 150 });
  for (let i = 1; i <= 8; i++) {
    strip.dispatchEvent(new PointerEvent("pointermove", { pointerId: 1, clientX: 200 + i * 30, clientY: 150 }));
    await tick();
    vi.advanceTimersByTime(16);
  }
  await tick();
  return strip;
}

describe("motion", () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date", "requestAnimationFrame", "cancelAnimationFrame", "performance"] }));
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("tilts the window around the grab point while dragging in playful mode and settles after release", async () => {
    const { view, el } = await setup("playful");
    const strip = await dragRight(view.container);
    expect(el.style.transform).toMatch(/rotateZ\([1-9]/);
    expect(el.style.transformOrigin).toBe("100px 50px");
    strip.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 }));
    await tick();
    vi.advanceTimersByTime(1500);
    await tick();
    expect(el.style.transform).toBe("");
  });

  it("leaves the transform alone in standard mode", async () => {
    const { view, el } = await setup("standard");
    await dragRight(view.container);
    expect(el.style.transform).toBe("");
  });

  it("follows the prop over the store and switches off live", async () => {
    const { view, el } = await setup("standard", "playful");
    await dragRight(view.container);
    expect(el.style.transform).toContain("perspective(");
    await view.rerender({ motion: "standard" });
    await tick();
    expect(el.style.transform).toBe("");
  });

  it("switches on live from the store", async () => {
    const { store, view, el } = await setup("standard");
    store.setMotion("playful");
    await tick();
    await dragRight(view.container);
    expect(el.style.transform).toContain("rotateY(");
  });
});
