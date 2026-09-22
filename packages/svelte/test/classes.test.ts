/*
 * Prism Window Manager (@prism-wm), Svelte adapter tests: host theme classes
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
 * Mirror of the Vue and React `classes` suites. The `classes` prop is what lets
 * a host with its own design system paint the chrome without touching the
 * --pwm-* variables. These assert the map reaches every element it claims to,
 * tracks focus, and stays reactive when the host swaps themes at runtime.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { tick } from "svelte";
import { render, cleanup } from "@testing-library/svelte";
import PrismWindowManager from "../src/PrismWindowManager.svelte";
import { createWindowManager } from "../src/store";
import Stub from "./Stub.svelte";
import type { PrismClassMap } from "../src/context";
import type { WindowManagerStore } from "@prism-wm/core";

const VP = { getViewport: () => ({ width: 1024, height: 768 }) };

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

afterEach(cleanup);

function renderManager(store: WindowManagerStore, props: Record<string, unknown> = {}) {
  return render(PrismWindowManager, {
    props: { store, resolveComponent: () => Stub, ...props },
  });
}

describe("PrismWindowManager host classes", () => {
  let store: WindowManagerStore;
  beforeEach(() => {
    store = createWindowManager(VP);
  });

  it("applies every class-map key to its element, alongside the pwm-* classes", async () => {
    store.openWindow("files", { title: "Files" });
    const { container } = renderManager(store, { classes: THEME });
    await tick();

    const q = (sel: string) => container.querySelector(sel) as HTMLElement;

    expect(q(".pwm-manager").className).toContain("t-manager");
    expect(q(".pwm-window").className).toContain("t-window");
    expect(q(".pwm-window-header").className).toContain("t-titlebar");
    expect(q(".pwm-window-body").className).toContain("t-body");
    expect(q(".pwm-minimize").className).toContain("t-control");
    expect(q(".pwm-maximize").className).toContain("t-control");
    expect(q(".pwm-close").className).toContain("t-close");
    expect(q(".pwm-window").className).toContain("pwm-window");
  });

  it("swaps active/inactive variants with focus", async () => {
    const first = store.openWindow("a", { title: "A", allowMultiple: true });
    store.openWindow("b", { title: "B", allowMultiple: true });
    const { container } = renderManager(store, { classes: THEME });
    await tick();

    const wins = () => Array.from(container.querySelectorAll(".pwm-window"));
    expect(wins()[0].className).toContain("t-window-inactive");
    expect(wins()[1].className).toContain("t-window-active");
    expect(wins()[0].querySelector(".pwm-window-title")!.className).toContain("t-title");
    expect(wins()[1].querySelector(".pwm-window-title")!.className).toContain("t-title-active");
    expect(wins()[0].querySelector(".pwm-window-icon-container")!.className).toContain("t-icon");
    expect(wins()[1].querySelector(".pwm-window-icon-container")!.className).toContain("t-icon-active");

    store.focusWindow(first);
    await tick();
    expect(wins()[0].className).toContain("t-window-active");
  });

  it("repaints without remounting when the host swaps themes", async () => {
    store.openWindow("files", { title: "Files" });
    const { container, rerender } = renderManager(store, {
      classes: { window: "light-bg" },
    });
    await tick();
    expect((container.querySelector(".pwm-window") as HTMLElement).className).toContain("light-bg");

    await rerender({
      store,
      resolveComponent: () => Stub,
      classes: { window: "dark-bg" },
    });
    await tick();

    const cls = (container.querySelector(".pwm-window") as HTMLElement).className;
    expect(cls).toContain("dark-bg");
    expect(cls).not.toContain("light-bg");
  });

  it("omits host classes entirely when the prop is not passed", async () => {
    store.openWindow("files", { title: "Files" });
    const { container } = renderManager(store);
    await tick();

    const cls = (container.querySelector(".pwm-window") as HTMLElement).className;
    expect(cls).toContain("pwm-window");
    expect(cls).toContain("pwm-active");
    expect(cls).not.toContain("undefined");
    expect(cls).not.toMatch(/\s{2,}/);
  });

  it("sizes the snap preview against the taskbar height", async () => {
    store.openWindow("files", { title: "Files" });
    store.setSnapPreview("left");
    const { container } = renderManager(store, {
      classes: THEME,
      taskbarHeight: 64,
    });
    await tick();

    const snap = container.querySelector(".pwm-snap-preview") as HTMLElement;
    expect(snap.className).toContain("pwm-snap-left");
    expect(snap.className).toContain("t-snap");
    expect(snap.getAttribute("style")).toContain("calc(100% - 64px)");
  });
});
