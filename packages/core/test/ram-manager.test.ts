/*
 * Prism Window Manager (@prism-wm), RAM manager tests
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
 * The three eviction paths: memory pressure, the absolute cap, and being over
 * the device limit past the soft grace period.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { RamManager } from "../src/ram-manager.js";

const GRACE = 120000;
const MAX_GRACE = 300000;
const TICK = 5000;

function setPressure(ratio: number) {
  (performance as unknown as { memory: unknown }).memory = {
    usedJSHeapSize: ratio * 1000,
    jsHeapSizeLimit: 1000,
  };
}
function clearPressure() {
  delete (performance as unknown as { memory?: unknown }).memory;
}

describe("RamManager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearPressure();
  });
  afterEach(() => {
    clearPressure();
    vi.useRealTimers();
  });

  it("evicts the oldest immediately under memory pressure", () => {
    const clock = { t: 0 };
    const ram = new RamManager(() => clock.t);
    const destroyA = vi.fn();
    const destroyB = vi.fn();

    ram.onMinimize("a", destroyA);
    clock.t = 10;
    ram.onMinimize("b", destroyB);

    setPressure(0.8);
    vi.advanceTimersByTime(TICK);

    expect(destroyA).toHaveBeenCalledTimes(1);
    expect(destroyB).not.toHaveBeenCalled();
  });

  it("evicts anything past the absolute grace period", () => {
    const clock = { t: 0 };
    const ram = new RamManager(() => clock.t);
    const destroy = vi.fn();

    ram.onMinimize("a", destroy);
    clock.t = MAX_GRACE + 1;
    vi.advanceTimersByTime(TICK);

    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it("does not evict a window still within the soft grace period", () => {
    const clock = { t: 0 };
    const ram = new RamManager(() => clock.t);
    const destroy = vi.fn();

    ram.onMinimize("a", destroy);
    clock.t = GRACE - 1;
    vi.advanceTimersByTime(TICK);

    expect(destroy).not.toHaveBeenCalled();
  });

  it("trims down to the device limit once past the soft grace", () => {
    const clock = { t: 0 };
    const ram = new RamManager(() => clock.t);
    const destroys = ["a", "b", "c", "d", "e"].map((id) => {
      const fn = vi.fn();
      ram.onMinimize(id, fn);
      return { id, fn };
    });

    clock.t = GRACE + 1;
    vi.advanceTimersByTime(TICK);

    const evicted = destroys.filter((d) => d.fn.mock.calls.length > 0);
    expect(evicted).toHaveLength(1);
    expect(evicted[0].id).toBe("a");
  });

  it("stops evicting after a window is restored", () => {
    const clock = { t: 0 };
    const ram = new RamManager(() => clock.t);
    const destroy = vi.fn();

    ram.onMinimize("a", destroy);
    ram.onRestore("a");

    clock.t = MAX_GRACE + 1;
    vi.advanceTimersByTime(TICK * 3);

    expect(destroy).not.toHaveBeenCalled();
  });
});
