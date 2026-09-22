/*
 * Prism Window Manager (@prism-wm), React adapter tests: built-in control glyphs
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
 * Mirror of the Vue and Svelte glyph suites. The controls fall back to inline
 * SVG rather than the text characters – □ ✕, whose size and weight came from
 * whatever font the OS substituted.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { PrismWindowManager } from "../src/PrismWindowManager";
import { createWindowManager } from "../src/useWindowManager";
import type { WindowManagerStore } from "@prism-wm/core";

function Stub() {
  return <div className="stub-app" />;
}

const VP = { getViewport: () => ({ width: 1024, height: 768 }) };

afterEach(cleanup);

describe("built-in control glyphs", () => {
  let store: WindowManagerStore;
  beforeEach(() => {
    store = createWindowManager(VP);
  });

  function renderManager(props: Record<string, unknown> = {}) {
    return render(<PrismWindowManager store={store} resolveComponent={() => Stub} {...props} />);
  }

  it("renders an SVG glyph in every control when no icon prop is given", () => {
    store.openWindow("files", { title: "Files" });
    const { container } = renderManager();

    for (const control of [".pwm-minimize", ".pwm-maximize", ".pwm-close"]) {
      const svg = container.querySelector(`${control} svg.pwm-fallback-icon`);
      expect(svg, `${control} should fall back to an SVG`).not.toBeNull();
      expect(svg!.getAttribute("viewBox")).toBe("0 0 24 24");
    }
    expect(container.querySelector(".pwm-window-controls")!.textContent).toBe("");
  });

  it("swaps the maximize glyph for the restore glyph when maximized", () => {
    const id = store.openWindow("files", { title: "Files" });
    const { container, rerender } = renderManager();

    expect(container.querySelector('.pwm-maximize svg[data-glyph="maximize"]')).not.toBeNull();

    store.toggleMaximize(id);
    rerender(<PrismWindowManager store={store} resolveComponent={() => Stub} />);
    expect(container.querySelector('.pwm-maximize svg[data-glyph="restore"]')).not.toBeNull();
  });

  it("falls back to the window glyph when no icon prop is given", () => {
    store.openWindow("files", { title: "Files" });
    const { container } = renderManager();

    const icon = container.querySelector('.pwm-window-icon-container svg[data-glyph="window"]');
    expect(icon).not.toBeNull();
    expect(icon!.getAttribute("class")).toContain("pwm-fallback-icon");
  });

  it("lets a host window icon replace the fallback", () => {
    store.openWindow("files", { title: "Files" });
    const { container } = renderManager({
      renderIcon: () => <i className="host-icon" />,
    });

    expect(container.querySelector(".pwm-window-icon-container .host-icon")).not.toBeNull();
    expect(container.querySelector('.pwm-window-icon-container svg[data-glyph="window"]')).toBeNull();
  });

  it("lets a host icon replace the fallback", () => {
    store.openWindow("files", { title: "Files" });
    const { container } = renderManager({
      closeIcon: <i className="host-close" />,
    });

    expect(container.querySelector(".pwm-close .host-close")).not.toBeNull();
    expect(container.querySelector(".pwm-close svg.pwm-fallback-icon")).toBeNull();
    expect(container.querySelector(".pwm-minimize svg.pwm-fallback-icon")).not.toBeNull();
  });
});

describe("built-in loading fallback", () => {
  let store: WindowManagerStore;
  beforeEach(() => {
    store = createWindowManager(VP);
  });

  it("fills an unresolved body with the default spinner", () => {
    store.openWindow("files", { title: "Files" });
    const { container } = render(<PrismWindowManager store={store} resolveComponent={() => null} />);
    expect(container.querySelector(".pwm-window-loading")).not.toBeNull();
    expect(container.querySelector(".pwm-loading-icon")).not.toBeNull();
  });

  it("does not show it while the body has a component", () => {
    store.openWindow("files", { title: "Files" });
    const { container } = render(<PrismWindowManager store={store} resolveComponent={() => Stub} />);
    expect(container.querySelector(".stub-app")).not.toBeNull();
    expect(container.querySelector(".pwm-window-loading")).toBeNull();
  });

  it("a host renderLoading replaces it wholesale", () => {
    store.openWindow("files", { title: "Files" });
    const { container } = render(<PrismWindowManager store={store} resolveComponent={() => null} renderLoading={() => <div className="host-loading" />} />);
    expect(container.querySelector(".host-loading")).not.toBeNull();
    expect(container.querySelector(".pwm-loading-icon")).toBeNull();
  });
});

describe("appearance", () => {
  let store: WindowManagerStore;
  beforeEach(() => {
    store = createWindowManager(VP);
    store.openWindow("files", { title: "Files" });
  });

  const order = (c: HTMLElement) => Array.from(c.querySelectorAll(".pwm-window-control")).map((b) => b.className.match(/pwm-(minimize|maximize|close)/)![1]);

  it("defaults to redmond: controls right, minimize → maximize → close", () => {
    const { container } = render(<PrismWindowManager store={store} resolveComponent={() => Stub} />);
    expect(container.querySelector(".pwm-window")!.classList).toContain("pwm-redmond");
    expect(order(container)).toEqual(["minimize", "maximize", "close"]);
  });

  it("cupertino reorders them in the DOM, not just visually", () => {
    const { container } = render(<PrismWindowManager store={store} resolveComponent={() => Stub} appearance="cupertino" />);
    expect(container.querySelector(".pwm-window")!.classList).toContain("pwm-cupertino");
    expect(order(container)).toEqual(["close", "minimize", "maximize"]);
  });

  it("keeps each control wired to its own action after the reorder", () => {
    const { container } = render(<PrismWindowManager store={store} resolveComponent={() => Stub} appearance="cupertino" />);
    const buttons = container.querySelectorAll(".pwm-window-control");
    expect(buttons[0].getAttribute("aria-label")).toBe("close");
    expect(buttons[1].getAttribute("aria-label")).toBe("minimize");
    expect(buttons[2].getAttribute("aria-label")).toBe("maximize");
  });
});

describe("dialogs", () => {
  let store: WindowManagerStore;
  beforeEach(() => {
    store = createWindowManager(VP);
  });

  const renderIt = () => render(<PrismWindowManager store={store} resolveComponent={() => Stub} />);

  it("renders as a window, without resize handles", () => {
    let id = "";
    act(() => {
      id = store.openDialog("confirm");
    });
    renderIt();

    const el = document.querySelector(".pwm-modal-layer .pwm-window")!;
    expect(el).not.toBeNull();
    expect(el.querySelectorAll(".pwm-resize-handle")).toHaveLength(0);
    expect(el.querySelector(".pwm-minimize")).toBeNull();
    expect(el.querySelector(".pwm-maximize")).toBeNull();
    expect(el.querySelector(".pwm-close")).not.toBeNull();
    expect(store.getWindowById(id)!.kind).toBe("dialog");
  });

  it("blocks the whole manager by default, just under the dialog", () => {
    let id = "";
    act(() => {
      id = store.openDialog("confirm");
    });
    renderIt();

    const scrim = document.querySelector(".pwm-scrim") as HTMLElement;
    expect(scrim).not.toBeNull();
    expect(Number(scrim.style.zIndex)).toBe(store.getWindowById(id)!.zIndex - 1);
  });

  it("modality window blocks only its owner, leaving the rest usable", () => {
    let owner = "";
    let other = "";
    act(() => {
      owner = store.openWindow("editor", { allowMultiple: true });
      other = store.openWindow("files", { allowMultiple: true });
      store.openDialog("confirm", { ownerId: owner, modality: "window" });
    });
    const { container } = renderIt();

    expect(container.querySelector(".pwm-scrim")).toBeNull();
    const byId = (id: string) => Array.from(container.querySelectorAll<HTMLElement>(".pwm-window")).find((el) => el.style.zIndex === String(store.getWindowById(id)!.zIndex))!;
    expect(byId(owner).hasAttribute("data-pwm-blocked")).toBe(true);
    expect(byId(other).hasAttribute("data-pwm-blocked")).toBe(false);
    expect(byId(owner).querySelector(".pwm-window-header")!.hasAttribute("inert")).toBe(true);
    expect(byId(owner).querySelector(".pwm-window-body")!.hasAttribute("inert")).toBe(true);
    expect(byId(other).querySelector(".pwm-window-body")!.hasAttribute("inert")).toBe(false);
  });

  it("modality none blocks nothing", () => {
    act(() => {
      store.openDialog("find", { modality: "none" });
    });
    const { container } = renderIt();
    expect(container.querySelector(".pwm-scrim")).toBeNull();
    expect(container.querySelector("[data-pwm-blocked]")).toBeNull();
  });

  it("Escape closes the topmost dialog, not the window behind it", async () => {
    let win = "";
    let dlg = "";
    act(() => {
      win = store.openWindow("editor");
      dlg = store.openDialog("confirm");
    });
    renderIt();

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(store.getWindowById(dlg)!.isClosing).toBe(true);
    expect(store.getWindowById(win)!.isClosing).toBeFalsy();
  });
});

describe("modal layering", () => {
  let store: WindowManagerStore;
  beforeEach(() => {
    store = createWindowManager(VP);
  });

  const renderIt = () => render(<PrismWindowManager store={store} resolveComponent={() => Stub} />);

  it("lifts an app-modal dialog out of the manager, above the host's chrome", () => {
    act(() => {
      store.openWindow("editor");
      store.openDialog("confirm");
    });
    const { container } = renderIt();

    const layer = document.querySelector(".pwm-modal-layer")!;
    expect(layer.parentElement).toBe(document.body);
    expect(layer).not.toBeNull();
    expect(layer.querySelector(".pwm-scrim")).not.toBeNull();
    expect(layer.querySelectorAll(".pwm-window")).toHaveLength(1);
    expect(container.querySelector(".pwm-manager")!.querySelectorAll(".pwm-window")).toHaveLength(1);
  });

  it("leaves window-modal and modeless dialogs among the windows", () => {
    let owner = "";
    act(() => {
      owner = store.openWindow("editor");
      store.openDialog("a", { ownerId: owner, modality: "window" });
      store.openDialog("b", { modality: "none" });
    });
    const { container } = renderIt();

    expect(container.querySelector(".pwm-modal-layer")).toBeNull();
    expect(container.querySelector(".pwm-manager")!.querySelectorAll(".pwm-window")).toHaveLength(3);
  });
});
