/*
 * Prism Window Manager (@prism-wm)
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
 */

import { centerDialog, clampDialogPosition, clampPosition, clampSize, computeSnapBounds, DEFAULT_MIN_HEIGHT, DEFAULT_MIN_WIDTH } from "./geometry.js";
import type { AppConfig, OpenDialogOptions, OpenWindowOptions, SnapSide, Viewport, WindowManagerOptions, WindowManagerState, WindowState } from "./types.js";

type Listener = () => void;

function defaultViewport(): Viewport {
  if (typeof window !== "undefined") {
    return { width: window.innerWidth, height: window.innerHeight };
  }
  return { width: 1920, height: 1080 };
}

function defaultId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Titles render as text, so only control characters and length need guarding.
function sanitizeTitle(title: string): string {
  if (typeof title !== "string") return "Untitled";
  let s = title.trim();
  s = s.replace(/[\x00-\x1F\x7F-\x9F]/g, "");
  s = s.replace(/[<>]/g, "");
  s = s.replace(/\s+/g, " ");
  s = s.substring(0, 50).trim();
  return s.length === 0 ? "Untitled" : s;
}

// Every mutation replaces `state`, so an identity check detects it.
export class WindowManagerStore {
  private state: WindowManagerState = {
    windows: [],
    activeWindowId: null,
    nextZIndex: 1000,
    snapPreview: null,
    preSnapBounds: {},
  };

  private listeners = new Set<Listener>();

  // Pending dialog answers. Entries are deleted as they settle.
  private dialogResults = new Map<string, { onResult: (value: unknown) => void; dismissValue: unknown; value?: unknown }>();

  private readonly resolveApp: (id: string) => Partial<AppConfig> | undefined;
  private readonly translate: (key: string) => string;
  private readonly getViewport: () => Viewport;
  private readonly genId: () => string;
  private readonly taskbarHeight: number;
  private readonly onBeforeClose?: (window: WindowState | null) => boolean | Promise<boolean>;

  constructor(options: WindowManagerOptions = {}) {
    this.resolveApp = options.resolveApp ?? (() => undefined);
    this.translate = options.translate ?? ((k) => k);
    this.getViewport = options.getViewport ?? defaultViewport;
    this.genId = options.generateId ?? defaultId;
    this.taskbarHeight = options.taskbarHeight ?? 0;
    this.onBeforeClose = options.onBeforeClose;
  }

  // ---- Subscription API -------------------------------------------------

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Stable snapshot. The reference changes on every mutation.
  getState(): Readonly<WindowManagerState> {
    return this.state;
  }

  private set(patch: Partial<WindowManagerState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  private patchWindow(id: string, patch: Partial<WindowState>): boolean {
    const idx = this.state.windows.findIndex((w) => w.id === id);
    if (idx === -1) return false;
    const windows = this.state.windows.slice();
    windows[idx] = { ...windows[idx], ...patch };
    this.set({ windows });
    return true;
  }

  // ---- Selectors --------------------------------------------------------

  get windows(): WindowState[] {
    return this.state.windows;
  }
  get activeWindowId(): string | null {
    return this.state.activeWindowId;
  }
  get snapPreview(): SnapSide {
    return this.state.snapPreview;
  }
  getWindowById(id: string): WindowState | null {
    return this.state.windows.find((w) => w.id === id) ?? null;
  }
  getPreSnapBounds(id: string) {
    return this.state.preSnapBounds[id];
  }
  isAppOpen(appId: string): boolean {
    return this.state.windows.some((w) => w.appId === appId);
  }
  // Windows a user would call open. Adapters render `windows` instead.
  get openWindows(): WindowState[] {
    return this.state.windows.filter((w) => !w.isMinimized && !w.isClosing && w.kind !== "dialog");
  }

  // Topmost last.
  get dialogs(): WindowState[] {
    return this.state.windows.filter((w) => w.kind === "dialog" && !w.isClosing);
  }
  get minimizedWindows(): WindowState[] {
    return this.state.windows.filter((w) => w.isMinimized);
  }

  // ---- Actions ----------------------------------------------------------

  openWindow(appId: string, options: OpenWindowOptions = {}): string {
    if (!options.allowMultiple) {
      const existing = this.state.windows.find((w) => {
        if (w.appId !== appId) return false;
        // Re-focusing a window that is animating out would revive it instead of opening anything.
        if (w.isClosing) return false;
        // If the caller passes data.module, only same-module windows count as duplicates.
        const mod = (options.data as { module?: unknown } | undefined)?.module;
        if (mod !== undefined) {
          return (w.data as { module?: unknown } | undefined)?.module === mod;
        }
        return true;
      });
      if (existing) {
        this.focusWindow(existing.id);
        return existing.id;
      }
    }

    const app = this.resolveApp(appId);
    const vp = this.getViewport();
    const cascadeOffset = this.state.windows.length * 30;

    const rawTitle = options.title ?? (appId ? this.translate(appId) : appId);
    const id = this.genId();

    const zIndex = this.state.nextZIndex;

    const newWindow: WindowState = {
      id,
      appId,
      title: sanitizeTitle(rawTitle),
      icon: options.icon ?? (options.data as { icon?: unknown })?.icon ?? null,
      x: options.x ?? Math.min(100 + cascadeOffset, vp.width - 300),
      y: options.y ?? Math.min(100 + cascadeOffset, vp.height - 300),
      width: options.width ?? app?.defaultWidth ?? 800,
      height: options.height ?? app?.defaultHeight ?? 600,
      zIndex,
      isMaximized: options.isMaximized ?? false,
      isMinimized: false,
      isClosing: false,
      isSnapped: null,
      data: { ...options.data, _windowId: id },
    };

    this.set({
      windows: [...this.state.windows, newWindow],
      nextZIndex: zIndex + 1,
      activeWindowId: id,
    });
    return id;
  }

  // A window that cannot be resized or minimized, opens centred, and blocks.
  openDialog(appId: string, options: OpenDialogOptions = {}): string {
    const vp = this.getViewport();
    const app = this.resolveApp(appId);
    const width = options.width ?? app?.defaultWidth ?? 420;

    // Only a placeholder when the height is automatic:
    const height = options.height ?? app?.defaultHeight ?? 200;
    const autoHeight = options.height === undefined;

    // Over the owner for a window-modal dialog, over the viewport otherwise.
    const owner = options.modality === "window" && options.ownerId ? this.getWindowById(options.ownerId) : null;
    const centred = centerDialog(width, height, vp, owner);

    const id = this.openWindow(appId, {
      // Two dialogs asking different things are two dialogs: never de-duped.
      allowMultiple: true,
      ...options,
      width,
      height,

      // Centred, unless the caller pinned it somewhere.
      x: options.x ?? centred.x,
      y: options.y ?? centred.y,
    });

    // Reserves the z below the dialog for the scrim, or DOM order breaks the tie.
    const z = this.state.nextZIndex;
    this.set({ nextZIndex: z + 1 });
    this.patchWindow(id, {
      zIndex: z,
      kind: "dialog",
      modality: options.modality ?? "app",
      maskClosable: options.maskClosable ?? false,
      ownerId: options.ownerId,
      autoHeight,
      external: options.external ?? false,
    });

    if (options.onResult) {
      this.dialogResults.set(id, {
        onResult: options.onResult,
        dismissValue: options.dismissValue,
      });
    }
    return id;
  }

  // A click on the app-wide scrim.
  dismissTopDialog(): void {
    const modal = this.dialogs.filter((d) => (d.modality ?? "app") === "app");
    if (!modal.length) return;
    const top = modal.reduce((m, d) => (d.zIndex > m.zIndex ? d : m));
    if (top.maskClosable) void this.requestClose(top.id);
  }

  // The same for a window-modal dialog: a click on the window it blocks.
  dismissDialogFor(ownerId: string): void {
    const owned = this.dialogs.filter((d) => d.modality === "window" && d.ownerId === ownerId);
    if (!owned.length) return;
    const top = owned.reduce((m, d) => (d.zIndex > m.zIndex ? d : m));
    if (top.maskClosable) void this.requestClose(top.id);
  }

  // Answer a dialog and close it:
  resolveDialog(id: string, value: unknown): void {
    const pending = this.dialogResults.get(id);
    if (pending) pending.value = value;
    void this.requestClose(id);
  }

  closeWindow(id: string): void {
    const idx = this.state.windows.findIndex((w) => w.id === id);
    if (idx === -1) return;

    // Settled here so a dialog closed by the ✕, Escape or a menu still reports back.
    this.settleDialog(id);

    const windows = this.state.windows.slice();
    windows.splice(idx, 1);

    let activeWindowId = this.state.activeWindowId;
    if (activeWindowId === id) {
      // Skips windows that are themselves mid-exit:
      const candidates = windows.filter((w) => !w.isClosing);
      activeWindowId = candidates.length > 0 ? candidates.reduce((max, w) => (w.zIndex > max.zIndex ? w : max)).id : null;
    }
    this.set({ windows, activeWindowId });
  }

  // The user-facing close: runs the veto, then marks the window as leaving.
  async requestClose(id: string): Promise<boolean> {
    const win = this.getWindowById(id);
    if (!win || win.isClosing) return false;

    if (this.onBeforeClose) {
      const ok = await this.onBeforeClose(win);
      if (!ok) return false;
      // The veto may have taken a while; the window could be gone by now.
      if (!this.getWindowById(id)) return false;
    }

    this.beginClose(id);
    return true;
  }

  // Marks the window as leaving; the adapter removes it after the animation.
  beginClose(id: string): void {
    if (!this.patchWindow(id, { isClosing: true })) return;

    if (this.state.activeWindowId !== id) return;
    const candidates = this.state.windows.filter((w) => w.id !== id && !w.isMinimized && !w.isClosing);
    this.set({
      activeWindowId: candidates.length > 0 ? candidates.reduce((max, w) => (w.zIndex > max.zIndex ? w : max)).id : null,
    });
  }

  focusWindow(id: string): void {
    const idx = this.state.windows.findIndex((w) => w.id === id);
    if (idx === -1) return;

    const zIndex = this.state.nextZIndex;
    const windows = this.state.windows.slice();
    windows[idx] = { ...windows[idx], zIndex, isMinimized: false };
    this.set({ windows, nextZIndex: zIndex + 1, activeWindowId: id });
  }

  minimizeWindow(id: string): void {
    if (!this.patchWindow(id, { isMinimized: true })) return;

    if (this.state.activeWindowId === id) {
      const visible = this.state.windows.filter((w) => !w.isMinimized && !w.isClosing);
      const activeWindowId = visible.length > 0 ? visible.reduce((max, w) => (w.zIndex > max.zIndex ? w : max)).id : null;
      this.set({ activeWindowId });
    }
  }

  toggleMaximize(id: string): void {
    const win = this.getWindowById(id);
    if (!win) return;
    this.patchWindow(id, { isMaximized: !win.isMaximized });
  }

  maximizeWindow(id: string): void {
    this.patchWindow(id, { isMaximized: true });
  }

  restoreWindow(id: string): void {
    this.patchWindow(id, { isMaximized: false });
  }

  toggleMinimizeWindow(id: string): void {
    const win = this.getWindowById(id);
    if (!win) return;
    if (win.isMinimized) this.focusWindow(id);
    else if (this.state.activeWindowId === id) this.minimizeWindow(id);
    else this.focusWindow(id);
  }

  updateWindowPosition(id: string, x: number, y: number): void {
    const win = this.getWindowById(id);
    if (!win || win.isMaximized) return;
    // Dialogs stay wholly on screen; windows may be parked half off the edge.
    const clamped = win.kind === "dialog" ? clampDialogPosition(x, y, win.width, win.height, this.getViewport()) : clampPosition(x, y, win.width, this.getViewport());
    this.patchWindow(id, clamped);
  }

  // An adapter reporting a content-sized dialog's real height once rendered.
  setMeasuredHeight(id: string, height: number): void {
    const win = this.getWindowById(id);
    if (!win?.autoHeight || win.height === height) return;
    this.patchWindow(id, { height });
  }

  updateWindowSize(id: string, width: number, height: number): void {
    const win = this.getWindowById(id);
    if (!win || win.isMaximized) return;
    const app = this.resolveApp(win.appId);
    const clamped = clampSize(width, height, app?.minWidth ?? DEFAULT_MIN_WIDTH, app?.minHeight ?? DEFAULT_MIN_HEIGHT);
    this.patchWindow(id, clamped);
  }

  updateWindowData(id: string, data: Record<string, unknown>): void {
    const win = this.getWindowById(id);
    if (!win) return;
    this.patchWindow(id, { data: { ...win.data, ...data } });
  }

  updateWindowTitle(id: string, title: string): void {
    if (!this.getWindowById(id)) return;
    this.patchWindow(id, { title: sanitizeTitle(title) });
  }

  // The "close all" a menu should call.
  async requestCloseAll(): Promise<boolean> {
    let all = true;
    // Snapshot the ids first: the list mutates underneath as windows accept.
    for (const id of this.state.windows.map((w) => w.id)) {
      if (!(await this.requestClose(id))) all = false;
    }
    return all;
  }

  // Immediate and unconditional:
  closeAllWindows(): void {
    // Every pending dialog is being dismissed, so say so before they vanish.
    for (const id of [...this.dialogResults.keys()]) this.settleDialog(id);
    this.set({ windows: [], activeWindowId: null });
  }

  // Fire a dialog's onResult exactly once, then forget it.
  private settleDialog(id: string): void {
    const pending = this.dialogResults.get(id);
    if (!pending) return;
    this.dialogResults.delete(id);
    pending.onResult("value" in pending ? pending.value : pending.dismissValue);
  }

  // ---- Snap -------------------------------------------------------------

  setSnapPreview(side: SnapSide): void {
    this.set({ snapPreview: side });
  }

  clearSnapPreview(): void {
    if (this.state.snapPreview !== null) this.set({ snapPreview: null });
  }

  snapWindow(id: string, side: "left" | "right", taskbarHeight?: number): void {
    const win = this.getWindowById(id);
    if (!win) return;

    const preSnapBounds = { ...this.state.preSnapBounds };
    if (!win.isSnapped) {
      preSnapBounds[id] = {
        x: win.x,
        y: win.y,
        width: win.width,
        height: win.height,
      };
    }

    const bounds = computeSnapBounds(side, this.getViewport(), taskbarHeight ?? this.taskbarHeight);

    this.set({ preSnapBounds, snapPreview: null });
    this.patchWindow(id, { ...bounds, isSnapped: side, isMaximized: false });
  }

  unSnapWindow(id: string): void {
    const win = this.getWindowById(id);
    if (!win || !win.isSnapped) return;

    const bounds = this.state.preSnapBounds[id];
    if (bounds) {
      const preSnapBounds = { ...this.state.preSnapBounds };
      delete preSnapBounds[id];
      this.set({ preSnapBounds });
      this.patchWindow(id, { ...bounds, isSnapped: null });
    } else {
      this.patchWindow(id, { isSnapped: null });
    }
  }
}
