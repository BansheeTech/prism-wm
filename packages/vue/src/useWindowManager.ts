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

import { onUnmounted, shallowRef, type ShallowRef } from "vue";
import { WindowManagerStore, type WindowManagerOptions, type WindowManagerState } from "@prism-wm/core";

// A thin wrapper so hosts need not import the core class directly.
export function createWindowManager(options: WindowManagerOptions = {}): WindowManagerStore {
  return new WindowManagerStore(options);
}

// Returns a shallowRef of the state snapshot, reassigned on every mutation.
export function useWindowManager(store: WindowManagerStore): ShallowRef<WindowManagerState> {
  const state = shallowRef<WindowManagerState>(store.getState());
  const unsubscribe = store.subscribe(() => {
    state.value = store.getState();
  });
  onUnmounted(unsubscribe);
  return state;
}
