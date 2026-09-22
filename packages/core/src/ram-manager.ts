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

// Destroys the body of a long-minimized window under memory pressure.

const MEMORY_PRESSURE_THRESHOLD = 0.75;
const GRACE_PERIOD_MS = 120000;
const MAX_GRACE_PERIOD_MS = 300000;
const MEMORY_CHECK_INTERVAL = 5000;

interface Tracked {
  id: string;
  minimizedAt: number;
  destroy: () => void;
}

function deviceMaxMinimized(): number {
  const dm = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
  if (!dm || dm < 2) return 4;
  if (dm <= 2) return 2;
  if (dm <= 4) return 4;
  if (dm <= 8) return 6;
  return 8;
}

function underMemoryPressure(): boolean {
  const mem = (
    performance as unknown as {
      memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
    }
  ).memory;
  if (!mem) return false;
  return mem.usedJSHeapSize / mem.jsHeapSizeLimit > MEMORY_PRESSURE_THRESHOLD;
}

// One per window-manager instance, created by the adapter.
export class RamManager {
  private tracked = new Map<string, Tracked>();
  private interval: ReturnType<typeof setInterval> | null = null;
  private readonly now: () => number;

  constructor(now: () => number = () => Date.now()) {
    this.now = now;
  }

  // destroy is what unmounts or hides the window's body.
  onMinimize(id: string, destroy: () => void): void {
    this.tracked.set(id, { id, minimizedAt: this.now(), destroy });
    this.start();
  }

  onRestore(id: string): void {
    this.tracked.delete(id);
    this.stopIfEmpty();
  }

  dispose(): void {
    this.tracked.clear();
    this.stopIfEmpty();
  }

  private expired(afterMs: number): Tracked[] {
    const now = this.now();
    return Array.from(this.tracked.values())
      .filter((w) => now - w.minimizedAt > afterMs)
      .sort((a, b) => a.minimizedAt - b.minimizedAt);
  }

  private cleanupOldest(count = 1): void {
    const sorted = Array.from(this.tracked.values()).sort((a, b) => a.minimizedAt - b.minimizedAt);
    for (let i = 0; i < Math.min(count, sorted.length); i++) {
      sorted[i].destroy();
      this.tracked.delete(sorted[i].id);
    }
    this.stopIfEmpty();
  }

  private start(): void {
    if (this.interval) return;
    this.interval = setInterval(() => this.tick(), MEMORY_CHECK_INTERVAL);
  }

  private tick(): void {
    const maxAllowed = deviceMaxMinimized();
    const count = this.tracked.size;

    // 1. Memory pressure: immediately destroy the oldest.
    if (underMemoryPressure() && count > 0) {
      this.cleanupOldest(1);
      return;
    }

    // 2. Absolute cap: destroy anything past the hard grace period.
    const maxExpired = this.expired(MAX_GRACE_PERIOD_MS);
    if (maxExpired.length > 0) {
      for (const w of maxExpired) {
        w.destroy();
        this.tracked.delete(w.id);
      }
      this.stopIfEmpty();
      return;
    }

    // 3. Over the device limit: trim the oldest past the soft grace period.
    if (count > maxAllowed) {
      const expired = this.expired(GRACE_PERIOD_MS);
      const toRemove = Math.min(expired.length, count - maxAllowed);
      for (let i = 0; i < toRemove; i++) {
        expired[i].destroy();
        this.tracked.delete(expired[i].id);
      }
      this.stopIfEmpty();
    }
  }

  private stopIfEmpty(): void {
    if (this.tracked.size === 0 && this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}
