/*
 * Prism Window Manager (@prism-wm), Svelte adapter tests: built-in control glyphs
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
 * Mirror of the Vue and React glyph suites. The controls fall back to inline
 * SVG rather than the text characters – □ ✕, whose size and weight came from
 * whatever font the OS substituted.
 *
 * This adapter is the one that can actually lose the fallback: forwarding a
 * slot from PrismWindowManager marks it "filled" in PrismWindow, which silently
 * suppresses PrismWindow's own fallback content. Every assertion here goes
 * through the manager for exactly that reason.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { tick } from "svelte";
import { render, cleanup } from "@testing-library/svelte";
import PrismWindowManager from "../src/PrismWindowManager.svelte";
import HostCloseIcon from "./HostCloseIcon.svelte";
import HostWindowIcon from "./HostWindowIcon.svelte";
import HostLoading from "./HostLoading.svelte";
import { createWindowManager } from "../src/store";
import Stub from "./Stub.svelte";
import type { WindowManagerStore } from "@prism-wm/core";

const VP = { getViewport: () => ({ width: 1024, height: 768 }) };

afterEach(cleanup);

describe("built-in control glyphs", () => {
  let store: WindowManagerStore;
  beforeEach(() => {
    store = createWindowManager(VP);
  });

  function renderManager() {
    return render(PrismWindowManager, {
      props: { store, resolveComponent: () => Stub },
    });
  }

  it("renders an SVG glyph in every control when no icon slot is given", async () => {
    store.openWindow("files", { title: "Files" });
    const { container } = renderManager();
    await tick();

    for (const control of [".pwm-minimize", ".pwm-maximize", ".pwm-close"]) {
      const svg = container.querySelector(`${control} svg.pwm-fallback-icon`);
      expect(svg, `${control} should fall back to an SVG`).not.toBeNull();
      expect(svg!.getAttribute("viewBox")).toBe("0 0 24 24");
    }
    expect(container.querySelector(".pwm-window-controls")!.textContent!.trim()).toBe("");
  });

  it("swaps the maximize glyph for the restore glyph when maximized", async () => {
    const id = store.openWindow("files", { title: "Files" });
    const { container } = renderManager();
    await tick();

    expect(container.querySelector('.pwm-maximize svg[data-glyph="maximize"]')).not.toBeNull();

    store.toggleMaximize(id);
    await tick();
    expect(container.querySelector('.pwm-maximize svg[data-glyph="restore"]')).not.toBeNull();
  });

  it("falls back to the window glyph when no icon slot is given", async () => {
    store.openWindow("files", { title: "Files" });
    const { container } = renderManager();
    await tick();

    const icon = container.querySelector('.pwm-window-icon-container svg[data-glyph="window"]');
    expect(icon).not.toBeNull();
    expect(icon!.getAttribute("class")).toContain("pwm-fallback-icon");
  });

  it("lets a host window icon replace the fallback", async () => {
    store.openWindow("files", { title: "Files" });
    const { container } = render(HostWindowIcon, {
      props: { store, resolveComponent: () => Stub },
    });
    await tick();

    expect(container.querySelector(".pwm-window-icon-container .host-icon")).not.toBeNull();
    expect(container.querySelector('.pwm-window-icon-container svg[data-glyph="window"]')).toBeNull();
  });

  it("lets a host icon replace the fallback", async () => {
    store.openWindow("files", { title: "Files" });
    const { container } = render(HostCloseIcon, {
      props: { store, resolveComponent: () => Stub },
    });
    await tick();

    expect(container.querySelector(".pwm-close .host-close")).not.toBeNull();
    expect(container.querySelector(".pwm-close svg.pwm-fallback-icon")).toBeNull();
    expect(container.querySelector(".pwm-minimize svg.pwm-fallback-icon")).not.toBeNull();
  });
});

describe("built-in loading fallback", () => {
  let store: WindowManagerStore;
  beforeEach(() => {
    store = createWindowManager({ getViewport: () => ({ width: 1024, height: 768 }) });
  });

  it("fills an unresolved body with the default spinner", async () => {
    store.openWindow("files", { title: "Files" });
    const { container } = render(PrismWindowManager, {
      props: { store, resolveComponent: () => null },
    });
    await tick();

    expect(container.querySelector(".pwm-window-loading")).not.toBeNull();
    expect(container.querySelector(".pwm-loading-icon")).not.toBeNull();
  });

  it("a host loading slot replaces it wholesale", async () => {
    store.openWindow("files", { title: "Files" });
    const { container } = render(HostLoading, {
      props: { store, resolveComponent: () => null },
    });
    await tick();

    expect(container.querySelector(".host-loading")).not.toBeNull();
    expect(container.querySelector(".pwm-loading-icon")).toBeNull();
  });
});

describe("appearance", () => {
  let store: WindowManagerStore;
  beforeEach(() => {
    store = createWindowManager({ getViewport: () => ({ width: 1024, height: 768 }) });
    store.openWindow("files", { title: "Files" });
  });

  const order = (c: HTMLElement) => Array.from(c.querySelectorAll(".pwm-window-control")).map((b) => b.className.match(/pwm-(minimize|maximize|close)/)![1]);

  it("defaults to redmond: controls right, minimize → maximize → close", async () => {
    const { container } = render(PrismWindowManager, {
      props: { store, resolveComponent: () => Stub },
    });
    await tick();
    expect(container.querySelector(".pwm-window")!.classList).toContain("pwm-redmond");
    expect(order(container)).toEqual(["minimize", "maximize", "close"]);
  });

  it("cupertino reorders them in the DOM, not just visually", async () => {
    const { container } = render(PrismWindowManager, {
      props: { store, resolveComponent: () => Stub, appearance: "cupertino" },
    });
    await tick();
    expect(container.querySelector(".pwm-window")!.classList).toContain("pwm-cupertino");
    expect(order(container)).toEqual(["close", "minimize", "maximize"]);
  });
});

describe("dialogs", () => {
  let store: WindowManagerStore;
  beforeEach(() => {
    store = createWindowManager({ getViewport: () => ({ width: 1024, height: 768 }) });
  });

  const renderIt = () => render(PrismWindowManager, { props: { store, resolveComponent: () => Stub } });

  it("renders as a window, without resize handles", async () => {
    store.openDialog("confirm");
    renderIt();
    await tick();

    const layer = document.querySelector(".pwm-modal-layer")!;
    expect(layer.parentElement).toBe(document.body);
    expect(layer.querySelectorAll(".pwm-resize-handle")).toHaveLength(0);
    expect(layer.querySelector(".pwm-minimize")).toBeNull();
    expect(layer.querySelector(".pwm-maximize")).toBeNull();
    expect(layer.querySelector(".pwm-close")).not.toBeNull();
  });

  it("escapes the host's stacking context by portalling to <body>", async () => {
    store.openDialog("confirm");
    renderIt();
    await tick();

    const layer = document.querySelector(".pwm-modal-layer");
    expect(layer).not.toBeNull();
    expect(layer!.parentElement).toBe(document.body);
  });

  it("blocks the whole manager by default, just under the dialog", async () => {
    const id = store.openDialog("confirm");
    renderIt();
    await tick();

    const scrim = document.querySelector(".pwm-scrim") as HTMLElement;
    expect(scrim).not.toBeNull();
    expect(scrim.style.zIndex).toBe(String(store.getWindowById(id)!.zIndex - 1));
  });

  it("modality window blocks only its owner", async () => {
    const owner = store.openWindow("editor", { allowMultiple: true });
    store.openWindow("files", { allowMultiple: true });
    store.openDialog("confirm", { ownerId: owner, modality: "window" });
    const { container } = renderIt();
    await tick();

    expect(container.querySelector(".pwm-scrim")).toBeNull();
    expect(container.querySelectorAll("[data-pwm-blocked]")).toHaveLength(1);
  });

  it("Escape closes the topmost dialog, not the window behind it", async () => {
    const win = store.openWindow("editor");
    const dlg = store.openDialog("confirm");
    renderIt();
    await tick();

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await tick();
    await tick();
    expect(store.getWindowById(dlg)!.isClosing).toBe(true);
    expect(store.getWindowById(win)!.isClosing).toBeFalsy();
  });
});
