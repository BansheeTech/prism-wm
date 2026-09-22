/*
 * Prism Window Manager (@prism-wm), Vue adapter tests: mobile fullscreen
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
import { describe, it, expect, beforeEach } from "vitest";
import { defineComponent, h, nextTick } from "vue";
import { mount } from "@vue/test-utils";
import { createWindowManager } from "../src/useWindowManager";
import PrismWindowManager from "../src/PrismWindowManager.vue";
import type { WindowManagerStore } from "@prism-wm/core";

const Stub = defineComponent({ setup: () => () => h("div", { class: "stub-app" }) });

describe("PrismWindow mobile fullscreen", () => {
  let store: WindowManagerStore;
  beforeEach(() => {
    store = createWindowManager({
      getViewport: () => ({ width: 360, height: 740 }),
    });
  });

  it("fullscreens plain windows on mobile but never dialogs", async () => {
    store.openWindow("files", { title: "Files" });
    store.openDialog("confirm", { title: "Confirm" });
    mount(PrismWindowManager, {
      attachTo: document.body,
      props: { store, resolveComponent: () => Stub, isMobile: true },
    });
    await nextTick();

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
    const w = mount(PrismWindowManager, {
      attachTo: document.body,
      props: { store, resolveComponent: () => Stub },
    });
    await nextTick();

    expect(w.find(".pwm-window").classes()).not.toContain("pwm-fullscreen-mobile");
  });
});
