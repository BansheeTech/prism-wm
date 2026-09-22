/*
 * Prism Window Manager (@prism-wm), core store tests
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
 * The behavioural contract of WindowManagerStore, with id and viewport
 * injected so the assertions are deterministic.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { WindowManagerStore } from "../src/store.js";
import type { AppConfig } from "../src/types.js";

const VIEWPORT = { width: 1000, height: 800 };

function makeStore(overrides: Record<string, Partial<AppConfig>> = {}) {
  let n = 0;
  return new WindowManagerStore({
    generateId: () => `w${++n}`,
    getViewport: () => VIEWPORT,
    resolveApp: (id) => overrides[id],
    taskbarHeight: 0,
  });
}

describe("openWindow", () => {
  let store: WindowManagerStore;
  beforeEach(() => {
    store = makeStore({ term: { defaultWidth: 640, defaultHeight: 480 } });
  });

  it("creates a window with defaults, focus and z-index", () => {
    const id = store.openWindow("files");
    expect(id).toBe("w1");
    const w = store.getWindowById(id)!;
    expect(w).toMatchObject({
      appId: "files",
      x: 100,
      y: 100,
      width: 800,
      height: 600,
      zIndex: 1000,
      isMinimized: false,
      isMaximized: false,
    });
    expect(store.activeWindowId).toBe(id);
  });

  it("uses resolveApp default size", () => {
    const id = store.openWindow("term");
    const w = store.getWindowById(id)!;
    expect(w.width).toBe(640);
    expect(w.height).toBe(480);
  });

  it("de-dupes by appId and focuses the existing window", () => {
    const first = store.openWindow("files");
    const again = store.openWindow("files");
    expect(again).toBe(first);
    expect(store.windows).toHaveLength(1);
    expect(store.getWindowById(first)!.zIndex).toBe(1001);
  });

  it("allows duplicates with allowMultiple and cascades position", () => {
    store.openWindow("files");
    const second = store.openWindow("files", { allowMultiple: true });
    expect(store.windows).toHaveLength(2);
    expect(store.getWindowById(second)!.x).toBe(130);
    expect(store.getWindowById(second)!.y).toBe(130);
  });

  it("de-dupes per data.module (generalised enterprise-window case)", () => {
    const a = store.openWindow("ent", { data: { module: "alpha" } });
    const b = store.openWindow("ent", { data: { module: "beta" } });
    expect(b).not.toBe(a);
    const aAgain = store.openWindow("ent", { data: { module: "alpha" } });
    expect(aAgain).toBe(a);
    expect(store.windows).toHaveLength(2);
  });

  it("sanitizes the title", () => {
    const id = store.openWindow("x", { title: "  Hello  <world>  " });
    expect(store.getWindowById(id)!.title).toBe("Hello world");
  });

  it("clamps default position for tiny viewports", () => {
    const tiny = new WindowManagerStore({
      generateId: () => "t",
      getViewport: () => ({ width: 350, height: 350 }),
    });
    const id = tiny.openWindow("x");
    expect(tiny.getWindowById(id)!.x).toBe(50);
    expect(tiny.getWindowById(id)!.y).toBe(50);
  });
});

describe("focus / close / minimize active reassignment", () => {
  let store: WindowManagerStore;
  let a: string, b: string;
  beforeEach(() => {
    store = makeStore();
    a = store.openWindow("a", { allowMultiple: true });
    b = store.openWindow("b", { allowMultiple: true });
  });

  it("focus bumps z-index and sets active", () => {
    store.focusWindow(a);
    expect(store.activeWindowId).toBe(a);
    expect(store.getWindowById(a)!.zIndex).toBeGreaterThan(store.getWindowById(b)!.zIndex);
  });

  it("closing the active window reassigns active to the top-most", () => {
    expect(store.activeWindowId).toBe(b);
    store.closeWindow(b);
    expect(store.windows).toHaveLength(1);
    expect(store.activeWindowId).toBe(a);
  });

  it("closing to empty clears active", () => {
    store.closeWindow(a);
    store.closeWindow(b);
    expect(store.activeWindowId).toBeNull();
  });

  it("minimizing the active window reassigns active and hides it", () => {
    store.minimizeWindow(b);
    expect(store.getWindowById(b)!.isMinimized).toBe(true);
    expect(store.activeWindowId).toBe(a);
    expect(store.openWindows.map((w) => w.id)).toEqual([a]);
    expect(store.minimizedWindows.map((w) => w.id)).toEqual([b]);
  });

  it("beginClose marks it dying and hands focus down, keeping it listed", () => {
    expect(store.activeWindowId).toBe(b);
    store.beginClose(b);
    expect(store.getWindowById(b)!.isClosing).toBe(true);
    expect(store.activeWindowId).toBe(a);
    expect(store.windows).toHaveLength(2);
  });

  it("drops a dying window from openWindows so hosts can stop listing it", () => {
    store.beginClose(b);
    expect(store.openWindows.map((w) => w.id)).toEqual([a]);
    expect(store.windows).toHaveLength(2);
  });

  it("beginClose still marks a window that is not the active one", () => {
    store.beginClose(a);
    expect(store.getWindowById(a)!.isClosing).toBe(true);
    expect(store.activeWindowId).toBe(b);
  });

  it("beginClose skips minimized candidates and clears active when alone", () => {
    store.minimizeWindow(a);
    expect(store.activeWindowId).toBe(b);
    store.beginClose(b);
    expect(store.activeWindowId).toBeNull();
  });

  it("never hands focus to another dying window", () => {
    store.beginClose(a);
    store.beginClose(b);
    expect(store.activeWindowId).toBeNull();
  });

  it("reopening an app mid-exit opens a new window, not the corpse", () => {
    const id = store.openWindow("mail");
    store.beginClose(id);
    const again = store.openWindow("mail");
    expect(again).not.toBe(id);
    expect(store.getWindowById(again)!.isClosing).toBeFalsy();
  });

  it("focusing a minimized window un-minimizes it", () => {
    store.minimizeWindow(b);
    store.focusWindow(b);
    expect(store.getWindowById(b)!.isMinimized).toBe(false);
    expect(store.activeWindowId).toBe(b);
  });
});

describe("maximize / restore / move / resize", () => {
  let store: WindowManagerStore;
  let id: string;
  beforeEach(() => {
    store = makeStore({ x: { defaultWidth: 800, defaultHeight: 600, minWidth: 500, minHeight: 350 } });
    id = store.openWindow("x");
  });

  it("toggles maximize", () => {
    store.toggleMaximize(id);
    expect(store.getWindowById(id)!.isMaximized).toBe(true);
    store.toggleMaximize(id);
    expect(store.getWindowById(id)!.isMaximized).toBe(false);
  });

  it("clamps position and is a no-op while maximized", () => {
    store.updateWindowPosition(id, 5000, 5000);
    expect(store.getWindowById(id)!.x).toBe(900);
    store.maximizeWindow(id);
    store.updateWindowPosition(id, 10, 10);
    expect(store.getWindowById(id)!.x).toBe(900);
  });

  it("clamps size to the app minimums and is a no-op while maximized", () => {
    store.updateWindowSize(id, 100, 100);
    expect(store.getWindowById(id)!.width).toBe(500);
    expect(store.getWindowById(id)!.height).toBe(350);
    store.maximizeWindow(id);
    store.updateWindowSize(id, 700, 700);
    expect(store.getWindowById(id)!.width).toBe(500);
  });
});

describe("snap / unsnap round-trip", () => {
  it("stores pre-snap bounds and restores them", () => {
    const store = makeStore();
    const id = store.openWindow("x", { x: 120, y: 130, width: 640, height: 480 });
    store.snapWindow(id, "left", 48);
    const snapped = store.getWindowById(id)!;
    expect(snapped).toMatchObject({
      x: 0,
      y: 0,
      width: 500,
      height: 752,
      isSnapped: "left",
    });
    expect(store.getPreSnapBounds(id)).toEqual({
      x: 120,
      y: 130,
      width: 640,
      height: 480,
    });

    store.unSnapWindow(id);
    expect(store.getWindowById(id)!).toMatchObject({
      x: 120,
      y: 130,
      width: 640,
      height: 480,
      isSnapped: null,
    });
    expect(store.getPreSnapBounds(id)).toBeUndefined();
  });

  it("manages snap preview state", () => {
    const store = makeStore();
    store.setSnapPreview("right");
    expect(store.snapPreview).toBe("right");
    store.clearSnapPreview();
    expect(store.snapPreview).toBeNull();
  });
});

describe("observability / immutability", () => {
  it("notifies subscribers and swaps the state reference on mutation", () => {
    const store = makeStore();
    const before = store.getState();
    const spy = vi.fn();
    const unsub = store.subscribe(spy);

    store.openWindow("x");
    expect(spy).toHaveBeenCalled();
    const after = store.getState();
    expect(after).not.toBe(before);
    expect(before.windows).toHaveLength(0);
    expect(after.windows).toHaveLength(1);

    unsub();
    spy.mockClear();
    store.openWindow("y", { allowMultiple: true });
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("requestCloseAll", () => {
  it("marks every window for its exit animation instead of wiping the list", async () => {
    const store = makeStore();
    const a = store.openWindow("a", { allowMultiple: true });
    const b = store.openWindow("b", { allowMultiple: true });

    await store.requestCloseAll();

    expect(store.windows).toHaveLength(2);
    expect(store.getWindowById(a)!.isClosing).toBe(true);
    expect(store.getWindowById(b)!.isClosing).toBe(true);
    expect(store.openWindows).toEqual([]);
    expect(store.activeWindowId).toBeNull();
  });

  it("asks every window and reports a refusal", async () => {
    const gate = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const store = new WindowManagerStore({
      getViewport: () => ({ width: 1024, height: 768 }),
      onBeforeClose: gate,
    });
    const a = store.openWindow("a", { allowMultiple: true });
    const b = store.openWindow("b", { allowMultiple: true });

    expect(await store.requestCloseAll()).toBe(false);
    expect(gate).toHaveBeenCalledTimes(2);
    expect(store.getWindowById(a)!.isClosing).toBeFalsy();
    expect(store.getWindowById(b)!.isClosing).toBe(true);
  });

  it("closeAllWindows stays the immediate wipe", () => {
    const store = makeStore();
    store.openWindow("a", { allowMultiple: true });
    store.openWindow("b", { allowMultiple: true });
    store.closeAllWindows();
    expect(store.windows).toHaveLength(0);
    expect(store.activeWindowId).toBeNull();
  });
});

describe("dialogs", () => {
  function dialogStore() {
    return new WindowManagerStore({
      generateId: (() => {
        let n = 0;
        return () => `w${++n}`;
      })(),
      getViewport: () => ({ width: 1000, height: 800 }),
    });
  }

  it("opens centred, as a window with dialog rules", () => {
    const store = dialogStore();
    const id = store.openDialog("confirm", { width: 400, height: 200 });
    const d = store.getWindowById(id)!;

    expect(d.kind).toBe("dialog");
    expect(d.x).toBe(300);
    expect(d.y).toBe(300);
    expect(store.activeWindowId).toBe(id);
  });

  it("blocks everything by default, and says so", () => {
    const store = dialogStore();
    const id = store.openDialog("confirm");
    expect(store.getWindowById(id)!.modality).toBe("app");
  });

  it("can be scoped to its owner, or block nothing", () => {
    const store = dialogStore();
    const owner = store.openWindow("editor");
    const scoped = store.openDialog("confirm", { ownerId: owner, modality: "window" });
    const modeless = store.openDialog("find", { modality: "none" });

    expect(store.getWindowById(scoped)!.ownerId).toBe(owner);
    expect(store.getWindowById(scoped)!.modality).toBe("window");
    expect(store.getWindowById(modeless)!.modality).toBe("none");
  });

  it("stays out of openWindows so taskbars do not list it", () => {
    const store = dialogStore();
    const win = store.openWindow("editor");
    const dlg = store.openDialog("confirm");

    expect(store.openWindows.map((w) => w.id)).toEqual([win]);
    expect(store.dialogs.map((w) => w.id)).toEqual([dlg]);
    expect(store.windows).toHaveLength(2);
  });

  it("does not de-dupe: two questions are two dialogs", () => {
    const store = dialogStore();
    const a = store.openDialog("confirm");
    const b = store.openDialog("confirm");
    expect(b).not.toBe(a);
  });

  it("closes through the normal protocol, veto included", async () => {
    const gate = vi.fn().mockResolvedValue(false);
    const store = new WindowManagerStore({
      getViewport: () => ({ width: 1000, height: 800 }),
      onBeforeClose: gate,
    });
    const id = store.openDialog("confirm");
    expect(await store.requestClose(id)).toBe(false);
    expect(gate).toHaveBeenCalledTimes(1);
  });
});

describe("dialog sizing", () => {
  it("lets the content decide the height by default", () => {
    const store = new WindowManagerStore({
      getViewport: () => ({ width: 1000, height: 800 }),
    });
    const id = store.openDialog("confirm", { width: 400 });
    expect(store.getWindowById(id)!.autoHeight).toBe(true);
  });

  it("an explicit height wins, and turns auto off", () => {
    const store = new WindowManagerStore({
      getViewport: () => ({ width: 1000, height: 800 }),
    });
    const id = store.openDialog("confirm", { width: 400, height: 300 });
    const d = store.getWindowById(id)!;
    expect(d.autoHeight).toBe(false);
    expect(d.height).toBe(300);
  });
});

describe("dialog stacking and dragging", () => {
  function s() {
    return new WindowManagerStore({ getViewport: () => ({ width: 1000, height: 800 }) });
  }

  it("leaves a z-index gap under the dialog for the scrim", () => {
    const store = s();
    const owner = store.openWindow("editor");
    const dlg = store.openDialog("confirm");
    const ownerZ = store.getWindowById(owner)!.zIndex;
    const dlgZ = store.getWindowById(dlg)!.zIndex;
    expect(dlgZ).toBeGreaterThan(ownerZ + 1);
  });

  it("cannot be dragged off the screen", () => {
    const store = s();
    const dlg = store.openDialog("confirm", { width: 400, height: 200 });
    store.updateWindowPosition(dlg, -800, -800);
    expect(store.getWindowById(dlg)).toMatchObject({ x: 16, y: 16 });
  });

  it("a normal window still can be", () => {
    const store = s();
    const win = store.openWindow("editor", { width: 400 });
    store.updateWindowPosition(win, -800, -800);
    expect(store.getWindowById(win)!.x).toBe(-300);
  });

  it("takes a measured height without applying the resize minimums", () => {
    const store = s();
    const dlg = store.openDialog("confirm", { width: 380 });
    store.setMeasuredHeight(dlg, 168);
    expect(store.getWindowById(dlg)!.height).toBe(168);
  });
});

describe("dialog results", () => {
  function s() {
    return new WindowManagerStore({ getViewport: () => ({ width: 1000, height: 800 }) });
  }

  it("reports the answer a button gave", async () => {
    const store = s();
    const onResult = vi.fn();
    const id = store.openDialog("confirm", { onResult, dismissValue: "cancel" });

    store.resolveDialog(id, "yes");
    store.closeWindow(id);
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith("yes");
  });

  it("reports the dismissValue when it is closed without one", () => {
    const store = s();
    const onResult = vi.fn();
    const id = store.openDialog("confirm", { onResult, dismissValue: "cancel" });

    store.closeWindow(id);
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith("cancel");
  });

  it("fires exactly once, and never after the dialog is gone", () => {
    const store = s();
    const onResult = vi.fn();
    const id = store.openDialog("confirm", { onResult, dismissValue: "cancel" });

    store.closeWindow(id);
    store.closeWindow(id);
    expect(onResult).toHaveBeenCalledTimes(1);
  });

  it("reports undefined when no dismissValue was given", () => {
    const store = s();
    const onResult = vi.fn();
    const id = store.openDialog("confirm", { onResult });
    store.closeWindow(id);
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith(undefined);
  });

  it("closeAllWindows dismisses every pending dialog", () => {
    const store = s();
    const a = vi.fn();
    const b = vi.fn();
    store.openDialog("one", { onResult: a, dismissValue: "cancel" });
    store.openDialog("two", { onResult: b, dismissValue: "cancel" });

    store.closeAllWindows();
    expect(a).toHaveBeenCalledTimes(1);
    expect(a).toHaveBeenCalledWith("cancel");
    expect(b).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledWith("cancel");
  });
});

describe("maskClosable", () => {
  function s() {
    return new WindowManagerStore({ getViewport: () => ({ width: 1000, height: 800 }) });
  }

  it("is off unless asked for: a stray backdrop click cannot lose a question", () => {
    const store = s();
    const id = store.openDialog("confirm");
    store.dismissTopDialog();
    expect(store.getWindowById(id)!.isClosing).toBeFalsy();
  });

  it("dismisses when enabled, and reports it as a dismissal", () => {
    const store = s();
    const onResult = vi.fn();
    const id = store.openDialog("confirm", {
      maskClosable: true,
      dismissValue: "cancel",
      onResult,
    });

    store.dismissTopDialog();
    store.closeWindow(id);
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith("cancel");
  });

  it("only ever dismisses the topmost one", () => {
    const store = s();
    const under = store.openDialog("a", { maskClosable: true });
    const over = store.openDialog("b", { maskClosable: false });

    store.dismissTopDialog();
    expect(store.getWindowById(over)!.isClosing).toBeFalsy();
    expect(store.getWindowById(under)!.isClosing).toBeFalsy();
  });

  it("window-modal dialogs dismiss from a click on the window they block", () => {
    const store = s();
    const owner = store.openWindow("editor");
    const dlg = store.openDialog("confirm", {
      ownerId: owner,
      modality: "window",
      maskClosable: true,
    });

    store.dismissDialogFor(owner);
    expect(store.getWindowById(dlg)!.isClosing).toBe(true);
  });
});

describe("title sanitising", () => {
  function titleOf(input: string) {
    const store = new WindowManagerStore({ getViewport: () => ({ width: 1000, height: 800 }) });
    return store.getWindowById(store.openWindow("a", { title: input }))!.title;
  }

  it("keeps the punctuation a question needs", () => {
    expect(titleOf("Discard changes?")).toBe("Discard changes?");
    expect(titleOf("¿Eliminar l'application?")).toBe("¿Eliminar l'application?");
    expect(titleOf("Delete file.txt, permanently!")).toBe("Delete file.txt, permanently!");
  });

  it("still drops angle brackets", () => {
    expect(titleOf("Hello <world>")).toBe("Hello world");
  });

  it("still collapses whitespace and caps the length", () => {
    expect(titleOf("  a   b  ")).toBe("a b");
    expect(titleOf("x".repeat(80))).toHaveLength(50);
  });

  it("falls back when nothing survives", () => {
    expect(titleOf("<<>>")).toBe("Untitled");
  });
});
