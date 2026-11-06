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

export interface SpringConfig {
  stiffness: number;
  damping: number;
}

export interface SpringState {
  value: number;
  velocity: number;
}

export const PWM_WOBBLE_SPRING: SpringConfig = { stiffness: 600, damping: 18 };
export const PWM_BOUNCE_SPRING: SpringConfig = { stiffness: 700, damping: 16 };

const MAX_SUBSTEP_S = 0.004;
const MAX_FRAME_MS = 64;

export function stepSpring(state: SpringState, target: number, config: SpringConfig, dtSeconds: number): SpringState {
  let { value, velocity } = state;
  let remaining = Math.max(0, dtSeconds);
  while (remaining > 0) {
    const h = Math.min(MAX_SUBSTEP_S, remaining);
    velocity += (config.stiffness * (target - value) - config.damping * velocity) * h;
    value += velocity * h;
    remaining -= h;
  }
  return { value, velocity };
}

export interface WindowMotionConfig {
  maxTilt: number;
  maxLean: number;
  tiltPerVelocity: number;
  leanPerVelocity: number;
  velocitySmoothingMs: number;
  perspective: number;
  bounceVelocity: number;
  wobbleSpring: SpringConfig;
  bounceSpring: SpringConfig;
}

export const DEFAULT_WINDOW_MOTION: WindowMotionConfig = {
  maxTilt: 2.5,
  maxLean: 5,
  tiltPerVelocity: 1.5,
  leanPerVelocity: 3,
  velocitySmoothingMs: 45,
  perspective: 1400,
  bounceVelocity: 0.6,
  wobbleSpring: PWM_WOBBLE_SPRING,
  bounceSpring: PWM_BOUNCE_SPRING,
};

export interface WindowMotionPose {
  rotateX: number;
  rotateY: number;
  rotateZ: number;
  scale: number;
}

const ANGLE_EPSILON = 0.05;
const ANGLE_VELOCITY_EPSILON = 0.5;
const SCALE_EPSILON = 0.001;
const SCALE_VELOCITY_EPSILON = 0.02;
const POINTER_VELOCITY_EPSILON = 0.001;

function clamp(v: number, limit: number): number {
  return Math.max(-limit, Math.min(limit, v));
}

function round(v: number): number {
  return Math.round(v * 1000) / 1000;
}

export class WindowMotion {
  private readonly config: WindowMotionConfig;
  private rotateX: SpringState = { value: 0, velocity: 0 };
  private rotateY: SpringState = { value: 0, velocity: 0 };
  private rotateZ: SpringState = { value: 0, velocity: 0 };
  private scale: SpringState = { value: 1, velocity: 0 };
  private dragging = false;
  private pointer: { x: number; y: number } | null = null;
  private pendingDx = 0;
  private pendingDy = 0;
  private vx = 0;
  private vy = 0;
  private lastTime: number | null = null;

  constructor(config: Partial<WindowMotionConfig> = {}) {
    this.config = { ...DEFAULT_WINDOW_MOTION, ...config };
  }

  dragStart(x: number, y: number): void {
    this.dragging = true;
    this.pointer = { x, y };
    this.pendingDx = 0;
    this.pendingDy = 0;
  }

  dragMove(x: number, y: number): void {
    if (!this.dragging || !this.pointer) {
      this.dragStart(x, y);
      return;
    }
    this.pendingDx += x - this.pointer.x;
    this.pendingDy += y - this.pointer.y;
    this.pointer = { x, y };
  }

  dragEnd(): void {
    this.dragging = false;
    this.pointer = null;
    this.pendingDx = 0;
    this.pendingDy = 0;
  }

  bounce(): void {
    this.scale = { value: this.scale.value, velocity: this.scale.velocity + this.config.bounceVelocity };
  }

  get isDragging(): boolean {
    return this.dragging;
  }

  get pose(): WindowMotionPose {
    return { rotateX: this.rotateX.value, rotateY: this.rotateY.value, rotateZ: this.rotateZ.value, scale: this.scale.value };
  }

  get isAtRest(): boolean {
    const angles = [this.rotateX, this.rotateY, this.rotateZ];
    return (
      angles.every((s) => Math.abs(s.value) < ANGLE_EPSILON && Math.abs(s.velocity) < ANGLE_VELOCITY_EPSILON) &&
      Math.abs(this.scale.value - 1) < SCALE_EPSILON &&
      Math.abs(this.scale.velocity) < SCALE_VELOCITY_EPSILON &&
      Math.abs(this.vx) < POINTER_VELOCITY_EPSILON &&
      Math.abs(this.vy) < POINTER_VELOCITY_EPSILON &&
      this.pendingDx === 0 &&
      this.pendingDy === 0
    );
  }

  step(time: number): boolean {
    const dt = this.lastTime === null ? 0 : Math.max(0, Math.min(MAX_FRAME_MS, time - this.lastTime));
    this.lastTime = time;

    if (dt > 0) {
      const c = this.config;
      const ivx = this.dragging ? this.pendingDx / dt : 0;
      const ivy = this.dragging ? this.pendingDy / dt : 0;
      this.pendingDx = 0;
      this.pendingDy = 0;
      const alpha = 1 - Math.exp(-dt / c.velocitySmoothingMs);
      this.vx += (ivx - this.vx) * alpha;
      this.vy += (ivy - this.vy) * alpha;

      const seconds = dt / 1000;
      this.rotateZ = stepSpring(this.rotateZ, clamp(this.vx * c.tiltPerVelocity, c.maxTilt), c.wobbleSpring, seconds);
      this.rotateY = stepSpring(this.rotateY, clamp(this.vx * c.leanPerVelocity, c.maxLean), c.wobbleSpring, seconds);
      this.rotateX = stepSpring(this.rotateX, clamp(-this.vy * c.leanPerVelocity, c.maxLean), c.wobbleSpring, seconds);
      this.scale = stepSpring(this.scale, 1, c.bounceSpring, seconds);
    }

    if (this.isAtRest) {
      this.reset();
      return false;
    }
    return true;
  }

  get transform(): string | null {
    if (this.isAtRest) return null;
    const p = this.pose;
    return `perspective(${this.config.perspective}px) rotateX(${round(p.rotateX)}deg) rotateY(${round(p.rotateY)}deg) rotateZ(${round(p.rotateZ)}deg) scale(${round(p.scale)})`;
  }

  reset(): void {
    this.rotateX = { value: 0, velocity: 0 };
    this.rotateY = { value: 0, velocity: 0 };
    this.rotateZ = { value: 0, velocity: 0 };
    this.scale = { value: 1, velocity: 0 };
    this.vx = 0;
    this.vy = 0;
    this.pendingDx = 0;
    this.pendingDy = 0;
    this.lastTime = null;
  }
}
