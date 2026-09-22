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
  import { onMount, onDestroy } from "svelte";
  import { prefersReducedMotion, PWM_CLOSE_ANIMATION_MS, RamManager, type AppConfig, type PrismAppearance, type WindowManagerStore, type WindowState } from "@prism-wm/core";
  import { toReadable } from "./store.js";
  import { cx, DEFAULT_LABELS, EMPTY_CLASSES, setPrismContext, type PrismClassMap, type PrismContext, type WindowLabels } from "./context.js";
  import PrismWindow from "./PrismWindow.svelte";
  import ControlGlyph from "./ControlGlyph.svelte";
  import LoadingGlyph from "./LoadingGlyph.svelte";

  export let store: WindowManagerStore;
  export let resolveComponent: (window: WindowState) => unknown;
  export let resolveConfig: (window: WindowState) => Partial<AppConfig> | undefined = () => undefined;
  export let taskbarHeight = 0;
  export let isMobile = false;
  export let labels: Partial<WindowLabels> = {};
  // Host classes layered onto Prism's own. Pair with prism-structure.css.
  export let classes: Partial<PrismClassMap> = {};
  // Enable the memory-pressure RAM manager for minimized windows.
  export let enableRamManager = true;
  // Global on purpose: nobody wants one window in each appearance.
  export let appearance: PrismAppearance = "redmond";

  const state = toReadable(store);
  const ram = enableRamManager ? new RamManager() : null;

  // Reactive, so a host swapping themes repaints without recreating the manager.
  $: merged = { ...EMPTY_CLASSES, ...classes } as PrismClassMap;

  // `app` paints a sheet under the topmost dialog; `window` inerts the owner.
  $: dialogs = $state.windows.filter((w) => w.kind === "dialog" && !w.isClosing);
  // The scrim outlives its dialog by one animation, or the backdrop blinks away.
  $: appModal = $state.windows.filter((w) => w.kind === "dialog" && (w.modality ?? "app") === "app");
  $: liveAppModal = appModal.filter((d) => !d.isClosing);
  $: scrimSource = liveAppModal.length ? liveAppModal : appModal;
  $: scrimZ = scrimSource.length ? Math.min(...scrimSource.map((d) => d.zIndex)) - 1 : null;
  $: scrimClosing = appModal.length > 0 && liveAppModal.length === 0;
  // App-modal dialogs are lifted out so the host's chrome cannot cover them.
  const inModalLayer = (w: WindowState) => w.kind === "dialog" && (w.modality ?? "app") === "app";
  $: layered = $state.windows.filter(inModalLayer);
  $: grounded = $state.windows.filter((w) => !inModalLayer(w));

  $: blockedOwners = new Set(dialogs.filter((d) => d.modality === "window" && d.ownerId).map((d) => d.ownerId as string));

  // Windows linger for one exit animation, so the close is pure CSS in all three.
  const closeTimers = new Map<string, ReturnType<typeof setTimeout>>();

  // Just the store's protocol:
  async function requestClose(id: string) {
    await store.requestClose(id);
  }

  // Driven off isClosing, so a close from a taskbar animates too.
  $: for (const win of $state.windows) {
    if (win.isClosing && !closeTimers.has(win.id)) {
      if (prefersReducedMotion()) {
        store.closeWindow(win.id);
      } else {
        closeTimers.set(
          win.id,
          setTimeout(() => {
            closeTimers.delete(win.id);
            store.closeWindow(win.id);
          }, PWM_CLOSE_ANIMATION_MS),
        );
      }
    }
  }

  // Context holds STABLE values only.
  const context: PrismContext = {
    store,
    ram,
    resolveComponent,
    resolveConfig,
    labels: { ...DEFAULT_LABELS, ...labels },
    appearance,
    requestClose,
  };
  setPrismContext(context);

  function onKeyDown(e: KeyboardEvent) {
    // Escape belongs to the topmost dialog, not to the window behind it.
    if (e.key === "Escape") {
      const open = store.dialogs;
      if (open.length) {
        const top = open.reduce((m, d) => (d.zIndex > m.zIndex ? d : m));
        void requestClose(top.id);
        e.preventDefault();
        return;
      }
    }
    const active = store.activeWindowId;
    if (!active) return;
    if (e.key === "Escape" || (e.altKey && e.key === "F4")) {
      void requestClose(active);
      e.preventDefault();
    }
  }

  // A click inside a cross-origin iframe never produces mouse events in this document
  let iframeFocusTick: ReturnType<typeof setTimeout> | null = null;
  function onWindowBlur() {
    // Next tick: some browsers update activeElement after the blur event.
    iframeFocusTick = setTimeout(() => {
      iframeFocusTick = null;
      const el = document.activeElement;
      if (!el || el.tagName !== "IFRAME") return;
      const id = el.closest("[data-pwm-window]")?.getAttribute("data-pwm-window");
      // Only this manager's windows, and never re-raise the active one.
      if (!id || id === store.activeWindowId || !store.getWindowById(id)) return;
      store.focusWindow(id);
    });
  }

  onMount(() => {
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", onWindowBlur);
  });
  onDestroy(() => {
    document.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("blur", onWindowBlur);
    if (iframeFocusTick) clearTimeout(iframeFocusTick);
    closeTimers.forEach(clearTimeout);
    closeTimers.clear();
    ram?.dispose();
  });
  // Portals to <body>, like antd and MUI: a host stacking context would trap it.
  function portal(node: HTMLElement) {
    if (typeof document === "undefined") return;
    document.body.appendChild(node);
    return { destroy: () => node.remove() };
  }
</script>

<div class={cx("pwm-manager", merged.manager)}>
  {#if $state.snapPreview}
    <div class={cx("pwm-snap-preview", `pwm-snap-${$state.snapPreview}`, merged.snapPreview)} style="height: calc(100% - {taskbarHeight}px)"></div>
  {/if}

  <!-- Every window, minimized ones hidden, so the RAM manager decides on unmount. -->
  {#each grounded as win (win.id)}
    <PrismWindow {win} isActive={win.id === $state.activeWindowId} isBlocked={blockedOwners.has(win.id)} {isMobile} {taskbarHeight} classes={merged}>
      <svelte:fragment slot="icon" let:win>
        <slot name="icon" {win}><ControlGlyph kind="window" /></slot>
      </svelte:fragment>
      <slot name="titleBarExtra" slot="titleBarExtra" let:win {win} />
      <slot name="loading" slot="loading"><LoadingGlyph /></slot>
      <!-- Forwarding a slot marks it filled, so the fallback is repeated here. -->
      <svelte:fragment slot="minimize-icon" let:win>
        <slot name="minimize-icon" {win}><ControlGlyph kind="minimize" /></slot>
      </svelte:fragment>
      <svelte:fragment slot="maximize-icon" let:win>
        <slot name="maximize-icon" {win}>
          <ControlGlyph kind={win.isMaximized ? "restore" : "maximize"} />
        </slot>
      </svelte:fragment>
      <svelte:fragment slot="close-icon" let:win>
        <slot name="close-icon" {win}><ControlGlyph kind="close" /></slot>
      </svelte:fragment>
    </PrismWindow>
  {/each}
</div>

{#if scrimZ !== null || layered.length}
  <div class="pwm-modal-layer" use:portal>
    {#if scrimZ !== null}
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div class={cx("pwm-scrim", scrimClosing && "pwm-scrim-closing")} style="z-index:{scrimZ}" on:mousedown={() => store.dismissTopDialog()}></div>
    {/if}

    {#each layered as win (win.id)}
      <PrismWindow {win} isActive={win.id === $state.activeWindowId} isBlocked={blockedOwners.has(win.id)} {isMobile} {taskbarHeight} classes={merged}>
        <svelte:fragment slot="icon" let:win>
          <slot name="icon" {win}><ControlGlyph kind="window" /></slot>
        </svelte:fragment>
        <slot name="titleBarExtra" slot="titleBarExtra" let:win {win} />
        <slot name="loading" slot="loading"><LoadingGlyph /></slot>
        <!-- Forwarding a slot marks it filled, so the fallback is repeated here. -->
        <svelte:fragment slot="minimize-icon" let:win>
          <slot name="minimize-icon" {win}><ControlGlyph kind="minimize" /></slot>
        </svelte:fragment>
        <svelte:fragment slot="maximize-icon" let:win>
          <slot name="maximize-icon" {win}>
            <ControlGlyph kind={win.isMaximized ? "restore" : "maximize"} />
          </slot>
        </svelte:fragment>
        <svelte:fragment slot="close-icon" let:win>
          <slot name="close-icon" {win}><ControlGlyph kind="close" /></slot>
        </svelte:fragment>
      </PrismWindow>
    {/each}
  </div>
{/if}
