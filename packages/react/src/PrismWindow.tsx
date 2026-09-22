/*
 * Prism Window Manager (@prism-wm), React adapter
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

import { createElement, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, version as reactVersion, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { computeResize, centerDialog, computeUnsnapFlip, detectSnapEdge, prefersReducedMotion, type UnsnapFlip, PWM_MINIMIZE_ANIMATION_MS, PWM_OPEN_ANIMATION_MS, PWM_UNSNAP_ANIMATION_MS, UNSNAP_DRAG_THRESHOLD, type PrismAppearance, type ResizeDirection, type WindowState } from "@prism-wm/core";
import { cx, resolveCapabilities, usePrismContext } from "./context";

const RESIZE_DIRS: ResizeDirection[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

// React 18 only emits `inert` for a string and drops `true`; React 19 is the reverse.
const INERT = (Number(reactVersion.split(".")[0]) >= 19 ? true : "") as boolean;
const DOUBLE_CLICK_THRESHOLD = 300;

const CONTROL_ORDER: Record<PrismAppearance, readonly ControlKind[]> = {
  redmond: ["minimize", "maximize", "close"],
  cupertino: ["close", "minimize", "maximize"],
};

type ControlKind = "minimize" | "maximize" | "close";

const ICON_PROPS = {
  className: "pwm-fallback-icon",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  "aria-hidden": true,
} as const;

const MinimizeGlyph = () => (
  <svg {...ICON_PROPS} data-glyph="minimize" strokeLinecap="round">
    <path d="M5 12h14" />
  </svg>
);

const MaximizeGlyph = () => (
  <svg {...ICON_PROPS} data-glyph="maximize" strokeLinejoin="round">
    <rect x="5" y="5" width="14" height="14" rx="1.5" />
    <path d="M5 9h14" />
  </svg>
);

const RestoreGlyph = () => (
  <svg {...ICON_PROPS} data-glyph="restore" strokeLinejoin="round">
    <path d="M8.5 8.5V6.5A1.5 1.5 0 0 1 10 5h7.5A1.5 1.5 0 0 1 19 6.5V14a1.5 1.5 0 0 1-1.5 1.5h-2" />
    <rect x="5" y="8.5" width="10.5" height="10.5" rx="1.5" />
    <path d="M5 12h10.5" />
  </svg>
);

const WindowGlyph = () => (
  <svg className="pwm-fallback-icon" data-glyph="window" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M21.53 5.15a.99.99 0 0 0-.97-.04l-10 5a1 1 0 0 0-.55.89v10a1 1 0 0 0 1 1c.15 0 .31-.04.45-.11l10-5a1 1 0 0 0 .55-.89V6c0-.35-.18-.67-.47-.85ZM20 15.38l-8 4v-7.76l8-4z" />
    <path d="m16.55 3.11l-10 5A1 1 0 0 0 6 9v10h2V9.62l9.45-4.72l-.89-1.79Z" />
    <path d="m12.55 1.11l-10 5A1 1 0 0 0 2 7v10h2V7.62l9.45-4.73l-.89-1.79Z" />
  </svg>
);

const LoadingGlyph = () => (
  <div className="pwm-window-loading">
    <svg className="pwm-loading-icon" viewBox="0 0 24 24" fill="none" role="status" aria-label="Loading">
      <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3c4.97 0 9 4.03 9 9" />
    </svg>
  </div>
);

const CloseGlyph = () => (
  <svg {...ICON_PROPS} data-glyph="close" strokeLinecap="round">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

function viewportWidth(): number {
  return typeof window !== "undefined" ? window.innerWidth : 1920;
}

function capturePointer(el: Element, pointerId: number) {
  try {
    el.setPointerCapture?.(pointerId);
  } catch {
    /* ayyyyy lmao */
  }
}

function releasePointer(el: Element, pointerId: number) {
  try {
    el.releasePointerCapture?.(pointerId);
  } catch {
    /* bro yes */
  }
}

const useAnimationLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export interface PrismWindowProps {
  window: WindowState;
  isActive: boolean;
  isBlocked?: boolean;
}

export function PrismWindow({ window: win, isActive, isBlocked = false }: PrismWindowProps) {
  const isClosing = win.isClosing === true;
  const ctx = usePrismContext();
  const caps = useMemo(() => {
    const c = resolveCapabilities(ctx.resolveConfig(win));
    if (win.kind !== "dialog") return c;
    return { ...c, resizable: false, minimizable: false, maximizable: false };
  }, [ctx, win]);

  const Resolved = win.external ? null : ctx.resolveComponent(win);

  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [keepAlive, setKeepAlive] = useState(true);
  const [unsnapping, setUnsnapping] = useState(false);
  const [flip, setFlip] = useState<UnsnapFlip | null>(null);
  const [minimizing, setMinimizing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const minimizeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevMinimized = useRef(win.isMinimized);
  const [opening, setOpening] = useState(() => !prefersReducedMotion());
  useEffect(() => {
    if (!opening) return;
    const t = setTimeout(() => setOpening(false), PWM_OPEN_ANIMATION_MS);
    return () => clearTimeout(t);
  }, []);
  const lastClick = useRef(0);
  const unsnapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Minimize / restore animation ------------------------------------
  useAnimationLayoutEffect(() => {
    if (prevMinimized.current === win.isMinimized) return;
    prevMinimized.current = win.isMinimized;

    if (minimizeTimer.current) clearTimeout(minimizeTimer.current);
    if (prefersReducedMotion()) {
      setMinimizing(false);
      setRestoring(false);
      return;
    }
    setMinimizing(win.isMinimized);
    setRestoring(!win.isMinimized);
    minimizeTimer.current = setTimeout(() => {
      minimizeTimer.current = null;
      setMinimizing(false);
      setRestoring(false);
    }, PWM_MINIMIZE_ANIMATION_MS);
  }, [win.isMinimized]);

  useEffect(
    () => () => {
      if (minimizeTimer.current) clearTimeout(minimizeTimer.current);
    },
    [],
  );

  // ---- RAM manager: keep-alive gate for the body only ------------------
  useEffect(() => {
    const ram = ctx.ram;
    if (!ram) return;
    if (win.isMinimized) ram.onMinimize(win.id, () => setKeepAlive(false));
    else {
      ram.onRestore(win.id);
      setKeepAlive(true);
    }
  }, [ctx.ram, win.id, win.isMinimized]);

  useEffect(
    () => () => {
      if (unsnapTimer.current) clearTimeout(unsnapTimer.current);
      ctx.ram?.onRestore(win.id);
    },
    [ctx.ram, win.id],
  );

  // ---- Style -----------------------------------------------------------

  // Dialogs keep their centred bounds on mobile; only plain windows go fullscreen.
  const style: CSSProperties =
    ctx.isMobile && win.kind !== "dialog"
      ? { top: 0, left: 0, width: "100vw", height: `calc(100% - ${ctx.taskbarHeight}px)`, zIndex: win.zIndex }
      : win.isMaximized
        ? { top: 0, left: 0, width: "100%", height: `calc(100% - ${ctx.taskbarHeight}px)`, zIndex: win.zIndex }
        : {
            top: win.y,
            left: win.x,
            width: win.width,
            // Omitted when the content decides: CSS caps it instead.
            height: win.autoHeight ? undefined : win.height,
            zIndex: win.zIndex,
          };

  // ---- Focus / controls ------------------------------------------------
  function onFocus() {
    if (!isActive) ctx.store.focusWindow(win.id);
  }

  // Focus on mousedown, minus the controls: hitting ✕ used to raise the window.
  function onRootMouseDown(e: ReactMouseEvent) {
    // Blocked by a window-modal dialog: the click landed on its backdrop.
    if (isBlocked) {
      ctx.store.dismissDialogFor(win.id);
      return;
    }
    if ((e.target as HTMLElement).closest(".pwm-window-controls")) return;
    onFocus();
  }

  // ---- Drag --------------------------------------------------------------
  function onHeaderPointerDown(e: ReactPointerEvent) {
    if (win.isMaximized || ctx.isMobile || e.button !== 0) return;

    const now = Date.now();
    if (now - lastClick.current < DOUBLE_CLICK_THRESHOLD) {
      lastClick.current = 0;
      return; // second click of a double-click → let onDoubleClick handle it
    }
    lastClick.current = now;

    onFocus();

    const strip = e.currentTarget as HTMLElement;

    let initialX = win.x;
    let initialY = win.y;

    const startX = e.clientX;
    const startY = e.clientY;

    // A snapped window unsnaps only once the pointer travels, not on a bare click.
    let pendingUnsnap = !!win.isSnapped;
    setDragging(!pendingUnsnap);

    const move = (ev: globalThis.PointerEvent) => {
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
          setFlip(
            computeUnsnapFlip(from, {
              x: initialX + (ev.clientX - startX),
              y: initialY + (ev.clientY - startY),
              width: pre.width,
              height: pre.height,
            }),
          );
          ctx.store.unSnapWindow(win.id);
        }
        // Position tracks the pointer; transitioning it too makes the window rubber-band.
        setDragging(true);
        setUnsnapping(true);
        unsnapTimer.current = setTimeout(() => {
          unsnapTimer.current = null;
          setUnsnapping(false);
          setFlip(null);
        }, PWM_UNSNAP_ANIMATION_MS);
      }

      // Once dragged, the position is the user's: stop re-centring.
      userMoved.current = true;
      ctx.store.updateWindowPosition(win.id, initialX + (ev.clientX - startX), initialY + (ev.clientY - startY));
      if (!ctx.isMobile && caps.maximizable) {
        ctx.store.setSnapPreview(detectSnapEdge(ev.clientX, viewportWidth()));
      }
    };
    const up = () => {
      if (ctx.store.snapPreview && !ctx.isMobile && caps.maximizable) {
        ctx.store.snapWindow(win.id, ctx.store.snapPreview, ctx.taskbarHeight);
      }
      ctx.store.clearSnapPreview();
      if (unsnapTimer.current) {
        clearTimeout(unsnapTimer.current);
        unsnapTimer.current = null;
      }
      setUnsnapping(false);
      setFlip(null);
      setDragging(false);
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

  function onHeaderDoubleClick(e: ReactMouseEvent) {
    if (caps.maximizable) ctx.store.toggleMaximize(win.id);
    e.preventDefault();
    e.stopPropagation();
  }

  // ---- Resize (math in core) -------------------------------------------
  function onResizeStart(direction: ResizeDirection, e: ReactPointerEvent) {
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
    setResizing(true);

    const move = (ev: globalThis.PointerEvent) => {
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
      setResizing(false);
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

  const cls = ctx.classes;

  // Re-centres as the height changes; stops once the user drags.
  const rootRef = useRef<HTMLDivElement | null>(null);
  const userMoved = useRef(false);

  const recentre = useCallback(
    (h: number) => {
      // Reported first: the drag clamp needs the true height, not the placeholder.
      ctx.store.setMeasuredHeight(win.id, h);
      if (userMoved.current) return;
      // Same centring rule as the store used, now with the measured height.
      const owner = win.modality === "window" && win.ownerId ? ctx.store.getWindowById(win.ownerId) : null;
      const at = centerDialog(
        win.width,
        h,
        {
          width: typeof window !== "undefined" ? window.innerWidth : 0,
          height: typeof window !== "undefined" ? window.innerHeight : 0,
        },
        owner,
      );
      ctx.store.updateWindowPosition(win.id, at.x, at.y);
    },
    [ctx.store, win.id, win.width, win.modality, win.ownerId],
  );

  // A layout effect, so the correction lands in the same paint instead of jumping.
  useAnimationLayoutEffect(() => {
    if (!win.autoHeight || !rootRef.current) return;
    recentre(rootRef.current.offsetHeight);

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const h = rootRef.current?.offsetHeight;
      if (h) recentre(h);
    });
    observer.observe(rootRef.current);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win.autoHeight, recentre]);

  // Spread rather than a literal attribute:
  const inertProps = isBlocked ? { inert: INERT } : {};

  const className = cx("pwm-window", isActive && "pwm-active", win.kind === "dialog" && "pwm-dialog", win.isMaximized && "pwm-maximized", ctx.isMobile && win.kind !== "dialog" && "pwm-fullscreen-mobile", dragging && "pwm-dragging", resizing && "pwm-resizing", isClosing && "pwm-closing", unsnapping && "pwm-unsnapping", minimizing && "pwm-minimizing", restoring && "pwm-restoring", opening && "pwm-opening", `pwm-${ctx.appearance}`, cls.window, isActive ? cls.windowActive : cls.windowInactive);

  return (
    <div
      className={className}
      data-pwm-window={win.id}
      data-pwm-blocked={isBlocked ? "" : undefined}
      data-pwm-autoheight={win.autoHeight ? "" : undefined}
      ref={rootRef}
      style={{
        display: win.isMinimized && !minimizing ? "none" : undefined,
        ...style,
        // Read by the pwm-unsnap keyframes;
        ...(flip
          ? ({
              "--pwm-unsnap-from": flip.transform,
              "--pwm-unsnap-from-content": flip.contentTransform,
            } as CSSProperties)
          : null),
      }}
      onMouseDown={onRootMouseDown}
    >
      <div className={cx("pwm-window-header", cls.titleBar)} {...inertProps}>
        <div className="pwm-window-header-draggable" onPointerDown={onHeaderPointerDown} onDoubleClick={onHeaderDoubleClick}>
          <div className={cx("pwm-window-icon-container", isActive ? cls.iconContainerActive : cls.iconContainer)}>{ctx.renderIcon?.(win) ?? <WindowGlyph />}</div>
          <span className={cx("pwm-window-title", isActive ? cls.titleActive : cls.title)}>
            {win.title}
            {ctx.renderTitleBarExtra?.(win)}
          </span>
        </div>

        <div className="pwm-window-controls">
          {CONTROL_ORDER[ctx.appearance].map((kind) => {
            if (kind === "minimize") {
              return caps.minimizable ? (
                <button
                  key={kind}
                  type="button"
                  className={cx("pwm-window-control pwm-minimize", cls.control)}
                  title={ctx.labels.minimize}
                  aria-label="minimize"
                  onClick={(e) => {
                    e.stopPropagation();
                    ctx.store.minimizeWindow(win.id);
                  }}
                >
                  {ctx.minimizeIcon ?? <MinimizeGlyph />}
                </button>
              ) : null;
            }
            if (kind === "maximize") {
              return !ctx.isMobile && caps.maximizable ? (
                <button
                  key={kind}
                  type="button"
                  className={cx("pwm-window-control pwm-maximize", cls.control)}
                  title={win.isMaximized ? ctx.labels.restore : ctx.labels.maximize}
                  aria-label="maximize"
                  onClick={(e) => {
                    e.stopPropagation();
                    ctx.store.toggleMaximize(win.id);
                  }}
                >
                  {win.isMaximized ? (ctx.restoreIcon ?? <RestoreGlyph />) : (ctx.maximizeIcon ?? <MaximizeGlyph />)}
                </button>
              ) : null;
            }
            return caps.closeable ? (
              <button
                key={kind}
                type="button"
                className={cx("pwm-window-control pwm-close", cls.closeControl)}
                title={ctx.labels.close}
                aria-label="close"
                onClick={(e) => {
                  e.stopPropagation();
                  void ctx.requestClose(win.id);
                }}
              >
                {ctx.closeIcon ?? <CloseGlyph />}
              </button>
            ) : null;
          })}
        </div>
      </div>

      <div className={cx("pwm-window-body", cls.body)} {...inertProps}>
        {win.external ? <div className="pwm-window-slot" data-pwm-slot={win.id} /> : Resolved && keepAlive ? createElement(Resolved, win.data as Record<string, unknown>) : (ctx.renderLoading?.() ?? <LoadingGlyph />)}
      </div>

      {!win.isMaximized && !ctx.isMobile && caps.resizable ? RESIZE_DIRS.map((dir) => <div key={dir} className={`pwm-resize-handle pwm-resize-${dir}`} onPointerDown={(e) => onResizeStart(dir, e)} />) : null}
    </div>
  );
}
