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
 * <PrismDialog>: a dialog declared in a parent's markup, whose content stays in
 * that parent's scope. Mirror of the Vue and React suites: the point is that
 * the slot really is the parent's (it sees the parent's state) and that every
 * route out of the dialog agrees with the parent's `visible`.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { tick } from "svelte";
import { render, cleanup } from "@testing-library/svelte";
import DialogHost from "./DialogHost.svelte";
import PrismDialogOnly from "./DialogOnly.svelte";
import PrismWindowManager from "../src/PrismWindowManager.svelte";
import { createWindowManager } from "../src/store";
import { PWM_CLOSE_ANIMATION_MS, type WindowManagerStore } from "@prism-wm/core";

const last = <T,>(a: T[]): T | undefined => a[a.length - 1];

const VP = { getViewport: () => ({ width: 1024, height: 768 }) };

afterEach(cleanup);

async function flushClose() {
  await new Promise((r) => setTimeout(r, PWM_CLOSE_ANIMATION_MS + 30));
  await tick();
}

async function settle() {
  await tick();
  await tick();
  await tick();
}

const buttons = () => [...document.querySelectorAll<HTMLButtonElement>(".pwm-dialog-btn")];

describe("PrismDialog", () => {
  let store: WindowManagerStore;
  let events: string[];

  beforeEach(() => {
    store = createWindowManager(VP);
    events = [];
  });

  function mountHost(props: Record<string, unknown> = {}) {
    const base = { store, events, ...props };
    const r = render(DialogHost, { props: base });
    return {
      ...r,
      set: (next: Record<string, unknown>) => r.rerender({ ...base, ...next }),
    };
  }

  it("opens no window until visible turns true", async () => {
    const { set } = mountHost();
    expect(store.getState().windows).toHaveLength(0);

    await set({ visible: true });
    await settle();
    expect(store.getState().windows).toHaveLength(1);
  });

  it("opens a dialog, not a plain window", async () => {
    mountHost({ visible: true, dialogProps: { title: "Rename Folder" } });
    await settle();

    const win = store.getState().windows[0];
    expect(win.kind).toBe("dialog");
    expect(win.external).toBe(true);
    expect(win.title).toBe("Rename Folder");
  });

  it("renders the slot inside the window body", async () => {
    mountHost({ visible: true });
    await settle();

    const slot = document.querySelector(".pwm-window-slot");
    expect(slot).not.toBeNull();
    expect(slot?.querySelector(".body")?.textContent).toBe("Documents");
  });

  it("keeps the slot in the parent's scope, which is the whole point", async () => {
    const { set } = mountHost({ visible: true });
    await settle();
    expect(document.querySelector(".body")?.textContent).toBe("Documents");

    await set({ name: "Pictures" });
    await tick();
    expect(document.querySelector(".body")?.textContent).toBe("Pictures");
  });

  it("closes the window when visible turns false", async () => {
    const { set } = mountHost({ visible: true });
    await settle();
    expect(store.getState().windows).toHaveLength(1);

    await set({ visible: false });
    await tick();
    await flushClose();
    expect(store.getState().windows).toHaveLength(0);
  });

  it("never asks resolveComponent for an external dialog", async () => {
    let asked = 0;
    mountHost({
      visible: true,
      resolveComponent: () => {
        asked++;
        return null;
      },
    });
    await settle();

    expect(store.getState().windows).toHaveLength(1);
    expect(asked).toBe(0);
  });

  describe("the built-in button row", () => {
    it("dispatches ok and closes by default", async () => {
      mountHost({ visible: true, dialogProps: { okText: "Rename" } });
      await settle();

      const ok = last(buttons());
      expect(ok?.textContent?.trim()).toBe("Rename");
      ok?.click();
      await tick();
      await flushClose();

      expect(events).toEqual(["ok"]);
      expect(store.getState().windows).toHaveLength(0);
    });

    it("stays open on ok when closeOnOk is false", async () => {
      mountHost({ visible: true, dialogProps: { closeOnOk: false } });
      await settle();

      last(buttons())?.click();
      await tick();

      expect(events).toEqual(["ok"]);
      expect(store.getState().windows).toHaveLength(1);
    });

    it("dispatches cancel and closes", async () => {
      mountHost({ visible: true });
      await settle();

      buttons()[0]?.click();
      await tick();
      await flushClose();

      expect(events).toEqual(["cancel"]);
      expect(store.getState().windows).toHaveLength(0);
    });

    it("hides Cancel when okCancel is false", async () => {
      mountHost({ visible: true, dialogProps: { okCancel: false } });
      await settle();

      expect(buttons()).toHaveLength(1);
    });

    it("disables OK when okDisabled", async () => {
      mountHost({ visible: true, dialogProps: { okDisabled: true } });
      await settle();

      expect(last(buttons())?.disabled).toBe(true);
    });

    it("flips the row for reverseButtons rather than reordering the DOM", async () => {
      mountHost({ visible: true, dialogProps: { reverseButtons: true } });
      await settle();

      const footer = document.querySelector(".pwm-dialog-footer");
      expect(footer?.classList.contains("pwm-dialog-footer-reversed")).toBe(true);
      expect(footer?.firstElementChild?.textContent?.trim()).toBe("Cancel");
    });

    it("drops the row entirely with footer={false}", async () => {
      mountHost({ visible: true, dialogProps: { footer: false } });
      await settle();

      expect(document.querySelector(".pwm-dialog-footer")).toBeNull();
      expect(document.querySelector(".body")).not.toBeNull();
    });
  });

  it("reports a CANCEL when the window is closed from outside", async () => {
    mountHost({ visible: true, dialogProps: { dismissText: "Don't Save" } });
    await settle();

    store.closeWindow(store.getState().windows[0].id);
    await flushClose();

    expect(events).toEqual(["cancel"]);
    expect(events).not.toContain("dismiss");
  });

  it("reports a dismissal only from the dismiss button", async () => {
    mountHost({ visible: true, dialogProps: { dismissText: "Don't Save" } });
    await settle();

    buttons()
      .find((b) => b.textContent?.trim() === "Don't Save")
      ?.click();
    await tick();
    await flushClose();

    expect(events).toEqual(["dismiss"]);
  });

  it("pushes a title change to the open window", async () => {
    const { set } = mountHost({ visible: true, dialogProps: { title: "Step 1" } });
    await settle();
    expect(store.getState().windows[0].title).toBe("Step 1");

    await set({ dialogProps: { title: "Step 2" } });
    await tick();
    expect(store.getState().windows[0].title).toBe("Step 2");
  });

  it("closes its window when the parent unmounts", async () => {
    render(PrismWindowManager, { props: { store, resolveComponent: () => null } });
    const { unmount } = render(PrismDialogOnly, { props: { store, visible: true } });
    await settle();
    expect(store.getState().windows).toHaveLength(1);

    unmount();
    await flushClose();
    expect(store.getState().windows).toHaveLength(0);
  });
});
