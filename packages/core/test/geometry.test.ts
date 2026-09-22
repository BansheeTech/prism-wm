/*
 * Prism Window Manager (@prism-wm), core geometry tests
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
 * These lock in the exact numeric behaviour of the drag, resize and clamp
 * maths. Every adapter runs on it, so a change here moves all three at once.
 */
import { describe, it, expect } from "vitest";
import { detectSnapEdge, computeSnapBounds, clampPosition, clampSize, computeResize, computeUnsnapFlip, centerDialog, clampDialogPosition } from "../src/geometry.js";

describe("detectSnapEdge", () => {
  it("snaps left within threshold", () => {
    expect(detectSnapEdge(0, 1000)).toBe("left");
    expect(detectSnapEdge(20, 1000)).toBe("left");
  });
  it("snaps right within threshold", () => {
    expect(detectSnapEdge(1000, 1000)).toBe("right");
    expect(detectSnapEdge(980, 1000)).toBe("right");
  });
  it("returns null in the middle", () => {
    expect(detectSnapEdge(21, 1000)).toBeNull();
    expect(detectSnapEdge(979, 1000)).toBeNull();
    expect(detectSnapEdge(500, 1000)).toBeNull();
  });
  it("honours a custom threshold", () => {
    expect(detectSnapEdge(30, 1000, 40)).toBe("left");
    expect(detectSnapEdge(30, 1000, 20)).toBeNull();
  });
});

describe("computeSnapBounds", () => {
  const vp = { width: 1000, height: 800 };
  it("computes left half minus taskbar", () => {
    expect(computeSnapBounds("left", vp, 48)).toEqual({
      x: 0,
      y: 0,
      width: 500,
      height: 752,
    });
  });
  it("computes right half", () => {
    expect(computeSnapBounds("right", vp, 48)).toEqual({
      x: 500,
      y: 0,
      width: 500,
      height: 752,
    });
  });
});

describe("clampPosition", () => {
  const vp = { width: 1000, height: 800 };
  it("keeps 100px reachable off the left/top", () => {
    expect(clampPosition(-500, -50, 300, vp)).toEqual({ x: -200, y: 0 });
  });
  it("keeps 100px reachable off the right/bottom", () => {
    expect(clampPosition(2000, 2000, 300, vp)).toEqual({ x: 900, y: 700 });
  });
  it("passes through an in-bounds position", () => {
    expect(clampPosition(50, 60, 300, vp)).toEqual({ x: 50, y: 60 });
  });
});

describe("clampSize", () => {
  it("applies default minimums", () => {
    expect(clampSize(100, 100)).toEqual({ width: 400, height: 300 });
  });
  it("passes larger sizes through", () => {
    expect(clampSize(500, 500)).toEqual({ width: 500, height: 500 });
  });
  it("applies custom minimums", () => {
    expect(clampSize(500, 500, 600, 700)).toEqual({ width: 600, height: 700 });
  });
});

describe("computeResize", () => {
  const base = {
    initialX: 100,
    initialY: 100,
    initialWidth: 500,
    initialHeight: 400,
  };

  it("east grows width only", () => {
    expect(computeResize({ ...base, direction: "e", deltaX: 50, deltaY: 0 })).toEqual({
      x: 100,
      y: 100,
      width: 550,
      height: 400,
    });
  });
  it("west grows width and moves x", () => {
    expect(computeResize({ ...base, direction: "w", deltaX: 50, deltaY: 0 })).toEqual({
      x: 150,
      y: 100,
      width: 450,
      height: 400,
    });
  });
  it("south grows height only", () => {
    expect(computeResize({ ...base, direction: "s", deltaX: 0, deltaY: 50 })).toEqual({
      x: 100,
      y: 100,
      width: 500,
      height: 450,
    });
  });
  it("north grows height and moves y", () => {
    expect(computeResize({ ...base, direction: "n", deltaX: 0, deltaY: 50 })).toEqual({
      x: 100,
      y: 150,
      width: 500,
      height: 350,
    });
  });
  it("south-east grows both", () => {
    expect(computeResize({ ...base, direction: "se", deltaX: 50, deltaY: 50 })).toEqual({
      x: 100,
      y: 100,
      width: 550,
      height: 450,
    });
  });
  it("north-west grows both and moves origin", () => {
    expect(computeResize({ ...base, direction: "nw", deltaX: 50, deltaY: 50 })).toEqual({
      x: 150,
      y: 150,
      width: 450,
      height: 350,
    });
  });

  it("pins the opposite edge on min-width clamp (west)", () => {
    const r = computeResize({ ...base, direction: "w", deltaX: 200, deltaY: 0 });
    expect(r).toEqual({ x: 200, y: 100, width: 400, height: 400 });
  });
  it("clamps to max-width (east) without moving x", () => {
    const r = computeResize({
      ...base,
      direction: "e",
      deltaX: 200,
      deltaY: 0,
      maxWidth: 600,
    });
    expect(r).toEqual({ x: 100, y: 100, width: 600, height: 400 });
  });
  it("clamps to max-width (west) and pins the right edge", () => {
    const r = computeResize({
      ...base,
      direction: "w",
      deltaX: -200,
      deltaY: 0,
      maxWidth: 600,
    });
    expect(r).toEqual({ x: 0, y: 100, width: 600, height: 400 });
  });
  it("pins the opposite edge on min-height clamp (north)", () => {
    const r = computeResize({ ...base, direction: "n", deltaX: 0, deltaY: 200 });
    expect(r).toEqual({ x: 100, y: 200, width: 500, height: 300 });
  });
});

describe("computeUnsnapFlip", () => {
  const snapped = { x: 0, y: 0, width: 700, height: 900 };
  const floating = { x: 250, y: 120, width: 600, height: 400 };

  it("maps the target rect back onto the one it is leaving", () => {
    const flip = computeUnsnapFlip(snapped, floating)!;
    expect(flip.transform).toBe("translate(-250px, -120px) scale(1.1666666666666667, 2.25)");
  });

  it("counter-scales the content by the exact inverse", () => {
    const flip = computeUnsnapFlip(snapped, floating)!;
    expect(flip.contentTransform).toBe(`scale(${600 / 700}, ${400 / 900})`);
  });

  it("is the identity when nothing actually moves", () => {
    const flip = computeUnsnapFlip(floating, floating)!;
    expect(flip.transform).toBe("translate(0px, 0px) scale(1, 1)");
    expect(flip.contentTransform).toBe("scale(1, 1)");
  });

  it("returns null rather than a degenerate transform", () => {
    expect(computeUnsnapFlip(snapped, { ...floating, width: 0 })).toBeNull();
    expect(computeUnsnapFlip(snapped, { ...floating, height: -10 })).toBeNull();
    expect(computeUnsnapFlip({ ...snapped, x: Number.NaN }, floating)).toBeNull();
  });
});

describe("clampDialogPosition", () => {
  const vp = { width: 1000, height: 800 };

  it("keeps the whole dialog on screen, unlike a window", () => {
    expect(clampDialogPosition(-500, -500, 400, 200, vp)).toEqual({ x: 16, y: 16 });
    expect(clampDialogPosition(5000, 5000, 400, 200, vp)).toEqual({
      x: 1000 - 400 - 16,
      y: 800 - 200 - 16,
    });
  });

  it("passes an in-bounds position through", () => {
    expect(clampDialogPosition(300, 300, 400, 200, vp)).toEqual({ x: 300, y: 300 });
  });

  it("pins to the margin rather than inverting when it is bigger than the viewport", () => {
    expect(clampDialogPosition(0, 0, 2000, 2000, vp)).toEqual({ x: 16, y: 16 });
  });
});

describe("centerDialog", () => {
  const vp = { width: 1000, height: 800 };

  it("centres on the viewport with no owner", () => {
    expect(centerDialog(400, 200, vp)).toEqual({ x: 300, y: 300 });
  });

  it("centres over its owner window when it has one", () => {
    const owner = { x: 100, y: 80, width: 600, height: 400 };
    expect(centerDialog(400, 200, vp, owner)).toEqual({ x: 200, y: 180 });
  });

  it("stays on screen when the owner sits against an edge", () => {
    const owner = { x: 900, y: 700, width: 600, height: 400 };
    const at = centerDialog(400, 200, vp, owner);
    expect(at.x).toBe(1000 - 400 - 16);
    expect(at.y).toBe(800 - 200 - 16);
  });
});
