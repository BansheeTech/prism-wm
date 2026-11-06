/*
 * Prism Window Manager (@prism-wm)
 * Copyright (C) 2023-2026 Banshee Technologies S.L.
 * Authors: Claudio González, Néstor González
 * https://www.banshee.pro/
 *
 * @license AGPL-3.0-or-later
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { PrismWindowManager } from "../src/PrismWindowManager";
import { createWindowManager } from "../src/useWindowManager";
import type { WindowManagerStore } from "@prism-wm/core";

function Stub() {
  return <div className="stub-app" />;
}

function pointer(type: string, init: PointerEventInit) {
  return new PointerEvent(type, { pointerId: 1, ...init });
}

describe("drag gestures always end", () => {
  let store: WindowManagerStore;
  let id: string;
  let container: HTMLElement;
  let strip: HTMLElement;
  let other: HTMLElement;
  const originalReport = (globalThis as { reportError?: unknown }).reportError;

  beforeEach(() => {
    (globalThis as { reportError?: unknown }).reportError = () => {};
    store = createWindowManager({ getViewport: () => ({ width: 1024, height: 768 }) });
    id = store.openWindow("a", { title: "A", x: 100, y: 100, width: 400, height: 300 });
    container = render(<PrismWindowManager store={store} resolveComponent={() => Stub} />).container;
    strip = container.querySelector(".pwm-window-header-draggable") as HTMLElement;
    other = document.createElement("div");
    document.body.appendChild(other);
    act(() => {
      strip.dispatchEvent(pointer("pointerdown", { button: 0, clientX: 200, clientY: 120, bubbles: true }));
    });
  });

  afterEach(() => {
    cleanup();
    other.remove();
    (globalThis as { reportError?: unknown }).reportError = originalReport;
  });

  const dragging = () => (container.querySelector(".pwm-window") as HTMLElement).classList.contains("pwm-dragging");
  const fire = (el: Element, ev: Event) => act(() => void el.dispatchEvent(ev));

  it("snaps and closes the gesture even when a subscriber throws", () => {
    store.subscribe(() => {
      if (store.getWindowById(id)?.isSnapped) throw new Error("host subscriber");
    });
    fire(strip, pointer("pointermove", { clientX: 1020, clientY: 300, buttons: 1, pointerType: "mouse" }));
    fire(strip, pointer("pointerup", { clientX: 1020, clientY: 300, pointerType: "mouse" }));
    expect(store.getWindowById(id)?.isSnapped).toBe("right");
    expect(store.snapPreview).toBeNull();
    expect(dragging()).toBe(false);
    const before = { ...store.getWindowById(id)! };
    fire(strip, pointer("pointermove", { clientX: 400, clientY: 400, buttons: 0 }));
    expect(store.getWindowById(id)).toMatchObject({ x: before.x, y: before.y });
  });

  it("ends when the pointerup lands on another element", () => {
    fire(strip, pointer("pointermove", { clientX: 260, clientY: 160, buttons: 1, pointerType: "mouse" }));
    fire(other, pointer("pointerup", { clientX: 260, clientY: 160, pointerType: "mouse", bubbles: true }));
    expect(dragging()).toBe(false);
    fire(other, pointer("pointermove", { clientX: 500, clientY: 500, buttons: 1, pointerType: "mouse", bubbles: true }));
    expect(store.getWindowById(id)).toMatchObject({ x: 160, y: 140 });
  });

  it("ends when a mouse move arrives with no button held", () => {
    fire(strip, pointer("pointermove", { clientX: 260, clientY: 160, buttons: 1, pointerType: "mouse" }));
    fire(other, pointer("pointermove", { clientX: 600, clientY: 400, buttons: 0, pointerType: "mouse", bubbles: true }));
    expect(dragging()).toBe(false);
    expect(store.getWindowById(id)).toMatchObject({ x: 160, y: 140 });
  });

  it("keeps following moves that another element captured", () => {
    fire(other, pointer("pointermove", { clientX: 300, clientY: 200, buttons: 1, pointerType: "mouse" }));
    expect(store.getWindowById(id)).toMatchObject({ x: 200, y: 180 });
  });
});
