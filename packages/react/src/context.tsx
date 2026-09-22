/*
 * Prism Window Manager (@prism-wm), React adapter
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

import { createContext, useContext, type ComponentType, type ReactNode } from "react";
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

export interface PrismClassMap {
  manager: string;
  window: string;
  windowInactive: string;
  windowActive: string;
  titleBar: string;
  title: string;
  titleActive: string;
  iconContainer: string;
  iconContainerActive: string;
  control: string;
  closeControl: string;
  body: string;
  snapPreview: string;
  dialogFooter: string;
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

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export interface PrismContext {
  store: WindowManagerStore;
  ram: RamManager | null;
  resolveComponent: (window: WindowState) => ComponentType<Record<string, unknown>> | null;
  resolveConfig: (window: WindowState) => Partial<AppConfig> | undefined;
  isMobile: boolean;
  taskbarHeight: number;
  appearance: PrismAppearance;
  labels: WindowLabels;
  classes: PrismClassMap;
  requestClose: (id: string) => void | Promise<void>;
  renderIcon?: (window: WindowState) => ReactNode;
  renderTitleBarExtra?: (window: WindowState) => ReactNode;
  renderLoading?: () => ReactNode;
  minimizeIcon?: ReactNode;
  maximizeIcon?: ReactNode;
  restoreIcon?: ReactNode;
  closeIcon?: ReactNode;
}

const Ctx = createContext<PrismContext | null>(null);
export const PrismProvider = Ctx.Provider;

export function usePrismContext(): PrismContext {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("PrismWindow must be used inside PrismWindowManager");
  }
  return ctx;
}

export function useOptionalPrismContext(): PrismContext | null {
  return useContext(Ctx);
}

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
