/*
 * Prism Window Manager (@prism-wm), Svelte adapter tests: mobile fullscreen
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
 * On mobile every plain window goes fullscreen, but a dialog must stay a
 * dialog: centred, viewport-capped, never edge-to-edge. These pin both the
 * pwm-fullscreen-mobile class and the inline geometry to that split.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { tick } from "svelte";
import { render, cleanup } from "@testing-library/svelte";
import PrismWindowManager from "../src/PrismWindowManager.svelte";
import { createWindowManager } from "../src/store";
import Stub from "./Stub.svelte";
import type { WindowManagerStore } from "@prism-wm/core";

const VP = { getViewport: () => ({ width: 360, height: 740 }) };

afterEach(cleanup);

describe("PrismWindow mobile fullscreen", () => {
  let store: WindowManagerStore;
  beforeEach(() => {
    store = createWindowManager(VP);
  });

  it("fullscreens plain windows on mobile but never dialogs", async () => {
    store.openWindow("files", { title: "Files" });
    store.openDialog("confirm", { title: "Confirm" });
    render(PrismWindowManager, {
      props: { store, resolveComponent: () => Stub, isMobile: true },
    });
    await tick();

    const windows = Array.from(document.querySelectorAll<HTMLElement>(".pwm-window"));
    const plain = windows.find((n) => !n.classList.contains("pwm-dialog"))!;
    const dialog = windows.find((n) => n.classList.contains("pwm-dialog"))!;

    expect(plain.classList.contains("pwm-fullscreen-mobile")).toBe(true);
    expect(dialog.classList.contains("pwm-fullscreen-mobile")).toBe(false);
    expect(plain.getAttribute("style")).toContain("100vw");
    expect(dialog.getAttribute("style")).not.toContain("100vw");
  });

  it("leaves the class off everything on desktop", async () => {
    store.openWindow("files", { title: "Files" });
    const { container } = render(PrismWindowManager, {
      props: { store, resolveComponent: () => Stub },
    });
    await tick();

    expect(container.querySelector(".pwm-window")!.classList.contains("pwm-fullscreen-mobile")).toBe(false);
  });
});
