/*
 * Prism Window Manager (@prism-wm), Vue adapter tests
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
 * Drives the real mounted components and asserts they move the core store the
 * way they should.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { defineComponent, h, nextTick } from "vue";
import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";
import { createWindowManager } from "../src/useWindowManager";
import PrismWindowManager from "../src/PrismWindowManager.vue";
import { PWM_CLOSE_ANIMATION_MS, PWM_MINIMIZE_ANIMATION_MS, type WindowManagerStore } from "@prism-wm/core";

async function flushMinimize() {
  await new Promise((r) => setTimeout(r, PWM_MINIMIZE_ANIMATION_MS + 30));
  await nextTick();
}

async function flushClose() {
  await new Promise((r) => setTimeout(r, PWM_CLOSE_ANIMATION_MS + 30));
  await nextTick();
}

const Stub = defineComponent({
  props: { label: { type: String, default: "" } },
  setup: (p) => () => h("div", { class: "stub-app" }, p.label),
});

function mountManager(store: WindowManagerStore, props: Record<string, unknown> = {}) {
  return mount(PrismWindowManager, {
    attachTo: document.body,
    props: { store, resolveComponent: () => Stub, ...props },
  });
}

function drag(wrapper: VueWrapper, selector: string, from: { x: number; y: number }, to: { x: number; y: number }) {
  const el = wrapper.find(selector);
  el.trigger("pointerdown", { button: 0, pointerId: 1, clientX: from.x, clientY: from.y });
  el.element.dispatchEvent(new PointerEvent("pointermove", { pointerId: 1, clientX: to.x, clientY: to.y }));
  el.element.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 }));
}

describe("PrismWindowManager rendering + reactivity", () => {
  let store: WindowManagerStore;
  beforeEach(() => {
    store = createWindowManager({ getViewport: () => ({ width: 1024, height: 768 }) });
  });

  it("renders one window per store window and its title + body", async () => {
    store.openWindow("files", { title: "Files", data: { label: "hi" } });
    const w = mountManager(store);
    await nextTick();

    expect(w.findAll(".pwm-window")).toHaveLength(1);
    expect(w.find(".pwm-window-title").text()).toContain("Files");
    expect(w.find(".stub-app").text()).toBe("hi");
  });

  it("reacts to windows opened after mount", async () => {
    const w = mountManager(store);
    store.openWindow("a", { allowMultiple: true });
    store.openWindow("b", { allowMultiple: true });
    await nextTick();
    expect(w.findAll(".pwm-window")).toHaveLength(2);
  });

  it("marks the active window", async () => {
    const a = store.openWindow("a", { allowMultiple: true });
    store.openWindow("b", { allowMultiple: true });
    const w = mountManager(store);
    await nextTick();
    const windows = w.findAll(".pwm-window");
    expect(windows[1].classes()).toContain("pwm-active");
    store.focusWindow(a);
    await nextTick();
    expect(w.findAll(".pwm-window")[0].classes()).toContain("pwm-active");
  });

  it("renders the snap preview when the store has one", async () => {
    store.openWindow("a");
    const w = mountManager(store);
    store.setSnapPreview("left");
    await nextTick();
    const preview = w.find(".pwm-snap-preview");
    expect(preview.exists()).toBe(true);
    expect(preview.classes()).toContain("pwm-snap-left");
  });
});

describe("PrismWindow drag (matches the core geometry)", () => {
  it("moves the window by the drag delta and clamps", async () => {
    const store = createWindowManager({ getViewport: () => ({ width: 1024, height: 768 }) });
    const id = store.openWindow("a", { title: "A", x: 100, y: 100, width: 600, height: 400 });
    const w = mountManager(store);
    await nextTick();

    drag(w, ".pwm-window-header-draggable", { x: 200, y: 150 }, { x: 260, y: 190 });
    await nextTick();

    const win = store.getWindowById(id)!;
    expect(win.x).toBe(160);
    expect(win.y).toBe(140);
  });

  it("commits a left snap when released against the left edge", async () => {
    const store = createWindowManager({
      getViewport: () => ({ width: 1024, height: 768 }),
      taskbarHeight: 48,
    });
    const id = store.openWindow("a", { title: "A", x: 300, y: 200, width: 600, height: 400 });
    const w = mountManager(store, { taskbarHeight: 48 });
    await nextTick();

    drag(w, ".pwm-window-header-draggable", { x: 350, y: 220 }, { x: 5, y: 220 });
    await nextTick();

    const win = store.getWindowById(id)!;
    expect(win.isSnapped).toBe("left");
    expect(win).toMatchObject({ x: 0, y: 0, width: 512, height: 720 });
    expect(store.getPreSnapBounds(id)).toMatchObject({ x: -45, y: 200, width: 600, height: 400 });
  });
});

describe("PrismWindow resize (matches computeResize)", () => {
  it("grows width and height from the SE handle", async () => {
    const store = createWindowManager({ getViewport: () => ({ width: 1024, height: 768 }) });
    const id = store.openWindow("a", { title: "A", x: 100, y: 100, width: 600, height: 400 });
    const w = mountManager(store);
    await nextTick();

    drag(w, ".pwm-resize-se", { x: 700, y: 500 }, { x: 750, y: 560 });
    await nextTick();

    const win = store.getWindowById(id)!;
    expect(win.width).toBe(650);
    expect(win.height).toBe(460);
    expect(win.x).toBe(100);
    expect(win.y).toBe(100);
  });

  it("moves origin when resizing from the NW handle", async () => {
    const store = createWindowManager({ getViewport: () => ({ width: 1024, height: 768 }) });
    const id = store.openWindow("a", { title: "A", x: 300, y: 300, width: 600, height: 500 });
    const w = mountManager(store);
    await nextTick();

    drag(w, ".pwm-resize-nw", { x: 300, y: 300 }, { x: 350, y: 360 });
    await nextTick();

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
  let w: VueWrapper;
  beforeEach(async () => {
    store = createWindowManager({ getViewport: () => ({ width: 1024, height: 768 }) });
    id = store.openWindow("a", { title: "A" });
    w = mountManager(store);
    await nextTick();
  });

  it("maximizes and restores", async () => {
    await w.find(".pwm-maximize").trigger("click");
    expect(store.getWindowById(id)!.isMaximized).toBe(true);
    await w.find(".pwm-maximize").trigger("click");
    expect(store.getWindowById(id)!.isMaximized).toBe(false);
  });

  it("minimizes (state set, element hidden but still mounted)", async () => {
    await w.find(".pwm-minimize").trigger("click");
    expect(store.getWindowById(id)!.isMinimized).toBe(true);

    expect(w.find(".pwm-window").classes()).toContain("pwm-minimizing");
    expect(w.find(".pwm-window").isVisible()).toBe(true);

    await flushMinimize();
    expect(w.find(".pwm-window").exists()).toBe(true);
    expect(w.find(".pwm-window").isVisible()).toBe(false);
  });

  it("plays the restore animation on the way back", async () => {
    await w.find(".pwm-minimize").trigger("click");
    await flushMinimize();

    store.focusWindow(id);
    await nextTick();
    expect(w.find(".pwm-window").classes()).toContain("pwm-restoring");
    expect(w.find(".pwm-window").isVisible()).toBe(true);

    await flushMinimize();
    const cls = w.find(".pwm-window").classes();
    expect(cls).not.toContain("pwm-restoring");
    expect(cls).not.toContain("pwm-opening");
  });

  it("maximizes on header double-click", async () => {
    await w.find(".pwm-window-header-draggable").trigger("dblclick");
    expect(store.getWindowById(id)!.isMaximized).toBe(true);
  });
});

describe("close guard", () => {
  it("closes on the close button by default", async () => {
    const store = createWindowManager();
    store.openWindow("a", { title: "A" });
    const w = mountManager(store);
    await nextTick();
    await w.find(".pwm-close").trigger("click");
    await flushPromises();
    expect(store.windows).toHaveLength(1);
    expect(w.find(".pwm-window.pwm-closing").exists()).toBe(true);

    await flushClose();
    expect(store.windows).toHaveLength(0);
  });

  it("respects an onBeforeClose veto, then allows", async () => {
    const gate = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const store = createWindowManager({ onBeforeClose: gate });
    store.openWindow("a", { title: "A" });
    const w = mountManager(store);
    await nextTick();

    await w.find(".pwm-close").trigger("click");
    await flushPromises();
    expect(store.windows).toHaveLength(1);

    await w.find(".pwm-close").trigger("click");
    await flushPromises();
    await flushClose();
    expect(store.windows).toHaveLength(0);
    expect(gate).toHaveBeenCalledTimes(2);
  });

  it("closes the active window on Escape", async () => {
    const store = createWindowManager();
    store.openWindow("a", { title: "A" });
    mountManager(store);
    await nextTick();

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await flushPromises();
    await flushClose();
    expect(store.windows).toHaveLength(0);
  });
});

describe("close asked for outside the window", () => {
  it("animates it and honours the veto, like a host taskbar would", async () => {
    const gate = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const store = createWindowManager({ onBeforeClose: gate });
    const id = store.openWindow("a", { title: "A" });
    const w = mountManager(store);
    await nextTick();

    await store.requestClose(id);
    await flushPromises();
    await nextTick();
    expect(store.windows).toHaveLength(1);
    expect(w.find(".pwm-window.pwm-closing").exists()).toBe(false);

    await store.requestClose(id);
    await flushPromises();
    await nextTick();
    expect(w.find(".pwm-window.pwm-closing").exists()).toBe(true);
    expect(store.windows).toHaveLength(1);

    await flushClose();
    expect(store.windows).toHaveLength(0);
  });
});
