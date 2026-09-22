<!--
  Prism Window Manager (@prism-wm), Vue 3 adapter
  Copyright (C) 2023-2026 Banshee Technologies S.L.
  Authors: Claudio González, Néstor González
  https://www.banshee.pro/

  Extracted from HomeDock OS: https://github.com/BansheeTech/HomeDockOS

  @license AGPL-3.0-or-later

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program. If not, see <https://www.gnu.org/licenses/>.

  SPDX-License-Identifier: AGPL-3.0-or-later
-->
<template>
  <div
    v-show="!window.isMinimized || minimizing"
    class="pwm-window"
    :class="[
      cls.window,
      isActive ? cls.windowActive : cls.windowInactive,
      {
        'pwm-active': isActive,
        'pwm-dialog': window.kind === 'dialog',
        'pwm-maximized': window.isMaximized,
        'pwm-fullscreen-mobile': ctx.isMobile.value && window.kind !== 'dialog',
        'pwm-dragging': dragging,
        'pwm-resizing': resizing,
        'pwm-closing': window.isClosing,
        'pwm-unsnapping': unsnapping,
        'pwm-minimizing': minimizing,
        'pwm-restoring': restoring,
        'pwm-opening': opening,
        [`pwm-${ctx.appearance.value}`]: true,
      },
    ]"
    ref="rootEl"
    :data-pwm-window="window.id"
    :data-pwm-blocked="isBlocked ? '' : undefined"
    :data-pwm-autoheight="window.autoHeight ? '' : undefined"
    :style="[windowStyle, flipVars]"
    @mousedown="onRootMouseDown"
  >
    <div class="pwm-window-header" :class="cls.titleBar" :inert="isBlocked || undefined">
      <!-- On the strip, not the header: there, pressing ✕ would start a drag. -->
      <div class="pwm-window-header-draggable" @pointerdown="onHeaderPointerDown" @dblclick="onHeaderDblClick">
        <div class="pwm-window-icon-container" :class="isActive ? cls.iconContainerActive : cls.iconContainer">
          <slot name="icon" :window="window">
            <svg class="pwm-fallback-icon" data-glyph="window" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M21.53 5.15a.99.99 0 0 0-.97-.04l-10 5a1 1 0 0 0-.55.89v10a1 1 0 0 0 1 1c.15 0 .31-.04.45-.11l10-5a1 1 0 0 0 .55-.89V6c0-.35-.18-.67-.47-.85ZM20 15.38l-8 4v-7.76l8-4z" />
              <path d="m16.55 3.11l-10 5A1 1 0 0 0 6 9v10h2V9.62l9.45-4.72l-.89-1.79Z" />
              <path d="m12.55 1.11l-10 5A1 1 0 0 0 2 7v10h2V7.62l9.45-4.73l-.89-1.79Z" />
            </svg>
          </slot>
        </div>
        <span class="pwm-window-title" :class="isActive ? cls.titleActive : cls.title">
          {{ window.title }}
          <slot name="titleBarExtra" :window="window" />
        </span>
      </div>

      <div class="pwm-window-controls">
        <!-- Ordered in the DOM, not with CSS `order`: -->
        <template v-for="kind in controlOrder" :key="kind">
          <button v-if="kind === 'minimize' && caps.minimizable" type="button" class="pwm-window-control pwm-minimize" :class="cls.control" :title="ctx.labels.minimize" aria-label="minimize" @click.stop="onMinimize">
            <slot name="minimize-icon" :window="window">
              <svg class="pwm-fallback-icon" data-glyph="minimize" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                <path d="M5 12h14" />
              </svg>
            </slot>
          </button>
          <button v-else-if="kind === 'maximize' && !ctx.isMobile.value && caps.maximizable" type="button" class="pwm-window-control pwm-maximize" :class="cls.control" :title="window.isMaximized ? ctx.labels.restore : ctx.labels.maximize" aria-label="maximize" @click.stop="onToggleMaximize">
            <!-- Scoped so hosts can swap maximize/restore glyphs per window. -->
            <slot name="maximize-icon" :window="window">
              <svg class="pwm-fallback-icon" :data-glyph="window.isMaximized ? 'restore' : 'maximize'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true">
                <template v-if="window.isMaximized">
                  <path d="M8.5 8.5V6.5A1.5 1.5 0 0 1 10 5h7.5A1.5 1.5 0 0 1 19 6.5V14a1.5 1.5 0 0 1-1.5 1.5h-2" />
                  <rect x="5" y="8.5" width="10.5" height="10.5" rx="1.5" />
                  <path d="M5 12h10.5" />
                </template>
                <template v-else>
                  <rect x="5" y="5" width="14" height="14" rx="1.5" />
                  <path d="M5 9h14" />
                </template>
              </svg>
            </slot>
          </button>
          <button v-else-if="kind === 'close' && caps.closeable" type="button" class="pwm-window-control pwm-close" :class="cls.closeControl" :title="ctx.labels.close" aria-label="close" @click.stop="onClose">
            <slot name="close-icon" :window="window">
              <svg class="pwm-fallback-icon" data-glyph="close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </slot>
          </button>
        </template>
      </div>
    </div>

    <div class="pwm-window-body" :class="cls.body" :inert="isBlocked || undefined">
      <!-- The host paints this one itself (a <PrismDialog> slot). -->
      <div v-if="window.external" class="pwm-window-slot" :data-pwm-slot="window.id" />
      <component :is="resolved" v-else-if="resolved && keepAlive" v-bind="window.data" />
      <!-- Default rather than an empty body: -->
      <slot v-else name="loading">
        <div class="pwm-window-loading">
          <svg class="pwm-loading-icon" viewBox="0 0 24 24" fill="none" role="status" aria-label="Loading">
            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3c4.97 0 9 4.03 9 9" />
          </svg>
        </div>
      </slot>
    </div>

    <template v-if="!window.isMaximized && !ctx.isMobile.value && caps.resizable">
      <div v-for="dir in RESIZE_DIRS" :key="dir" class="pwm-resize-handle" :class="`pwm-resize-${dir}`" @pointerdown.stop="(e: PointerEvent) => onResizeStart(dir, e)"></div>
    </template>
  </div>
</template>

<script lang="ts" setup>
import { computed, inject, markRaw, onMounted, onUnmounted, ref, watch } from "vue";
import { computeResize, detectSnapEdge, centerDialog, computeUnsnapFlip, prefersReducedMotion, PWM_MINIMIZE_ANIMATION_MS, PWM_OPEN_ANIMATION_MS, PWM_UNSNAP_ANIMATION_MS, UNSNAP_DRAG_THRESHOLD, type ResizeDirection, type UnsnapFlip, type WindowState } from "@prism-wm/core";
import { PRISM_CONTEXT, resolveCapabilities } from "./context";

// No withDefaults:
const props = withDefaults(
  defineProps<{
    window: WindowState;
    isActive: boolean;
    // A window-modal dialog belongs to this window: block and inert it.
    isBlocked?: boolean;
  }>(),
  { isBlocked: false },
);

const injected = inject(PRISM_CONTEXT);
if (!injected) {
  throw new Error("PrismWindow must be used inside PrismWindowManager");
}
// Rebound to a const so TS keeps the narrowing inside the handler closures.
const ctx = injected;

// Host theme classes, unwrapped here so the template stays terse.
const cls = computed(() => ctx.classes.value);

// Re-centres as the height changes; stops once the user drags.
const rootEl = ref<HTMLElement | null>(null);
const userMoved = ref(false);
let sizeObserver: ResizeObserver | null = null;

function recentre(h: number) {
  // Reported first: the drag clamp needs the true height, not the placeholder.
  ctx.store.setMeasuredHeight(props.window.id, h);
  if (userMoved.value) return;
  // Same centring rule as the store used, now with the measured height.
  const owner = props.window.modality === "window" && props.window.ownerId ? ctx.store.getWindowById(props.window.ownerId) : null;
  const at = centerDialog(props.window.width, h, { width: window.innerWidth, height: window.innerHeight }, owner);
  ctx.store.updateWindowPosition(props.window.id, at.x, at.y);
}

onMounted(() => {
  if (!props.window.autoHeight || !rootEl.value) return;
  // onMounted runs before paint, so the correction lands in the same frame.
  recentre(rootEl.value.offsetHeight);

  if (typeof ResizeObserver === "undefined") return;
  sizeObserver = new ResizeObserver(() => {
    const h = rootEl.value?.offsetHeight;
    if (h) recentre(h);
  });
  sizeObserver.observe(rootEl.value);
});

onUnmounted(() => {
  sizeObserver?.disconnect();
  sizeObserver = null;
});

const RESIZE_DIRS: ResizeDirection[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

const DOUBLE_CLICK_THRESHOLD = 300;

// Which control sits where, per appearance. See PrismAppearance in core.
const controlOrder = computed(() => (ctx.appearance.value === "cupertino" ? (["close", "minimize", "maximize"] as const) : (["minimize", "maximize", "close"] as const)));

const caps = computed(() => {
  // A dialog is a window with fewer verbs:
  const c = resolveCapabilities(ctx.resolveConfig(props.window));
  if (props.window.kind !== "dialog") return c;
  return { ...c, resizable: false, minimizable: false, maximizable: false };
});

const resolved = computed(() => {
  const c = ctx.resolveComponent(props.window);
  return c ? markRaw(c as object) : null;
});

// ---- Entrance animation ------------------------------------------------
// A class the adapter drops after one run: on .pwm-window it would replay.
const opening = ref(!prefersReducedMotion());
const openTimer = opening.value ? setTimeout(() => (opening.value = false), PWM_OPEN_ANIMATION_MS) : null;

// ---- Minimize / restore animation --------------------------------------
const minimizing = ref(false);
const restoring = ref(false);
let minimizeTimer: ReturnType<typeof setTimeout> | null = null;

watch(
  () => props.window.isMinimized,
  (min) => {
    if (minimizeTimer) clearTimeout(minimizeTimer);
    if (prefersReducedMotion()) {
      minimizing.value = false;
      restoring.value = false;
      return;
    }
    minimizing.value = min;
    restoring.value = !min;
    minimizeTimer = setTimeout(() => {
      minimizeTimer = null;
      minimizing.value = false;
      restoring.value = false;
    }, PWM_MINIMIZE_ANIMATION_MS);
  },
);

// ---- RAM manager: keep-alive gate for the body only --------------------
const keepAlive = ref(true);
watch(
  () => props.window.isMinimized,
  (min) => {
    if (!ctx.ram) return;
    if (min) ctx.ram.onMinimize(props.window.id, () => (keepAlive.value = false));
    else {
      ctx.ram.onRestore(props.window.id);
      keepAlive.value = true;
    }
  },
  { immediate: true },
);

// ---- Geometry / style --------------------------------------------------
const viewport = () => ({
  width: typeof window !== "undefined" ? window.innerWidth : 1920,
  height: typeof window !== "undefined" ? window.innerHeight : 1080,
});

// Read by the pwm-unsnap keyframes and inherited by the body for its counter-scale.
const flipVars = computed(() =>
  flip.value
    ? {
        "--pwm-unsnap-from": flip.value.transform,
        "--pwm-unsnap-from-content": flip.value.contentTransform,
      }
    : {},
);

const windowStyle = computed(() => {
  // Dialogs keep their centred bounds on mobile; only plain windows go fullscreen.
  if (ctx.isMobile.value && props.window.kind !== "dialog") {
    return {
      top: "0",
      left: "0",
      width: "100vw",
      height: `calc(100% - ${ctx.taskbarHeight.value}px)`,
      zIndex: props.window.zIndex,
    };
  }
  if (props.window.isMaximized) {
    return {
      top: "0",
      left: "0",
      width: "100%",
      height: `calc(100% - ${ctx.taskbarHeight.value}px)`,
      zIndex: props.window.zIndex,
    };
  }
  return {
    top: `${props.window.y}px`,
    left: `${props.window.x}px`,
    width: `${props.window.width}px`,
    // Omitted when the content decides: CSS caps it instead.
    height: props.window.autoHeight ? undefined : `${props.window.height}px`,
    zIndex: props.window.zIndex,
  };
});

// ---- Focus / controls --------------------------------------------------
function onFocus() {
  if (!props.isActive) ctx.store.focusWindow(props.window.id);
}

// Focus on mousedown, minus the controls: hitting ✕ used to raise the window.
function onRootMouseDown(e: MouseEvent) {
  // Blocked by a window-modal dialog: the click landed on its backdrop.
  if (props.isBlocked) {
    ctx.store.dismissDialogFor(props.window.id);
    return;
  }
  if ((e.target as HTMLElement).closest(".pwm-window-controls")) return;
  onFocus();
}
function onMinimize() {
  ctx.store.minimizeWindow(props.window.id);
}
function onToggleMaximize() {
  ctx.store.toggleMaximize(props.window.id);
}
function onClose() {
  void ctx.requestClose(props.window.id);
}

// ---- Drag ----------------------------------------------------------------
const dragging = ref(false);
let lastClick = 0;
let unsnapTimer: ReturnType<typeof setTimeout> | null = null;
const unsnapping = ref(false);
const flip = ref<UnsnapFlip | null>(null);

function capturePointer(el: Element, pointerId: number) {
  try {
    el.setPointerCapture?.(pointerId);
  } catch {
    /* no active pointer */
  }
}

function releasePointer(el: Element, pointerId: number) {
  try {
    el.releasePointerCapture?.(pointerId);
  } catch {
    /* already released */
  }
}

function onHeaderPointerDown(e: PointerEvent) {
  if (props.window.isMaximized || ctx.isMobile.value || e.button !== 0) return;

  const now = Date.now();
  if (now - lastClick < DOUBLE_CLICK_THRESHOLD) {
    lastClick = 0;
    return; // second click of a double-click → let dblclick handle it
  }
  lastClick = now;

  onFocus();

  const strip = e.currentTarget as HTMLElement;

  let initialX = props.window.x;
  let initialY = props.window.y;

  const startX = e.clientX;
  const startY = e.clientY;

  // A snapped window unsnaps only once the pointer travels, not on a bare click.
  let pendingUnsnap = !!props.window.isSnapped;
  dragging.value = !pendingUnsnap;

  const move = (ev: PointerEvent) => {
    if (pendingUnsnap) {
      if (Math.abs(ev.clientX - startX) < UNSNAP_DRAG_THRESHOLD && Math.abs(ev.clientY - startY) < UNSNAP_DRAG_THRESHOLD) {
        return;
      }
      pendingUnsnap = false;

      const pre = ctx.store.getPreSnapBounds(props.window.id);
      if (pre) {
        // The rect it currently occupies, before the store drops the snap.
        const from = {
          x: props.window.x,
          y: props.window.y,
          width: props.window.width,
          height: props.window.height,
        };
        const pct = (startX - props.window.x) / props.window.width;
        initialX = startX - pre.width * pct;
        initialY = startY - 20;
        // Where it lands this frame: the same position committed just below.
        flip.value = computeUnsnapFlip(from, {
          x: initialX + (ev.clientX - startX),
          y: initialY + (ev.clientY - startY),
          width: pre.width,
          height: pre.height,
        });
        ctx.store.unSnapWindow(props.window.id);
      }
      // Position tracks the pointer; transitioning it too makes the window rubber-band.
      dragging.value = true;
      unsnapping.value = true;
      unsnapTimer = setTimeout(() => {
        unsnapTimer = null;
        unsnapping.value = false;
        flip.value = null;
      }, PWM_UNSNAP_ANIMATION_MS);
    }

    // Once dragged, the position is the user's: stop re-centring.
    userMoved.value = true;
    ctx.store.updateWindowPosition(props.window.id, initialX + (ev.clientX - startX), initialY + (ev.clientY - startY));
    if (!ctx.isMobile.value && caps.value.maximizable) {
      ctx.store.setSnapPreview(detectSnapEdge(ev.clientX, viewport().width));
    }
  };
  const up = () => {
    if (ctx.store.snapPreview && !ctx.isMobile.value && caps.value.maximizable) {
      ctx.store.snapWindow(props.window.id, ctx.store.snapPreview, ctx.taskbarHeight.value);
    }
    ctx.store.clearSnapPreview();
    if (unsnapTimer) {
      clearTimeout(unsnapTimer);
      unsnapTimer = null;
    }
    unsnapping.value = false;
    flip.value = null;
    dragging.value = false;
    releasePointer(strip, e.pointerId);
    strip.removeEventListener("pointermove", move);
    strip.removeEventListener("pointerup", up);
    strip.removeEventListener("pointercancel", up);
  };
  capturePointer(strip, e.pointerId);
  strip.addEventListener("pointermove", move);
  strip.addEventListener("pointerup", up);
  strip.addEventListener("pointercancel", up);
  e.preventDefault();
}

function onHeaderDblClick(e: MouseEvent) {
  if (caps.value.maximizable) onToggleMaximize();
  e.preventDefault();
  e.stopPropagation();
}

// ---- Resize (maths in core) ----------------------------------------------
const resizing = ref(false);

function onResizeStart(direction: ResizeDirection, e: PointerEvent) {
  if (props.window.isMaximized) return;

  const handle = e.currentTarget as HTMLElement;

  const startX = e.clientX;
  const startY = e.clientY;
  const initialWidth = props.window.width;
  const initialHeight = props.window.height;
  const initialX = props.window.x;
  const initialY = props.window.y;

  onFocus();
  resizing.value = true;

  const move = (ev: PointerEvent) => {
    const c = caps.value;
    const b = computeResize({
      direction,
      deltaX: ev.clientX - startX,
      deltaY: ev.clientY - startY,
      initialX,
      initialY,
      initialWidth,
      initialHeight,
      minWidth: c.minWidth,
      minHeight: c.minHeight,
      maxWidth: c.maxWidth,
      maxHeight: c.maxHeight,
    });
    ctx.store.updateWindowSize(props.window.id, b.width, b.height);
    if (b.x !== initialX || b.y !== initialY) {
      ctx.store.updateWindowPosition(props.window.id, b.x, b.y);
    }
  };
  const up = () => {
    resizing.value = false;
    releasePointer(handle, e.pointerId);
    handle.removeEventListener("pointermove", move);
    handle.removeEventListener("pointerup", up);
    handle.removeEventListener("pointercancel", up);
  };
  capturePointer(handle, e.pointerId);
  handle.addEventListener("pointermove", move);
  handle.addEventListener("pointerup", up);
  handle.addEventListener("pointercancel", up);
  e.preventDefault();
  e.stopPropagation();
}

onUnmounted(() => {
  if (openTimer) clearTimeout(openTimer);
  if (unsnapTimer) clearTimeout(unsnapTimer);
  if (minimizeTimer) clearTimeout(minimizeTimer);
  if (ctx.ram) ctx.ram.onRestore(props.window.id);
});
</script>
