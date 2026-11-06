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
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { PrismWindowManager } from "../src/PrismWindowManager";
import { createWindowManager } from "../src/useWindowManager";
import type { PrismMotion } from "@prism-wm/core";

function Stub() {
  return <div className="stub-app" />;
}

const VP = { getViewport: () => ({ width: 1024, height: 768 }) };

function setup(storeMotion: PrismMotion, propMotion?: PrismMotion) {
  const store = createWindowManager({ ...VP, motion: storeMotion });
  store.openWindow("a", { title: "A", x: 100, y: 100, width: 600, height: 400 });
  const view = render(<PrismWindowManager store={store} resolveComponent={() => Stub} motion={propMotion} />);
  act(() => {
    vi.advanceTimersByTime(300);
  });
  const el = view.container.querySelector(".pwm-window") as HTMLElement;
  return { store, view, el };
}

function dragRight(container: HTMLElement) {
  const strip = container.querySelector(".pwm-window-header-draggable") as HTMLElement;
  act(() => {
    fireEvent.pointerDown(strip, { button: 0, pointerId: 1, clientX: 200, clientY: 150 });
  });
  for (let i = 1; i <= 8; i++) {
    act(() => {
      strip.dispatchEvent(new PointerEvent("pointermove", { pointerId: 1, clientX: 200 + i * 30, clientY: 150 }));
      vi.advanceTimersByTime(16);
    });
  }
  return strip;
}

describe("motion", () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date", "requestAnimationFrame", "cancelAnimationFrame", "performance"] }));
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("tilts the window around the grab point while dragging in playful mode and settles after release", () => {
    const { view, el } = setup("playful");
    const strip = dragRight(view.container);
    expect(el.style.transform).toMatch(/rotateZ\([1-9]/);
    expect(el.style.transformOrigin).toBe("100px 50px");
    act(() => {
      strip.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 }));
      vi.advanceTimersByTime(1500);
    });
    expect(el.style.transform).toBe("");
  });

  it("leaves the transform alone in standard mode", () => {
    const { view, el } = setup("standard");
    dragRight(view.container);
    expect(el.style.transform).toBe("");
  });

  it("follows the prop over the store and switches off live", () => {
    const { store, view, el } = setup("standard", "playful");
    dragRight(view.container);
    expect(el.style.transform).toContain("perspective(");
    view.rerender(<PrismWindowManager store={store} resolveComponent={() => Stub} motion="standard" />);
    expect(el.style.transform).toBe("");
  });

  it("switches on live from the store", () => {
    const { store, view, el } = setup("standard");
    act(() => store.setMotion("playful"));
    dragRight(view.container);
    expect(el.style.transform).toContain("rotateY(");
  });
});
