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

import { useCallback, useEffect, useMemo, useRef, type ComponentType, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { prefersReducedMotion, PWM_CLOSE_ANIMATION_MS, RamManager, type AppConfig, type PrismAppearance, type WindowManagerStore, type WindowState } from "@prism-wm/core";
import { useWindowManager } from "./useWindowManager";
import { cx, DEFAULT_LABELS, EMPTY_CLASSES, PrismProvider, type PrismClassMap, type PrismContext, type WindowLabels } from "./context";
import { PrismWindow } from "./PrismWindow";

export interface PrismWindowManagerProps {
  store: WindowManagerStore;
  resolveComponent: (window: WindowState) => ComponentType<Record<string, unknown>> | null;
  resolveConfig?: (window: WindowState) => Partial<AppConfig> | undefined;
  taskbarHeight?: number;
  isMobile?: boolean;
  labels?: Partial<WindowLabels>;
  classes?: Partial<PrismClassMap>;
  enableRamManager?: boolean;
  appearance?: PrismAppearance;
  renderIcon?: (window: WindowState) => ReactNode;
  renderTitleBarExtra?: (window: WindowState) => ReactNode;
  renderLoading?: () => ReactNode;
  minimizeIcon?: ReactNode;
  maximizeIcon?: ReactNode;
  restoreIcon?: ReactNode;
  closeIcon?: ReactNode;
}

export function PrismWindowManager(props: PrismWindowManagerProps) {
  const { store, resolveComponent, resolveConfig, taskbarHeight = 0, isMobile = false, labels, classes, enableRamManager = true, appearance = "redmond" } = props;

  const mergedClasses = useMemo<PrismClassMap>(() => ({ ...EMPTY_CLASSES, ...classes }), [classes]);

  const state = useWindowManager(store);

  // One RAM manager for the lifetime of the manager.
  const ramRef = useRef<RamManager | null>(null);
  if (enableRamManager && !ramRef.current) ramRef.current = new RamManager();
  useEffect(() => () => ramRef.current?.dispose(), []);

  // Windows linger for one exit animation, so the close is pure CSS in all three.
  const closeTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const timers = closeTimers.current;
    return () => {
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);

  // Just the store's protocol:
  const requestClose = useCallback(
    async (id: string) => {
      await store.requestClose(id);
    },
    [store],
  );

  // Driven off isClosing, so a close from a taskbar animates too.
  useEffect(() => {
    const timers = closeTimers.current;
    for (const win of state.windows) {
      if (!win.isClosing || timers.has(win.id)) continue;
      if (prefersReducedMotion()) {
        store.closeWindow(win.id);
        continue;
      }
      timers.set(
        win.id,
        setTimeout(() => {
          timers.delete(win.id);
          store.closeWindow(win.id);
        }, PWM_CLOSE_ANIMATION_MS),
      );
    }
  }, [state.windows, store]);

  // Keyboard:
  const requestCloseRef = useRef(requestClose);
  requestCloseRef.current = requestClose;
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Escape belongs to the topmost dialog, not to the window behind it.
      if (e.key === "Escape") {
        const open = store.dialogs;
        if (open.length) {
          const top = open.reduce((m, d) => (d.zIndex > m.zIndex ? d : m));
          void requestCloseRef.current(top.id);
          e.preventDefault();
          return;
        }
      }
      const active = store.activeWindowId;
      if (!active) return;
      if (e.key === "Escape" || (e.altKey && e.key === "F4")) {
        void requestCloseRef.current(active);
        e.preventDefault();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [store]);

  // A click inside a cross-origin iframe never produces mouse events in this document
  useEffect(() => {
    let tick: ReturnType<typeof setTimeout> | null = null;
    function onWindowBlur() {
      // Next tick some browsers update activeElement after the blur event.
      tick = setTimeout(() => {
        tick = null;
        const el = document.activeElement;
        if (!el || el.tagName !== "IFRAME") return;
        const id = el.closest("[data-pwm-window]")?.getAttribute("data-pwm-window");
        // Only this manager's windows, and never re-raise the active one.
        if (!id || id === store.activeWindowId || !store.getWindowById(id)) return;
        store.focusWindow(id);
      });
    }
    window.addEventListener("blur", onWindowBlur);
    return () => {
      window.removeEventListener("blur", onWindowBlur);
      if (tick) clearTimeout(tick);
    };
  }, [store]);

  const context = useMemo<PrismContext>(
    () => ({
      store,
      ram: ramRef.current,
      resolveComponent,
      resolveConfig: resolveConfig ?? (() => undefined),
      isMobile,
      taskbarHeight,
      appearance,
      labels: { ...DEFAULT_LABELS, ...labels },
      classes: mergedClasses,
      requestClose,
      renderIcon: props.renderIcon,
      renderTitleBarExtra: props.renderTitleBarExtra,
      renderLoading: props.renderLoading,
      minimizeIcon: props.minimizeIcon,
      maximizeIcon: props.maximizeIcon,
      restoreIcon: props.restoreIcon,
      closeIcon: props.closeIcon,
    }),
    [store, resolveComponent, resolveConfig, isMobile, taskbarHeight, appearance, labels, mergedClasses, requestClose, props.renderIcon, props.renderTitleBarExtra, props.renderLoading, props.minimizeIcon, props.maximizeIcon, props.restoreIcon, props.closeIcon],
  );

  // `app` paints a sheet under the topmost dialog; `window` inerts the owner.
  const dialogs = state.windows.filter((w) => w.kind === "dialog" && !w.isClosing);
  // The scrim outlives its dialog by one animation, or the backdrop blinks away.
  const appModal = state.windows.filter((w) => w.kind === "dialog" && (w.modality ?? "app") === "app");
  const liveAppModal = appModal.filter((d) => !d.isClosing);
  const scrimSource = liveAppModal.length ? liveAppModal : appModal;
  const scrimZ = scrimSource.length ? Math.min(...scrimSource.map((d) => d.zIndex)) - 1 : null;
  const scrimClosing = appModal.length > 0 && liveAppModal.length === 0;
  const blockedOwners = new Set(dialogs.filter((d) => d.modality === "window" && d.ownerId).map((d) => d.ownerId!));

  // App-modal dialogs are lifted out so the host's chrome cannot cover them.
  const inModalLayer = (w: WindowState) => w.kind === "dialog" && (w.modality ?? "app") === "app";
  const layered = state.windows.filter(inModalLayer);
  const grounded = state.windows.filter((w) => !inModalLayer(w));

  const renderWindow = (win: WindowState) => <PrismWindow key={win.id} window={win} isActive={win.id === state.activeWindowId} isBlocked={blockedOwners.has(win.id)} />;

  return (
    <PrismProvider value={context}>
      <div className={cx("pwm-manager", mergedClasses.manager)}>
        {state.snapPreview && <div className={cx("pwm-snap-preview", `pwm-snap-${state.snapPreview}`, mergedClasses.snapPreview)} style={{ height: `calc(100% - ${taskbarHeight}px)` }} />}
        {/* Every window, minimized ones hidden with display:none in
            PrismWindow) so the RAM manager decides when to unmount them. */}
        {grounded.map(renderWindow)}
      </div>

      {(scrimZ !== null || layered.length > 0) &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="pwm-modal-layer">
            {scrimZ !== null && <div className={cx("pwm-scrim", scrimClosing && "pwm-scrim-closing")} style={{ zIndex: scrimZ }} onMouseDown={() => store.dismissTopDialog()} />}
            {layered.map(renderWindow)}
          </div>,
          document.body,
        )}
    </PrismProvider>
  );
}
