<!--
  Prism Window Manager (@prism-wm), Svelte adapter
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
<script lang="ts">
  import { onDestroy, onMount, type ComponentType } from "svelte";
  import { computeResize, centerDialog, computeUnsnapFlip, detectSnapEdge, prefersReducedMotion, PWM_MINIMIZE_ANIMATION_MS, PWM_OPEN_ANIMATION_MS, PWM_UNSNAP_ANIMATION_MS, UNSNAP_DRAG_THRESHOLD, type ResizeDirection, type UnsnapFlip, type WindowState } from "@prism-wm/core";
  import { cx, EMPTY_CLASSES, getPrismContext, resolveCapabilities, type PrismClassMap } from "./context.js";
  import ControlGlyph from "./ControlGlyph.svelte";
  import LoadingGlyph from "./LoadingGlyph.svelte";

  // Named `win`, not `window`, so `window.innerWidth` below is the global.
  export let win: WindowState;
  export let isActive: boolean;
  export let isMobile = false;
  export let taskbarHeight = 0;
  // Host class names, forwarded reactively by PrismWindowManager.
  export let classes: PrismClassMap = EMPTY_CLASSES;
  // A window-modal dialog belongs to this window: block and inert it.
  export let isBlocked = false;

  const ctx = getPrismContext();

  const RESIZE_DIRS: ResizeDirection[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];
  const DOUBLE_CLICK_THRESHOLD = 300;

  // Which control sits where, per appearance. See PrismAppearance in core.
  $: controlOrder = ctx.appearance === "cupertino" ? (["close", "minimize", "maximize"] as const) : (["minimize", "maximize", "close"] as const);

  let dragging = false;
  let resizing = false;
  let keepAlive = true;
  let lastClick = 0;
  let unsnapTimer: ReturnType<typeof setTimeout> | null = null;
  let unsnapping = false;
  let flip: UnsnapFlip | null = null;

  // ---- Entrance animation ----------------------------------------------
  // A class the adapter drops after one run: on .pwm-window it would replay.
  let opening = !prefersReducedMotion();
  const openTimer = opening ? setTimeout(() => (opening = false), PWM_OPEN_ANIMATION_MS) : null;

  // ---- Minimize / restore animation ------------------------------------
  let minimizing = false;
  let restoring = false;
  let minimizeTimer: ReturnType<typeof setTimeout> | null = null;
  function onMinimizedChange(min: boolean) {
    if (minimizeTimer) clearTimeout(minimizeTimer);
    if (prefersReducedMotion()) {
      minimizing = false;
      restoring = false;
      return;
    }
    minimizing = min;
    restoring = !min;
    minimizeTimer = setTimeout(() => {
      minimizeTimer = null;
      minimizing = false;
      restoring = false;
    }, PWM_MINIMIZE_ANIMATION_MS);
  }

  $: caps = ((c) =>
    // A dialog is a window with fewer verbs:
    win.kind === "dialog" ? { ...c, resizable: false, minimizable: false, maximizable: false } : c)(resolveCapabilities(ctx.resolveConfig(win)));
  // Never asked for an external window: the host paints that body itself.
  $: resolved = (win.external ? null : ctx.resolveComponent(win)) as ComponentType | null;

  // ---- RAM manager: keep-alive gate for the body only ------------------
  let prevMinimized: boolean | undefined;
  $: if (win.isMinimized !== prevMinimized) {
    const first = prevMinimized === undefined;
    prevMinimized = win.isMinimized;
    // Skip on mount: a window that starts minimized shouldn't animate itself in.
    if (!first) onMinimizedChange(win.isMinimized);
    if (ctx.ram) {
      if (win.isMinimized) ctx.ram.onMinimize(win.id, () => (keepAlive = false));
      else {
        ctx.ram.onRestore(win.id);
        keepAlive = true;
      }
    }
  }

  // Re-centres as the height changes; stops once the user drags.
  let rootEl: HTMLElement | null = null;
  let userMoved = false;
  let sizeObserver: ResizeObserver | null = null;

  function recentre(h: number) {
    // Reported first: the drag clamp needs the true height, not the placeholder.
    ctx.store.setMeasuredHeight(win.id, h);
    if (userMoved) return;
    // Same centring rule as the store used, now with the measured height.
    const owner = win.modality === "window" && win.ownerId ? ctx.store.getWindowById(win.ownerId) : null;
    const at = centerDialog(win.width, h, { width: window.innerWidth, height: window.innerHeight }, owner);
    ctx.store.updateWindowPosition(win.id, at.x, at.y);
  }

  onMount(() => {
    if (!win.autoHeight || !rootEl) return;
    // onMount runs before paint, so the correction lands in the same frame.
    recentre(rootEl.offsetHeight);

    if (typeof ResizeObserver === "undefined") return;
    sizeObserver = new ResizeObserver(() => {
      const h = rootEl?.offsetHeight;
      if (h) recentre(h);
    });
    sizeObserver.observe(rootEl);
  });

  onDestroy(() => {
    sizeObserver?.disconnect();
    sizeObserver = null;
    if (unsnapTimer) clearTimeout(unsnapTimer);
    if (minimizeTimer) clearTimeout(minimizeTimer);
    if (openTimer) clearTimeout(openTimer);
    ctx.ram?.onRestore(win.id);
  });

  // ---- Style + class ---------------------------------------------------
  $: className = cx("pwm-window", isActive && "pwm-active", win.kind === "dialog" && "pwm-dialog", win.isMaximized && "pwm-maximized", isMobile && win.kind !== "dialog" && "pwm-fullscreen-mobile", dragging && "pwm-dragging", resizing && "pwm-resizing", win.isClosing && "pwm-closing", `pwm-${ctx.appearance}`, unsnapping && "pwm-unsnapping", minimizing && "pwm-minimizing", restoring && "pwm-restoring", opening && "pwm-opening", classes.window, isActive ? classes.windowActive : classes.windowInactive);

  $: style = buildStyle(win, isMobile, taskbarHeight, minimizing, flip);

  function buildStyle(w: WindowState, mobile: boolean, tb: number, keepVisible: boolean, f: UnsnapFlip | null): string {
    const z = `z-index:${w.zIndex};`;
    const hidden = w.isMinimized && !keepVisible ? "display:none;" : "";
    // Read by the pwm-unsnap keyframes;
    const vars = f ? `--pwm-unsnap-from:${f.transform};--pwm-unsnap-from-content:${f.contentTransform};` : "";
    // Dialogs keep their centred bounds on mobile; only plain windows go fullscreen.
    if (mobile && w.kind !== "dialog") return `${hidden}top:0;left:0;width:100vw;height:calc(100% - ${tb}px);${z}${vars}`;
    if (w.isMaximized) return `${hidden}top:0;left:0;width:100%;height:calc(100% - ${tb}px);${z}${vars}`;
    // Height omitted when the content decides: CSS caps it instead.
    const h = w.autoHeight ? "" : `height:${w.height}px;`;
    return `${hidden}top:${w.y}px;left:${w.x}px;width:${w.width}px;${h}${z}${vars}`;
  }

  // ---- Focus / controls ------------------------------------------------
  function onFocus() {
    if (!isActive) ctx.store.focusWindow(win.id);
  }

  // Focus on mousedown, minus the controls: hitting ✕ used to raise the window.
  function onRootMouseDown(e: MouseEvent) {
    // Blocked by a window-modal dialog: the click landed on its backdrop.
    if (isBlocked) {
      ctx.store.dismissDialogFor(win.id);
      return;
    }
    if ((e.target as HTMLElement).closest(".pwm-window-controls")) return;
    onFocus();
  }

  // ---- Drag --------------------------------------------------------------
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
    if (win.isMaximized || isMobile || e.button !== 0) return;

    const now = Date.now();
    if (now - lastClick < DOUBLE_CLICK_THRESHOLD) {
      lastClick = 0;
      return; // second click of a double-click → let dblclick handle it
    }
    lastClick = now;

    onFocus();

    const strip = e.currentTarget as HTMLElement;

    let initialX = win.x;
    let initialY = win.y;

    const startX = e.clientX;
    const startY = e.clientY;

    // A snapped window unsnaps only once the pointer travels, not on a bare click.
    let pendingUnsnap = !!win.isSnapped;
    dragging = !pendingUnsnap;

    const move = (ev: PointerEvent) => {
      if (pendingUnsnap) {
        if (Math.abs(ev.clientX - startX) < UNSNAP_DRAG_THRESHOLD && Math.abs(ev.clientY - startY) < UNSNAP_DRAG_THRESHOLD) {
          return;
        }
        pendingUnsnap = false;

        const pre = ctx.store.getPreSnapBounds(win.id);
        if (pre) {
          // The rect it currently occupies, before the store drops the snap.
          const from = {
            x: win.x,
            y: win.y,
            width: win.width,
            height: win.height,
          };
          const pct = (startX - win.x) / win.width;
          initialX = startX - pre.width * pct;
          initialY = startY - 20;
          // Where it lands this frame: the same position committed just below.
          flip = computeUnsnapFlip(from, {
            x: initialX + (ev.clientX - startX),
            y: initialY + (ev.clientY - startY),
            width: pre.width,
            height: pre.height,
          });
          ctx.store.unSnapWindow(win.id);
        }
        // Position tracks the pointer; transitioning it too makes the window rubber-band.
        dragging = true;
        unsnapping = true;
        unsnapTimer = setTimeout(() => {
          unsnapTimer = null;
          unsnapping = false;
          flip = null;
        }, PWM_UNSNAP_ANIMATION_MS);
      }

      // Once dragged, the position is the user's: stop re-centring.
      userMoved = true;
      ctx.store.updateWindowPosition(win.id, initialX + (ev.clientX - startX), initialY + (ev.clientY - startY));
      if (!isMobile && caps.maximizable) {
        ctx.store.setSnapPreview(detectSnapEdge(ev.clientX, window.innerWidth));
      }
    };
    const up = () => {
      if (ctx.store.snapPreview && !isMobile && caps.maximizable) {
        ctx.store.snapWindow(win.id, ctx.store.snapPreview, taskbarHeight);
      }
      ctx.store.clearSnapPreview();
      if (unsnapTimer) {
        clearTimeout(unsnapTimer);
        unsnapTimer = null;
      }
      unsnapping = false;
      flip = null;
      dragging = false;
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
    if (caps.maximizable) ctx.store.toggleMaximize(win.id);
    e.preventDefault();
    e.stopPropagation();
  }

  // ---- Resize (math in core) -------------------------------------------
  function onResizeStart(direction: ResizeDirection, e: PointerEvent) {
    if (win.isMaximized) return;
    e.stopPropagation();

    const handle = e.currentTarget as HTMLElement;

    const startX = e.clientX;
    const startY = e.clientY;
    const initialWidth = win.width;
    const initialHeight = win.height;
    const initialX = win.x;
    const initialY = win.y;

    onFocus();
    resizing = true;

    const move = (ev: PointerEvent) => {
      const b = computeResize({
        direction,
        deltaX: ev.clientX - startX,
        deltaY: ev.clientY - startY,
        initialX,
        initialY,
        initialWidth,
        initialHeight,
        minWidth: caps.minWidth,
        minHeight: caps.minHeight,
        maxWidth: caps.maxWidth,
        maxHeight: caps.maxHeight,
      });
      ctx.store.updateWindowSize(win.id, b.width, b.height);
      if (b.x !== initialX || b.y !== initialY) {
        ctx.store.updateWindowPosition(win.id, b.x, b.y);
      }
    };
    const up = () => {
      resizing = false;
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
  }
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div bind:this={rootEl} class={className} {style} data-pwm-window={win.id} data-pwm-blocked={isBlocked ? "" : undefined} data-pwm-autoheight={win.autoHeight ? "" : undefined} on:mousedown={onRootMouseDown}>
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class={cx("pwm-window-header", classes.titleBar)} inert={isBlocked || undefined}>
    <!-- On the strip, not the header: there, pressing ✕ would start a drag. -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="pwm-window-header-draggable" on:pointerdown={onHeaderPointerDown} on:dblclick={onHeaderDblClick}>
      <div class={cx("pwm-window-icon-container", isActive ? classes.iconContainerActive : classes.iconContainer)}>
        <slot name="icon" {win}><ControlGlyph kind="window" /></slot>
      </div>
      <span class={cx("pwm-window-title", isActive ? classes.titleActive : classes.title)}>
        {win.title}
        <slot name="titleBarExtra" {win} />
      </span>
    </div>

    <div class="pwm-window-controls">
      <!-- Ordered in the DOM, not with CSS `order`: -->
      {#each controlOrder as kind (kind)}
        {#if kind === "minimize" && caps.minimizable}
          <button type="button" class={cx("pwm-window-control pwm-minimize", classes.control)} title={ctx.labels.minimize} aria-label="minimize" on:click|stopPropagation={() => ctx.store.minimizeWindow(win.id)}>
            <slot name="minimize-icon" {win}><ControlGlyph kind="minimize" /></slot>
          </button>
        {:else if kind === "maximize" && !isMobile && caps.maximizable}
          <button type="button" class={cx("pwm-window-control pwm-maximize", classes.control)} title={win.isMaximized ? ctx.labels.restore : ctx.labels.maximize} aria-label="maximize" on:click|stopPropagation={() => ctx.store.toggleMaximize(win.id)}>
            <slot name="maximize-icon" {win}>
              <ControlGlyph kind={win.isMaximized ? "restore" : "maximize"} />
            </slot>
          </button>
        {:else if kind === "close" && caps.closeable}
          <button type="button" class={cx("pwm-window-control pwm-close", classes.closeControl)} title={ctx.labels.close} aria-label="close" on:click|stopPropagation={() => ctx.requestClose(win.id)}>
            <slot name="close-icon" {win}><ControlGlyph kind="close" /></slot>
          </button>
        {/if}
      {/each}
    </div>
  </div>

  <div class={cx("pwm-window-body", classes.body)} inert={isBlocked || undefined}>
    <!-- The host paints this one itself (a <PrismDialog> slot). -->
    {#if win.external}
      <div class="pwm-window-slot" data-pwm-slot={win.id}></div>
    {:else if resolved && keepAlive}
      <svelte:component this={resolved} {...win.data} />
    {:else}
      <slot name="loading"><LoadingGlyph /></slot>
    {/if}
  </div>

  {#if !win.isMaximized && !isMobile && caps.resizable}
    {#each RESIZE_DIRS as dir (dir)}
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div class="pwm-resize-handle pwm-resize-{dir}" on:pointerdown={(e) => onResizeStart(dir, e)}></div>
    {/each}
  {/if}
</div>
