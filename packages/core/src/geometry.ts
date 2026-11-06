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

// Pure geometry: no `window.*`, no reactivity, no side effects.

import type { SnapSide, Viewport } from "./types.js";

export const SNAP_EDGE_THRESHOLD = 20;

export const SNAP_VERTICAL_THRESHOLD = 2;
export const DEFAULT_MIN_WIDTH = 400;
export const DEFAULT_MIN_HEIGHT = 300;

// How much of a window must stay on screen when dragged off an edge, in px.
export const KEEP_ON_SCREEN = 100;

// At 0 a plain click unsnaps, which reads as a random jump.
export const UNSNAP_DRAG_THRESHOLD = 4;

// Must not be shorter than the .pwm-unsnapping transition in the stylesheet.
export const PWM_UNSNAP_ANIMATION_MS = 200;

// Window enter and exit timings.

// Also used for restore-from-minimized.
export const PWM_OPEN_ANIMATION_MS = 200;

// How long a closing window stays mounted so its exit animation can play.
export const PWM_CLOSE_ANIMATION_MS = 200;

// How long a window stays visible while it animates in or out of minimized.
export const PWM_MINIMIZE_ANIMATION_MS = 200;

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

// The two transforms that drive one un-snap morph. See computeUnsnapFlip.
export interface UnsnapFlip {
  // Goes on the window: makes it paint where it was before the un-snap.
  transform: string;
  // Goes on the body: cancels the window's scale so content is not distorted.
  contentTransform: string;
}

// FLIP for the un-snap: geometry jumps, the transform paints it where it was.
export function computeUnsnapFlip(from: Bounds, to: Bounds): UnsnapFlip | null {
  if (to.width <= 0 || to.height <= 0) return null;

  const sx = from.width / to.width;
  const sy = from.height / to.height;
  const dx = from.x - to.x;
  const dy = from.y - to.y;
  if (![sx, sy, dx, dy].every(Number.isFinite)) return null;
  if (sx <= 0 || sy <= 0) return null;

  return {
    transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`,
    // The body counter-scales so text keeps its true size through the morph.
    contentTransform: `scale(${1 / sx}, ${1 / sy})`,
  };
}

// Any combination of the cardinal letters.
export type ResizeDirection = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

// Which screen edge the cursor is hovering, if any, for the snap preview.
export function detectSnapEdge(cursorX: number, cursorY: number, viewport: Viewport, taskbarHeight: number = 0, threshold: number = SNAP_EDGE_THRESHOLD, verticalThreshold: number = SNAP_VERTICAL_THRESHOLD): SnapSide {
  const left = cursorX <= threshold;
  const right = cursorX >= viewport.width - threshold;
  const top = cursorY <= verticalThreshold;
  const bottom = cursorY >= viewport.height - taskbarHeight - verticalThreshold;
  if (top && left) return "top-left";
  if (top && right) return "top-right";
  if (bottom && left) return "bottom-left";
  if (bottom && right) return "bottom-right";
  if (left) return "left";
  if (right) return "right";
  if (top) return "top";
  return null;
}

// Half, quarter or full-screen bounds for a snap.
export function computeSnapBounds(side: NonNullable<SnapSide>, viewport: Viewport, taskbarHeight: number): Bounds {
  const availableHeight = viewport.height - taskbarHeight;
  if (side === "top") return { x: 0, y: 0, width: viewport.width, height: availableHeight };
  const halfWidth = viewport.width / 2;
  const x = side === "right" || side.endsWith("-right") ? halfWidth : 0;
  if (side === "left" || side === "right") return { x, y: 0, width: halfWidth, height: availableHeight };
  const halfHeight = availableHeight / 2;
  return { x, y: side.startsWith("bottom") ? halfHeight : 0, width: halfWidth, height: halfHeight };
}

export function computeSnapPreviewStyle(side: NonNullable<SnapSide>, taskbarHeight: number): { top: string; height: string } {
  const available = `(100% - ${taskbarHeight}px)`;
  if (side === "left" || side === "right" || side === "top") return { top: "0", height: `calc${available}` };
  const half = `calc(${available} / 2)`;
  return { top: side.startsWith("bottom") ? half : "0", height: half };
}

export function computeWindowBounds(win: Bounds & { isMaximized?: boolean }, viewport: Viewport, taskbarHeight: number, fullscreen: boolean = false): Bounds {
  if (fullscreen || win.isMaximized) return computeSnapBounds("top", viewport, taskbarHeight);
  return { x: win.x, y: win.y, width: win.width, height: win.height };
}

export function computeMinimizeTransform(from: Bounds, target: Bounds): string | null {
  if (from.width <= 0 || from.height <= 0 || target.width <= 0 || target.height <= 0) return null;
  const scale = Math.min(1, target.width / from.width, target.height / from.height);
  const dx = target.x + target.width / 2 - from.x - (from.width * scale) / 2;
  const dy = target.y + target.height / 2 - from.y - (from.height * scale) / 2;
  if (![scale, dx, dy].every(Number.isFinite)) return null;
  return `translate(${dx}px, ${dy}px) scale(${scale})`;
}

// Clamp a position so at least KEEP_ON_SCREEN px stay reachable.
export function clampPosition(x: number, y: number, width: number, viewport: Viewport): { x: number; y: number } {
  const minX = -(width - KEEP_ON_SCREEN);
  const maxX = viewport.width - KEEP_ON_SCREEN;
  const minY = 0;
  const maxY = viewport.height - KEEP_ON_SCREEN;
  return {
    x: Math.max(minX, Math.min(maxX, x)),
    y: Math.max(minY, Math.min(maxY, y)),
  };
}

// How close to the viewport edge a dialog may get.
export const DIALOG_BOUNDARY_MARGIN = 16;

// Keep a dialog wholly on screen.
export function clampDialogPosition(x: number, y: number, width: number, height: number, viewport: Viewport, margin: number = DIALOG_BOUNDARY_MARGIN): { x: number; y: number } {
  // max never below min, so an oversized dialog pins top-left instead of inverting.
  const maxX = Math.max(margin, viewport.width - width - margin);
  const maxY = Math.max(margin, viewport.height - height - margin);
  return {
    x: Math.max(margin, Math.min(maxX, x)),
    y: Math.max(margin, Math.min(maxY, y)),
  };
}

// Over its owner window when it has one, over the viewport otherwise.
export function centerDialog(width: number, height: number, viewport: Viewport, owner?: Bounds | null): { x: number; y: number } {
  const box = owner ?? { x: 0, y: 0, width: viewport.width, height: viewport.height };
  return clampDialogPosition(Math.round(box.x + (box.width - width) / 2), Math.round(box.y + (box.height - height) / 2), width, height, viewport);
}

// Clamp a size to the minimums.
export function clampSize(width: number, height: number, minWidth: number = DEFAULT_MIN_WIDTH, minHeight: number = DEFAULT_MIN_HEIGHT): { width: number; height: number } {
  return {
    width: Math.max(minWidth, width),
    height: Math.max(minHeight, height),
  };
}

export interface ResizeInput {
  direction: ResizeDirection;
  deltaX: number;
  deltaY: number;
  initialX: number;
  initialY: number;
  initialWidth: number;
  initialHeight: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
}

// New bounds while resizing, clamped, with the opposite edge pinned.
export function computeResize(input: ResizeInput): Bounds {
  const { direction, deltaX, deltaY, initialX, initialY, initialWidth, initialHeight } = input;

  const minWidth = input.minWidth ?? DEFAULT_MIN_WIDTH;
  const minHeight = input.minHeight ?? DEFAULT_MIN_HEIGHT;
  const { maxWidth, maxHeight } = input;

  let newWidth = initialWidth;
  let newHeight = initialHeight;
  let newX = initialX;
  let newY = initialY;

  if (direction.includes("e")) {
    newWidth = initialWidth + deltaX;
  }
  if (direction.includes("w")) {
    newWidth = initialWidth - deltaX;
    newX = initialX + deltaX;
  }
  if (direction.includes("s")) {
    newHeight = initialHeight + deltaY;
  }
  if (direction.includes("n")) {
    newHeight = initialHeight - deltaY;
    newY = initialY + deltaY;
  }

  if (newWidth < minWidth) {
    newWidth = minWidth;
    if (direction.includes("w")) {
      newX = initialX + initialWidth - minWidth;
    }
  }

  if (maxWidth && newWidth > maxWidth) {
    newWidth = maxWidth;
    if (direction.includes("w")) {
      newX = initialX + initialWidth - maxWidth;
    }
  }

  if (newHeight < minHeight) {
    newHeight = minHeight;
    if (direction.includes("n")) {
      newY = initialY + initialHeight - minHeight;
    }
  }

  if (maxHeight && newHeight > maxHeight) {
    newHeight = maxHeight;
    if (direction.includes("n")) {
      newY = initialY + initialHeight - maxHeight;
    }
  }

  return { x: newX, y: newY, width: newWidth, height: newHeight };
}
