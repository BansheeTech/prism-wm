/*
 * Prism Window Manager (@prism-wm), Svelte adapter tests
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
 * Mirror of the Vue and React adapter suites: drives the real rendered
 * components and asserts they move the core store identically.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { tick } from "svelte";
import { render, fireEvent, cleanup } from "@testing-library/svelte";
import PrismWindowManager from "../src/PrismWindowManager.svelte";
import { createWindowManager } from "../src/store";
import Stub from "./Stub.svelte";
import { PWM_CLOSE_ANIMATION_MS, PWM_MINIMIZE_ANIMATION_MS, type WindowManagerStore } from "@prism-wm/core";

async function flushMinimize() {
  await new Promise((r) => setTimeout(r, PWM_MINIMIZE_ANIMATION_MS + 30));
  await tick();
}

async function flushClose() {
  await new Promise((r) => setTimeout(r, PWM_CLOSE_ANIMATION_MS + 30));
  await tick();
}

const VP = { getViewport: () => ({ width: 1024, height: 768 }) };

afterEach(cleanup);

function renderManager(store: WindowManagerStore, props: Record<string, unknown> = {}) {
  return render(PrismWindowManager, {
    props: { store, resolveComponent: () => Stub, ...props },
  });
}

async function drag(root: HTMLElement, selector: string, from: { x: number; y: number }, to: { x: number; y: number }) {
  const el = root.querySelector(selector) as HTMLElement;
  await fireEvent.pointerDown(el, { button: 0, pointerId: 1, clientX: from.x, clientY: from.y });
  el.dispatchEvent(new PointerEvent("pointermove", { pointerId: 1, clientX: to.x, clientY: to.y }));
  el.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 }));
  await tick();
}

describe("PrismWindowManager rendering + reactivity", () => {
  let store: WindowManagerStore;
  beforeEach(() => {
    store = createWindowManager(VP);
  });

  it("renders one window per store window and its title + body", async () => {
    store.openWindow("files", { title: "Files", data: { label: "hi" } });
    const { container } = renderManager(store);
    await tick();
    expect(container.querySelectorAll(".pwm-window")).toHaveLength(1);
    expect(container.querySelector(".pwm-window-title")!.textContent).toContain("Files");
    expect(container.querySelector(".stub-app")!.textContent).toBe("hi");
  });

  it("reacts to windows opened after mount", async () => {
    const { container } = renderManager(store);
    store.openWindow("a", { allowMultiple: true });
    store.openWindow("b", { allowMultiple: true });
    await tick();
    expect(container.querySelectorAll(".pwm-window")).toHaveLength(2);
  });

  it("marks the active window", async () => {
    const a = store.openWindow("a", { allowMultiple: true });
    store.openWindow("b", { allowMultiple: true });
    const { container } = renderManager(store);
    await tick();
    const windows = () => container.querySelectorAll(".pwm-window");
    expect(windows()[1].classList).toContain("pwm-active");
    store.focusWindow(a);
    await tick();
    expect(windows()[0].classList).toContain("pwm-active");
  });

  it("renders the snap preview when the store has one", async () => {
    store.openWindow("a");
    const { container } = renderManager(store);
    store.setSnapPreview("left");
    await tick();
    const preview = container.querySelector(".pwm-snap-preview");
    expect(preview).not.toBeNull();
    expect(preview!.classList).toContain("pwm-snap-left");
  });
});

describe("PrismWindow drag (matches the core geometry)", () => {
  it("moves the window by the drag delta and clamps", async () => {
    const store = createWindowManager(VP);
    const id = store.openWindow("a", { title: "A", x: 100, y: 100, width: 600, height: 400 });
    const { container } = renderManager(store);
    await tick();

    await drag(container, ".pwm-window-header-draggable", { x: 200, y: 150 }, { x: 260, y: 190 });

    const win = store.getWindowById(id)!;
    expect(win.x).toBe(160);
    expect(win.y).toBe(140);
  });

  it("commits a left snap when released against the left edge", async () => {
    const store = createWindowManager({ ...VP, taskbarHeight: 48 });
    const id = store.openWindow("a", { title: "A", x: 300, y: 200, width: 600, height: 400 });
    const { container } = renderManager(store, { taskbarHeight: 48 });
    await tick();

    await drag(container, ".pwm-window-header-draggable", { x: 350, y: 220 }, { x: 5, y: 220 });

    const win = store.getWindowById(id)!;
    expect(win.isSnapped).toBe("left");
    expect(win).toMatchObject({ x: 0, y: 0, width: 512, height: 720 });
    expect(store.getPreSnapBounds(id)).toMatchObject({ x: -45, y: 200, width: 600, height: 400 });
  });
});

describe("PrismWindow resize (matches computeResize)", () => {
  it("grows width and height from the SE handle", async () => {
    const store = createWindowManager(VP);
    const id = store.openWindow("a", { title: "A", x: 100, y: 100, width: 600, height: 400 });
    const { container } = renderManager(store);
    await tick();

    await drag(container, ".pwm-resize-se", { x: 700, y: 500 }, { x: 750, y: 560 });

    const win = store.getWindowById(id)!;
    expect(win.width).toBe(650);
    expect(win.height).toBe(460);
    expect(win.x).toBe(100);
    expect(win.y).toBe(100);
  });

  it("moves origin when resizing from the NW handle", async () => {
    const store = createWindowManager(VP);
    const id = store.openWindow("a", { title: "A", x: 300, y: 300, width: 600, height: 500 });
    const { container } = renderManager(store);
    await tick();

    await drag(container, ".pwm-resize-nw", { x: 300, y: 300 }, { x: 350, y: 360 });

    const win = store.getWindowById(id)!;
    expect(win.width).toBe(550);
    expect(win.height).toBe(440);
    expect(win.x).toBe(350);
    expect(win.y).toBe(360);
  });
});

describe("PrismWindow controls", () => {
  let store: WindowManagerStore;
  let id: string;
  let container: HTMLElement;
  beforeEach(async () => {
    store = createWindowManager(VP);
    id = store.openWindow("a", { title: "A" });
    container = renderManager(store).container;
    await tick();
  });

  it("maximizes and restores", async () => {
    await fireEvent.click(container.querySelector(".pwm-maximize")!);
    expect(store.getWindowById(id)!.isMaximized).toBe(true);
    await fireEvent.click(container.querySelector(".pwm-maximize")!);
    expect(store.getWindowById(id)!.isMaximized).toBe(false);
  });

  it("minimizes (state set, element hidden but still mounted)", async () => {
    await fireEvent.click(container.querySelector(".pwm-minimize")!);
    expect(store.getWindowById(id)!.isMinimized).toBe(true);

    const el = () => container.querySelector(".pwm-window") as HTMLElement;
    expect(el()).not.toBeNull();
    expect(el().className).toContain("pwm-minimizing");
    expect(el().style.display).toBe("");

    await flushMinimize();
    expect(el()).not.toBeNull();
    expect(el().style.display).toBe("none");
  });

  it("plays the restore animation on the way back", async () => {
    await fireEvent.click(container.querySelector(".pwm-minimize")!);
    await flushMinimize();

    store.focusWindow(id);
    await tick();
    const el = () => container.querySelector(".pwm-window") as HTMLElement;
    expect(el().className).toContain("pwm-restoring");
    expect(el().style.display).toBe("");

    await flushMinimize();
    expect(el().className).not.toContain("pwm-restoring");
    expect(el().className).not.toContain("pwm-opening");
  });

  it("maximizes on header double-click", async () => {
    await fireEvent.dblClick(container.querySelector(".pwm-window-header-draggable")!);
    expect(store.getWindowById(id)!.isMaximized).toBe(true);
  });
});

describe("close guard", () => {
  it("closes on the close button by default", async () => {
    const store = createWindowManager(VP);
    store.openWindow("a", { title: "A" });
    const { container } = renderManager(store);
    await tick();
    await fireEvent.click(container.querySelector(".pwm-close")!);
    await tick();
    expect(store.windows).toHaveLength(1);
    expect(container.querySelector(".pwm-window.pwm-closing")).not.toBeNull();

    await flushClose();
    expect(store.windows).toHaveLength(0);
  });

  it("respects an onBeforeClose veto, then allows", async () => {
    const gate = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const store = createWindowManager({ ...VP, onBeforeClose: gate });
    store.openWindow("a", { title: "A" });
    const { container } = renderManager(store);
    await tick();

    await fireEvent.click(container.querySelector(".pwm-close")!);
    await tick();
    expect(store.windows).toHaveLength(1);

    await fireEvent.click(container.querySelector(".pwm-close")!);
    await tick();
    await flushClose();
    expect(store.windows).toHaveLength(0);
    expect(gate).toHaveBeenCalledTimes(2);
  });

  it("closes the active window on Escape", async () => {
    const store = createWindowManager(VP);
    store.openWindow("a", { title: "A" });
    renderManager(store);
    await tick();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await tick();
    await flushClose();
    expect(store.windows).toHaveLength(0);
  });
});

describe("close asked for outside the window", () => {
  it("animates it and honours the veto, like a host taskbar would", async () => {
    const gate = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const store = createWindowManager({ ...VP, onBeforeClose: gate });
    const id = store.openWindow("a", { title: "A" });
    const { container } = renderManager(store);
    await tick();

    await store.requestClose(id);
    await tick();
    expect(store.windows).toHaveLength(1);
    expect(container.querySelector(".pwm-window.pwm-closing")).toBeNull();

    await store.requestClose(id);
    await tick();
    expect(container.querySelector(".pwm-window.pwm-closing")).not.toBeNull();
    expect(store.windows).toHaveLength(1);

    await flushClose();
    expect(store.windows).toHaveLength(0);
  });
});
