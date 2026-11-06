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
import { defineComponent, h, nextTick } from "vue";
import { mount, type VueWrapper } from "@vue/test-utils";
import { createWindowManager } from "../src/useWindowManager";
import PrismWindowManager from "../src/PrismWindowManager.vue";
import type { PrismMotion } from "@prism-wm/core";

const Stub = defineComponent({ setup: () => () => h("div", { class: "stub-app" }) });
const VP = { getViewport: () => ({ width: 1024, height: 768 }) };

async function setup(storeMotion: PrismMotion, propMotion?: PrismMotion) {
  const store = createWindowManager({ ...VP, motion: storeMotion });
  store.openWindow("a", { title: "A", x: 100, y: 100, width: 600, height: 400 });
  const w = mount(PrismWindowManager, {
    attachTo: document.body,
    props: { store, resolveComponent: () => Stub, ...(propMotion ? { motion: propMotion } : {}) },
  });
  await nextTick();
  vi.advanceTimersByTime(300);
  await nextTick();
  return { store, w, el: w.find(".pwm-window").element as HTMLElement };
}

function dragRight(w: VueWrapper) {
  const strip = w.find(".pwm-window-header-draggable");
  strip.trigger("pointerdown", { button: 0, pointerId: 1, clientX: 200, clientY: 150 });
  for (let i = 1; i <= 8; i++) {
    strip.element.dispatchEvent(new PointerEvent("pointermove", { pointerId: 1, clientX: 200 + i * 30, clientY: 150 }));
    vi.advanceTimersByTime(16);
  }
  return strip;
}

describe("motion", () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date", "requestAnimationFrame", "cancelAnimationFrame", "performance"] }));
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("tilts the window around the grab point while dragging in playful mode and settles after release", async () => {
    const { w, el } = await setup("playful");
    const strip = dragRight(w);
    expect(el.style.transform).toMatch(/rotateZ\([1-9]/);
    expect(el.style.transformOrigin).toBe("100px 50px");
    strip.element.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 }));
    vi.advanceTimersByTime(1500);
    expect(el.style.transform).toBe("");
    w.unmount();
  });

  it("leaves the transform alone in standard mode", async () => {
    const { w, el } = await setup("standard");
    dragRight(w);
    expect(el.style.transform).toBe("");
    w.unmount();
  });

  it("follows the prop over the store and switches off live", async () => {
    const { w, el } = await setup("standard", "playful");
    dragRight(w);
    expect(el.style.transform).toContain("perspective(");
    await w.setProps({ motion: "standard" });
    expect(el.style.transform).toBe("");
    w.unmount();
  });

  it("switches on live from the store", async () => {
    const { store, w, el } = await setup("standard");
    store.setMotion("playful");
    await nextTick();
    dragRight(w);
    expect(el.style.transform).toContain("rotateY(");
    w.unmount();
  });
});
