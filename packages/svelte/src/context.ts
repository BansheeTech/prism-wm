/*
 * Prism Window Manager (@prism-wm), Svelte adapter
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

import { getContext, setContext } from "svelte";
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

// Join Prism's own classes with the host's, dropping empties.
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

// Stable values only; the rest go as reactive props.
export interface PrismContext {
  store: WindowManagerStore;
  ram: RamManager | null;
  resolveComponent: (window: WindowState) => unknown;
  resolveConfig: (window: WindowState) => Partial<AppConfig> | undefined;
  labels: WindowLabels;
  // Where the window controls sit. See PrismAppearance in core.
  appearance: PrismAppearance;
  requestClose: (id: string) => void | Promise<void>;
}

const PRISM_KEY = Symbol("prism-context");

export function setPrismContext(ctx: PrismContext): void {
  setContext(PRISM_KEY, ctx);
}

export function getPrismContext(): PrismContext {
  const ctx = getContext<PrismContext | undefined>(PRISM_KEY);
  if (!ctx) {
    throw new Error("PrismWindow must be used inside PrismWindowManager");
  }
  return ctx;
}

// A dialog mounted beside the manager has none, and that is legitimate.
export function getOptionalPrismContext(): PrismContext | undefined {
  return getContext<PrismContext | undefined>(PRISM_KEY);
}

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
