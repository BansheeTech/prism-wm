/*
 * Prism Window Manager (@prism-wm), React adapter tests: iframe focus stealing
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
 * A click inside a cross-origin iframe raises no mouse events in this
 * document; the manager instead watches window blur and reads
 * document.activeElement to find which window's iframe took the focus.
 * These simulate exactly that hand-off.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { PrismWindowManager } from "../src/PrismWindowManager";
import { createWindowManager } from "../src/useWindowManager";
import type { WindowManagerStore, WindowState } from "@prism-wm/core";

function Stub() {
  return <div className="stub-app" />;
}

function IframeStub() {
  return <iframe title="embedded" className="stub-iframe" />;
}

function fakeActiveElement(el: Element) {
  Object.defineProperty(document, "activeElement", { configurable: true, get: () => el });
}

async function stealFocus(el: Element) {
  await act(async () => {
    fakeActiveElement(el);
    window.dispatchEvent(new Event("blur"));
    await new Promise((r) => setTimeout(r, 0));
  });
}

afterEach(() => {
  cleanup();
  delete (document as { activeElement?: Element }).activeElement;
});

describe("PrismWindowManager iframe focus", () => {
  let store: WindowManagerStore;
  beforeEach(() => {
    store = createWindowManager({ getViewport: () => ({ width: 1024, height: 768 }) });
  });

  it("raises the window whose iframe stole the focus", async () => {
    const a = store.openWindow("frame", { title: "A", allowMultiple: true });
    const b = store.openWindow("plain", { title: "B", allowMultiple: true });
    render(<PrismWindowManager store={store} resolveComponent={(win: WindowState) => (win.appId === "frame" ? IframeStub : Stub)} />);
    expect(store.activeWindowId).toBe(b);

    await stealFocus(document.querySelector(`[data-pwm-window="${a}"] iframe`)!);
    expect(store.activeWindowId).toBe(a);
  });

  it("does not re-raise when the focused iframe already belongs to the active window", async () => {
    store.openWindow("frame", { title: "A" });
    render(<PrismWindowManager store={store} resolveComponent={() => IframeStub} />);

    const focus = vi.spyOn(store, "focusWindow");
    await stealFocus(document.querySelector(".stub-iframe")!);
    expect(focus).not.toHaveBeenCalled();
  });

  it("ignores iframes that hang outside every managed window", async () => {
    store.openWindow("frame", { title: "A" });
    render(<PrismWindowManager store={store} resolveComponent={() => IframeStub} />);

    const stray = document.createElement("iframe");
    document.body.appendChild(stray);
    const focus = vi.spyOn(store, "focusWindow");
    await stealFocus(stray);
    expect(focus).not.toHaveBeenCalled();
    stray.remove();
  });
});
