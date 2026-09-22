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

export { default as PrismWindowManager } from "./PrismWindowManager.svelte";
export { default as PrismWindow } from "./PrismWindow.svelte";
export { default as PrismDialog } from "./PrismDialog.svelte";
export { createWindowManager, toReadable } from "./store.js";
export { cx, EMPTY_CLASSES } from "./context.js";
export type { PrismClassMap } from "./context.js";
export { DEFAULT_LABELS, getPrismContext, getOptionalPrismContext, setPrismContext, resolveCapabilities } from "./context.js";
export type { PrismContext, WindowCapabilities, WindowLabels } from "./context.js";

export * from "@prism-wm/core";
