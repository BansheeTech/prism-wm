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

export { WindowManagerStore } from "./store.js";
export { RamManager } from "./ram-manager.js";
export { detectSnapEdge, computeSnapBounds, computeResize, centerDialog, clampDialogPosition, clampPosition, clampSize, DIALOG_BOUNDARY_MARGIN, computeUnsnapFlip, SNAP_EDGE_THRESHOLD, DEFAULT_MIN_WIDTH, DEFAULT_MIN_HEIGHT, KEEP_ON_SCREEN, UNSNAP_DRAG_THRESHOLD, PWM_UNSNAP_ANIMATION_MS, PWM_OPEN_ANIMATION_MS, PWM_CLOSE_ANIMATION_MS, PWM_MINIMIZE_ANIMATION_MS, prefersReducedMotion } from "./geometry.js";
export type { Bounds, ResizeDirection, ResizeInput, UnsnapFlip } from "./geometry.js";
export { PWM_EXTERNAL_DIALOG_APP_ID } from "./types.js";
export type { WindowState, WindowManagerState, WindowManagerOptions, OpenWindowOptions, AppConfig, Viewport, SnapSide, PrismAppearance, DialogModality, OpenDialogOptions, PreSnapBounds } from "./types.js";
