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

export type SnapSide = "left" | "right" | null;

// Where the window controls sit.
export type PrismAppearance = "redmond" | "cupertino";

// How much a dialog blocks.
export type DialogModality = "app" | "window" | "none";

export interface WindowState {
  id: string;
  appId: string;
  title: string;
  icon: unknown;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  isMaximized: boolean;
  isMinimized: boolean;

  // Filter these out of taskbars and alt-tabs, or entries linger.
  isClosing?: boolean;

  // A dialog is a window that cannot be resized, opens centred, and may block.
  kind?: "window" | "dialog";

  // Dialogs only. See DialogModality.
  modality?: DialogModality;

  // Dialogs only: a click on the blocker dismisses it.
  maskClosable?: boolean;

  // Dialogs only: the window this one belongs to, for modality "window".
  ownerId?: string;

  // `height` still wins if the caller passes one.
  autoHeight?: boolean;

  // The host paints the body; <PrismDialog> is built on this. Windows do not use it.
  external?: boolean;

  isSnapped?: SnapSide;
  data?: Record<string, unknown>;
}

export interface PreSnapBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

// No render component: mapping an appId to one is the adapter's job.
export interface AppConfig {
  defaultWidth: number;
  defaultHeight: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  resizable?: boolean;
  maximizable?: boolean;
  minimizable?: boolean;
  closeable?: boolean;
}

export interface Viewport {
  width: number;
  height: number;
}

// Passed once, when constructing the store.
export interface WindowManagerOptions {
  // Return undefined for unknown apps and the store falls back to defaults.
  resolveApp?: (appId: string) => Partial<AppConfig> | undefined;

  // Turns an app's name into a window title. Defaults to identity.
  translate?: (key: string) => string;

  // Defaults to window.innerWidth/innerHeight, or 1920x1080 with no DOM.
  getViewport?: () => Viewport;

  generateId?: () => string;

  // Runs for every close: the ✕, Escape, a taskbar, a menu, a script.
  onBeforeClose?: (window: WindowState | null) => boolean | Promise<boolean>;

  // Defaults to Date.now.
  now?: () => number;

  // Height reserved for a taskbar or dock, in px. Used by maximize and snap.
  taskbarHeight?: number;
}

// Hosts must not register anything against this id.
export const PWM_EXTERNAL_DIALOG_APP_ID = "__pwm_dialog";

export interface OpenWindowOptions extends Partial<Omit<WindowState, "id">> {
  // Allow more than one window for the same appId.
  allowMultiple?: boolean;
}

export interface OpenDialogOptions extends OpenWindowOptions {
  // Required for modality "window".
  ownerId?: string;

  // Defaults to "app": blocks everything until answered.
  modality?: DialogModality;

  // Called once, however the dialog closed. Dismissing counts.
  onResult?: (value: unknown) => void;

  // What a dismissal produces, e.g. dismissValue: "cancel".
  dismissValue?: unknown;

  // Let a click on the blocker dismiss the dialog. Defaults to false.
  maskClosable?: boolean;
}

// The immutable snapshot the store exposes to subscribers.
export interface WindowManagerState {
  windows: WindowState[];
  activeWindowId: string | null;
  nextZIndex: number;
  snapPreview: SnapSide;
  preSnapBounds: Record<string, PreSnapBounds>;
}
