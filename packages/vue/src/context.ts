/*
 * Prism Window Manager (@prism-wm), Vue 3 adapter
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

import type { InjectionKey, Ref } from "vue";
import type { AppConfig, RamManager, WindowManagerStore, WindowState, PrismAppearance } from "@prism-wm/core";

export interface WindowCapabilities {
  resizable: boolean;
  maximizable: boolean;
  minimizable: boolean;
  closeable: boolean;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
}

export interface WindowLabels {
  minimize: string;
  maximize: string;
  restore: string;
  close: string;
}

export const DEFAULT_LABELS: WindowLabels = {
  minimize: "Minimize",
  maximize: "Maximize",
  restore: "Restore",
  close: "Close",
};

// Every field is optional and falls through to prism-structure.css.
export interface PrismClassMap {
  // The fixed full-viewport layer holding every window.
  manager: string;
  // The window surface itself: background, shadow, blur.
  window: string;
  windowInactive: string;
  windowActive: string;
  titleBar: string;
  title: string;
  titleActive: string;
  // The square behind the window icon.
  iconContainer: string;
  iconContainerActive: string;
  // Minimize and maximize. Put your hover variants in here too.
  control: string;
  // Close. Put your hover variants in here too.
  closeControl: string;
  // The scroll container around the app component.
  body: string;
  snapPreview: string;
  // <PrismDialog>'s button row.
  dialogFooter: string;
  // Cancel, and any dismiss button.
  dialogButton: string;
  dialogButtonPrimary: string;
  dialogButtonDanger: string;
}

export const EMPTY_CLASSES: PrismClassMap = {
  manager: "",
  window: "",
  windowInactive: "",
  windowActive: "",
  titleBar: "",
  title: "",
  titleActive: "",
  iconContainer: "",
  iconContainerActive: "",
  control: "",
  closeControl: "",
  body: "",
  snapPreview: "",
  dialogFooter: "",
  dialogButton: "",
  dialogButtonPrimary: "",
  dialogButtonDanger: "",
};

// Provided by PrismWindowManager, consumed by each PrismWindow.
export interface PrismContext {
  store: WindowManagerStore;
  ram: RamManager | null;
  resolveComponent: (window: WindowState) => unknown;
  resolveConfig: (window: WindowState) => Partial<AppConfig> | undefined;
  isMobile: Ref<boolean>;
  // Where the window controls sit. See PrismAppearance in core.
  appearance: Ref<PrismAppearance>;
  taskbarHeight: Ref<number>;
  labels: WindowLabels;
  classes: Ref<PrismClassMap>;
  requestClose: (id: string) => void | Promise<void>;
}

// Symbol.for, not Symbol: a host that loads plugins as standalone bundles ends
// up with more than one copy of this module, and a fresh Symbol per copy means
// a PrismDialog inside a plugin can never inject the manager's context even
// though it renders inside its component tree. The registry key is versioned so
// two incompatible majors cannot inject each other's context by accident.
export const PRISM_CONTEXT: InjectionKey<PrismContext> = Symbol.for("prism-wm.context.v1");

// Defaults to everything enabled.
export function resolveCapabilities(cfg: Partial<AppConfig> | undefined): WindowCapabilities {
  return {
    resizable: cfg?.resizable !== false,
    maximizable: cfg?.maximizable !== false,
    minimizable: cfg?.minimizable !== false,
    closeable: cfg?.closeable !== false,
    minWidth: cfg?.minWidth,
    minHeight: cfg?.minHeight,
    maxWidth: cfg?.maxWidth,
    maxHeight: cfg?.maxHeight,
  };
}
