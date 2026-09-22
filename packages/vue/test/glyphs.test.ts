/*
 * Prism Window Manager (@prism-wm), Vue adapter tests: built-in control glyphs
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
 * Mirror of the React and Svelte glyph suites. The controls fall back to inline
 * SVG rather than the text characters – □ ✕, whose size and weight came from
 * whatever font the OS substituted. These guard that the fallback survives the
 * trip through PrismWindowManager's slot forwarding, and that a host icon still
 * wins over it.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { defineComponent, h, nextTick } from "vue";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createWindowManager } from "../src/useWindowManager";
import PrismWindowManager from "../src/PrismWindowManager.vue";
import type { WindowManagerStore } from "@prism-wm/core";

const Stub = defineComponent({ setup: () => () => h("div", { class: "stub-app" }) });

describe("built-in control glyphs", () => {
  let store: WindowManagerStore;
  beforeEach(() => {
    store = createWindowManager({
      getViewport: () => ({ width: 1024, height: 768 }),
    });
  });

  function mountManager(slots: Record<string, () => unknown> = {}) {
    return mount(PrismWindowManager, {
      attachTo: document.body,
      props: { store, resolveComponent: () => Stub },
      slots,
    });
  }

  it("renders an SVG glyph in every control when no icon slot is given", async () => {
    store.openWindow("files", { title: "Files" });
    const w = mountManager();
    await nextTick();

    for (const control of [".pwm-minimize", ".pwm-maximize", ".pwm-close"]) {
      const svg = w.find(`${control} svg.pwm-fallback-icon`);
      expect(svg.exists(), `${control} should fall back to an SVG`).toBe(true);
      expect(svg.attributes("viewBox")).toBe("0 0 24 24");
    }
    expect(w.find(".pwm-window-controls").text()).toBe("");
  });

  it("swaps the maximize glyph for the restore glyph when maximized", async () => {
    const id = store.openWindow("files", { title: "Files" });
    const w = mountManager();
    await nextTick();

    expect(w.find('.pwm-maximize svg[data-glyph="maximize"]').exists()).toBe(true);

    store.toggleMaximize(id);
    await nextTick();
    expect(w.find('.pwm-maximize svg[data-glyph="restore"]').exists()).toBe(true);
  });

  it("falls back to the window glyph when no icon slot is given", async () => {
    store.openWindow("files", { title: "Files" });
    const w = mountManager();
    await nextTick();

    const icon = w.find('.pwm-window-icon-container svg[data-glyph="window"]');
    expect(icon.exists()).toBe(true);
    expect(icon.classes()).toContain("pwm-fallback-icon");
  });

  it("lets a host window icon replace the fallback", async () => {
    store.openWindow("files", { title: "Files" });
    const w = mountManager({ icon: () => h("i", { class: "host-icon" }) });
    await nextTick();

    expect(w.find(".pwm-window-icon-container .host-icon").exists()).toBe(true);
    expect(w.find('.pwm-window-icon-container svg[data-glyph="window"]').exists()).toBe(false);
  });

  it("lets a host icon replace the fallback", async () => {
    store.openWindow("files", { title: "Files" });
    const w = mountManager({
      "close-icon": () => h("i", { class: "host-close" }),
    });
    await nextTick();

    expect(w.find(".pwm-close .host-close").exists()).toBe(true);
    expect(w.find(".pwm-close svg.pwm-fallback-icon").exists()).toBe(false);
    expect(w.find(".pwm-minimize svg.pwm-fallback-icon").exists()).toBe(true);
  });
});

describe("built-in loading fallback", () => {
  let store: WindowManagerStore;
  beforeEach(() => {
    store = createWindowManager({ getViewport: () => ({ width: 1024, height: 768 }) });
  });

  it("fills an unresolved body with the default spinner", async () => {
    store.openWindow("files", { title: "Files" });
    const w = mount(PrismWindowManager, {
      props: { store, resolveComponent: () => null },
    });
    await nextTick();

    expect(w.find(".pwm-window-loading").exists()).toBe(true);
    expect(w.find(".pwm-loading-icon").exists()).toBe(true);
  });

  it("a host loading slot replaces it wholesale", async () => {
    store.openWindow("files", { title: "Files" });
    const w = mount(PrismWindowManager, {
      props: { store, resolveComponent: () => null },
      slots: { loading: () => h("div", { class: "host-loading" }) },
    });
    await nextTick();

    expect(w.find(".host-loading").exists()).toBe(true);
    expect(w.find(".pwm-loading-icon").exists()).toBe(false);
  });
});

describe("appearance", () => {
  let store: WindowManagerStore;
  beforeEach(() => {
    store = createWindowManager({ getViewport: () => ({ width: 1024, height: 768 }) });
    store.openWindow("files", { title: "Files" });
  });

  const order = (w: ReturnType<typeof mount>) => w.findAll(".pwm-window-control").map((b) => b.element.className.match(/pwm-(minimize|maximize|close)/)![1]);

  it("defaults to redmond: controls right, minimize → maximize → close", async () => {
    const w = mount(PrismWindowManager, { props: { store, resolveComponent: () => Stub } });
    await nextTick();
    expect(w.find(".pwm-window").classes()).toContain("pwm-redmond");
    expect(order(w)).toEqual(["minimize", "maximize", "close"]);
  });

  it("cupertino reorders them in the DOM, not just visually", async () => {
    const w = mount(PrismWindowManager, {
      props: { store, resolveComponent: () => Stub, appearance: "cupertino" },
    });
    await nextTick();
    expect(w.find(".pwm-window").classes()).toContain("pwm-cupertino");
    expect(order(w)).toEqual(["close", "minimize", "maximize"]);
  });
});

describe("dialogs", () => {
  let store: WindowManagerStore;
  const mounted: VueWrapper[] = [];

  beforeEach(() => {
    store = createWindowManager({ getViewport: () => ({ width: 1024, height: 768 }) });
  });

  afterEach(() => {
    mounted.splice(0).forEach((w) => w.unmount());
    document.body.innerHTML = "";
  });

  const mountIt = () => {
    const w = mount(PrismWindowManager, {
      attachTo: document.body,
      props: { store, resolveComponent: () => Stub },
    });
    mounted.push(w);
    return w;
  };

  it("renders as a window, without resize handles", async () => {
    store.openDialog("confirm");
    mountIt();
    await nextTick();

    const layer = document.querySelector(".pwm-modal-layer")!;
    expect(layer.querySelectorAll(".pwm-resize-handle")).toHaveLength(0);
    expect(layer.querySelector(".pwm-minimize")).toBeNull();
    expect(layer.querySelector(".pwm-maximize")).toBeNull();
    expect(layer.querySelector(".pwm-close")).not.toBeNull();
  });

  it("escapes the host's stacking context by teleporting to <body>", async () => {
    store.openDialog("confirm");
    mountIt();
    await nextTick();

    const layer = document.querySelector(".pwm-modal-layer");
    expect(layer).not.toBeNull();
    expect(layer!.parentElement).toBe(document.body);
  });

  it("blocks the whole manager by default, just under the dialog", async () => {
    const id = store.openDialog("confirm");
    mountIt();
    await nextTick();

    const scrim = document.querySelector(".pwm-scrim");
    expect(scrim).not.toBeNull();
    expect(scrim!.getAttribute("style")).toContain(String(store.getWindowById(id)!.zIndex - 1));
  });

  it("modality window blocks only its owner", async () => {
    const owner = store.openWindow("editor", { allowMultiple: true });
    store.openWindow("files", { allowMultiple: true });
    store.openDialog("confirm", { ownerId: owner, modality: "window" });
    const w = mountIt();
    await nextTick();

    expect(w.find(".pwm-scrim").exists()).toBe(false);
    expect(w.findAll("[data-pwm-blocked]")).toHaveLength(1);
  });

  it("Escape closes the topmost dialog, not the window behind it", async () => {
    const win = store.openWindow("editor");
    const dlg = store.openDialog("confirm");
    mountIt();
    await nextTick();

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await flushPromises();
    expect(store.getWindowById(dlg)!.isClosing).toBe(true);
    expect(store.getWindowById(win)!.isClosing).toBeFalsy();
  });
});
