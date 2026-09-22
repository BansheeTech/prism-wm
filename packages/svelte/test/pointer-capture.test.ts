/*
 * Prism Window Manager (@prism-wm), Svelte adapter tests: pointer-captured gestures
 * Copyright (C) 2023-2026 Banshee Technologies S.L.
 * Authors: Claudio González, Néstor González
 * https://www.banshee.pro/
 *
 * Extracted from HomeDock OS: https://github.com/BansheeTech/HomeDockOS
 *
 * @license AGPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Drag and resize must survive the cursor crossing an iframe: events inside
 * another document never bubble to ours, so the gesture relies on pointer
 * capture delivering every move to the grabbed element itself. These assert
 * the capture happens, that element-delivered moves keep working, and that
 * pointercancel ends the gesture cleanly.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { tick } from "svelte";
import { render, fireEvent, cleanup } from "@testing-library/svelte";
import PrismWindowManager from "../src/PrismWindowManager.svelte";
import { createWindowManager } from "../src/store";
import Stub from "./Stub.svelte";
import type { WindowManagerStore } from "@prism-wm/core";

const setCapture = vi.fn();
const releaseCapture = vi.fn();

afterEach(() => {
  cleanup();
  delete (Element.prototype as Partial<Element>).setPointerCapture;
  delete (Element.prototype as Partial<Element>).releasePointerCapture;
});

describe("PrismWindow pointer-captured gestures", () => {
  let store: WindowManagerStore;
  beforeEach(() => {
    store = createWindowManager({ getViewport: () => ({ width: 1024, height: 768 }) });
    setCapture.mockClear();
    releaseCapture.mockClear();
    Element.prototype.setPointerCapture = setCapture;
    Element.prototype.releasePointerCapture = releaseCapture;
  });

  it("captures the pointer on drag and follows moves delivered to the strip", async () => {
    const id = store.openWindow("a", { title: "A", x: 100, y: 100, width: 600, height: 400 });
    const { container } = render(PrismWindowManager, {
      props: { store, resolveComponent: () => Stub },
    });
    await tick();

    const strip = container.querySelector(".pwm-window-header-draggable") as HTMLElement;
    await fireEvent.pointerDown(strip, { button: 0, pointerId: 7, clientX: 200, clientY: 150 });
    expect(setCapture).toHaveBeenCalledWith(7);

    strip.dispatchEvent(new PointerEvent("pointermove", { pointerId: 7, clientX: 260, clientY: 190 }));
    expect(store.getWindowById(id)).toMatchObject({ x: 160, y: 140 });

    strip.dispatchEvent(new PointerEvent("pointercancel", { pointerId: 7 }));
    expect(releaseCapture).toHaveBeenCalledWith(7);
    strip.dispatchEvent(new PointerEvent("pointermove", { pointerId: 7, clientX: 500, clientY: 500 }));
    expect(store.getWindowById(id)).toMatchObject({ x: 160, y: 140 });
  });

  it("captures the pointer on resize and follows moves delivered to the handle", async () => {
    const id = store.openWindow("a", { title: "A", x: 100, y: 100, width: 600, height: 400 });
    const { container } = render(PrismWindowManager, {
      props: { store, resolveComponent: () => Stub },
    });
    await tick();

    const handle = container.querySelector(".pwm-resize-se") as HTMLElement;
    await fireEvent.pointerDown(handle, { button: 0, pointerId: 3, clientX: 700, clientY: 500 });
    expect(setCapture).toHaveBeenCalledWith(3);

    handle.dispatchEvent(new PointerEvent("pointermove", { pointerId: 3, clientX: 750, clientY: 560 }));
    expect(store.getWindowById(id)).toMatchObject({ width: 650, height: 460 });

    handle.dispatchEvent(new PointerEvent("pointerup", { pointerId: 3 }));
    expect(releaseCapture).toHaveBeenCalledWith(3);
  });
});
