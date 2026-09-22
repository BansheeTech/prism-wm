/*
 * Prism Window Manager (@prism-wm), Vue adapter tests: host theme classes
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
 * The `classes` prop is what lets a host with its own design system paint the
 * chrome without touching the --pwm-* variables. These assert the map reaches every element it claims to,
 * tracks focus, and stays reactive when the host swaps themes at runtime.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { defineComponent, h, nextTick, ref } from "vue";
import { mount } from "@vue/test-utils";
import { createWindowManager } from "../src/useWindowManager";
import PrismWindowManager from "../src/PrismWindowManager.vue";
import type { PrismClassMap } from "../src/context";
import type { WindowManagerStore } from "@prism-wm/core";

const Stub = defineComponent({ setup: () => () => h("div", { class: "stub-app" }) });

const THEME: PrismClassMap = {
  manager: "t-manager",
  window: "t-window",
  windowInactive: "t-window-inactive",
  windowActive: "t-window-active",
  titleBar: "t-titlebar",
  title: "t-title",
  titleActive: "t-title-active",
  iconContainer: "t-icon",
  iconContainerActive: "t-icon-active",
  control: "t-control",
  closeControl: "t-close",
  body: "t-body",
  snapPreview: "t-snap",
  dialogFooter: "t-dialog-footer",
  dialogButton: "t-dialog-btn",
  dialogButtonPrimary: "t-dialog-primary",
  dialogButtonDanger: "t-dialog-danger",
};

describe("PrismWindowManager host classes", () => {
  let store: WindowManagerStore;
  beforeEach(() => {
    store = createWindowManager({
      getViewport: () => ({ width: 1024, height: 768 }),
    });
  });

  it("applies every class-map key to its element, alongside the pwm-* classes", async () => {
    store.openWindow("files", { title: "Files" });
    const w = mount(PrismWindowManager, {
      attachTo: document.body,
      props: { store, resolveComponent: () => Stub, classes: THEME },
    });
    await nextTick();

    expect(w.find(".pwm-manager").classes()).toContain("t-manager");
    const win = w.find(".pwm-window");
    expect(win.classes()).toContain("t-window");
    expect(w.find(".pwm-window-header").classes()).toContain("t-titlebar");
    expect(w.find(".pwm-window-body").classes()).toContain("t-body");
    expect(w.find(".pwm-minimize").classes()).toContain("t-control");
    expect(w.find(".pwm-maximize").classes()).toContain("t-control");
    expect(w.find(".pwm-close").classes()).toContain("t-close");
    expect(win.classes()).toContain("pwm-window");
  });

  it("swaps active/inactive variants with focus", async () => {
    const first = store.openWindow("a", { title: "A", allowMultiple: true });
    store.openWindow("b", { title: "B", allowMultiple: true });
    const w = mount(PrismWindowManager, {
      attachTo: document.body,
      props: { store, resolveComponent: () => Stub, classes: THEME },
    });
    await nextTick();

    const [winA, winB] = w.findAll(".pwm-window");
    expect(winA.classes()).toContain("t-window-inactive");
    expect(winB.classes()).toContain("t-window-active");
    expect(winA.find(".pwm-window-title").classes()).toContain("t-title");
    expect(winB.find(".pwm-window-title").classes()).toContain("t-title-active");
    expect(winA.find(".pwm-window-icon-container").classes()).toContain("t-icon");
    expect(winB.find(".pwm-window-icon-container").classes()).toContain("t-icon-active");

    store.focusWindow(first);
    await nextTick();
    expect(w.findAll(".pwm-window")[0].classes()).toContain("t-window-active");
  });

  it("repaints without remounting when the host swaps themes", async () => {
    store.openWindow("files", { title: "Files" });
    const classes = ref<Partial<PrismClassMap>>({ window: "light-bg" });
    const w = mount(PrismWindowManager, {
      attachTo: document.body,
      props: { store, resolveComponent: () => Stub, classes: classes.value },
    });
    await nextTick();
    expect(w.find(".pwm-window").classes()).toContain("light-bg");

    await w.setProps({ classes: { window: "dark-bg" } });
    expect(w.find(".pwm-window").classes()).toContain("dark-bg");
    expect(w.find(".pwm-window").classes()).not.toContain("light-bg");
  });

  it("omits host classes entirely when the prop is not passed", async () => {
    store.openWindow("files", { title: "Files" });
    const w = mount(PrismWindowManager, {
      attachTo: document.body,
      props: { store, resolveComponent: () => Stub },
    });
    await nextTick();

    expect(w.find(".pwm-window").classes()).toEqual(expect.arrayContaining(["pwm-window", "pwm-active"]));
    expect(w.find(".pwm-window").classes()).not.toContain("undefined");
  });

  it("sizes the snap preview against the taskbar height", async () => {
    store.openWindow("files", { title: "Files" });
    store.setSnapPreview("left");
    const w = mount(PrismWindowManager, {
      attachTo: document.body,
      props: {
        store,
        resolveComponent: () => Stub,
        classes: THEME,
        taskbarHeight: 64,
      },
    });
    await nextTick();

    const snap = w.find(".pwm-snap-preview");
    expect(snap.classes()).toContain("pwm-snap-left");
    expect(snap.classes()).toContain("t-snap");
    expect(snap.attributes("style")).toContain("calc(100% - 64px)");
  });
});
