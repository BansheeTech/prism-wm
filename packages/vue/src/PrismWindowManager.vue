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
  <div class="pwm-manager" :class="mergedClasses.manager">
    <!-- Plain v-if / v-for (no <Transition>): -->
    <div v-if="snapPreview" class="pwm-snap-preview" :class="[`pwm-snap-${snapPreview}`, mergedClasses.snapPreview]" :style="{ height: `calc(100% - ${taskbarHeight}px)` }" />

    <PrismWindow v-for="win in grounded" :key="win.id" :window="win" :is-active="win.id === activeWindowId" :is-blocked="blockedOwners.has(win.id)">
      <template #icon="slotProps">
        <slot name="icon" v-bind="slotProps" />
      </template>
      <template #titleBarExtra="slotProps">
        <slot name="titleBarExtra" v-bind="slotProps" />
      </template>
      <!-- Guarded like the icon slots below: -->
      <template v-if="$slots.loading" #loading>
        <slot name="loading" />
      </template>
      <template v-if="$slots['minimize-icon']" #minimize-icon="slotProps">
        <slot name="minimize-icon" v-bind="slotProps" />
      </template>
      <template v-if="$slots['maximize-icon']" #maximize-icon="slotProps">
        <slot name="maximize-icon" v-bind="slotProps" />
      </template>
      <template v-if="$slots['close-icon']" #close-icon="slotProps">
        <slot name="close-icon" v-bind="slotProps" />
      </template>
    </PrismWindow>
  </div>

  <!-- Teleports to <body>, like antd and MUI: a host stacking context would trap it. -->
  <Teleport to="body">
    <div v-if="scrimZ !== null || layered.length" class="pwm-modal-layer">
      <div v-if="scrimZ !== null" class="pwm-scrim" :class="{ 'pwm-scrim-closing': scrimClosing }" :style="{ zIndex: scrimZ }" @mousedown="store.dismissTopDialog()" />

      <PrismWindow v-for="win in layered" :key="win.id" :window="win" :is-active="win.id === activeWindowId" :is-blocked="blockedOwners.has(win.id)">
        <template #icon="slotProps">
          <slot name="icon" v-bind="slotProps" />
        </template>
        <template #titleBarExtra="slotProps">
          <slot name="titleBarExtra" v-bind="slotProps" />
        </template>
        <template v-if="$slots.loading" #loading>
          <slot name="loading" />
        </template>
        <template v-if="$slots['minimize-icon']" #minimize-icon="slotProps">
          <slot name="minimize-icon" v-bind="slotProps" />
        </template>
        <template v-if="$slots['maximize-icon']" #maximize-icon="slotProps">
          <slot name="maximize-icon" v-bind="slotProps" />
        </template>
        <template v-if="$slots['close-icon']" #close-icon="slotProps">
          <slot name="close-icon" v-bind="slotProps" />
        </template>
      </PrismWindow>
    </div>
  </Teleport>
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, provide, toRef, watch } from "vue";
import { prefersReducedMotion, PWM_CLOSE_ANIMATION_MS, RamManager, type AppConfig, type PrismAppearance, type WindowManagerStore, type WindowState } from "@prism-wm/core";
import { useWindowManager } from "./useWindowManager";
import { DEFAULT_LABELS, EMPTY_CLASSES, PRISM_CONTEXT, type PrismClassMap, type PrismContext, type WindowLabels } from "./context";
import PrismWindow from "./PrismWindow.vue";

const props = withDefaults(
  defineProps<{
    store: WindowManagerStore;
    resolveComponent: (window: WindowState) => unknown;
    resolveConfig?: (window: WindowState) => Partial<AppConfig> | undefined;
    taskbarHeight?: number;
    isMobile?: boolean;
    labels?: Partial<WindowLabels>;
    // Host classes layered onto Prism's own. Pair with prism-structure.css.
    classes?: Partial<PrismClassMap>;
    // Enable the memory-pressure RAM manager for minimized windows.
    enableRamManager?: boolean;
    // Global on purpose: nobody wants one window in each appearance.
    appearance?: PrismAppearance;
  }>(),
  {
    resolveConfig: undefined,
    taskbarHeight: 0,
    isMobile: false,
    labels: undefined,
    classes: undefined,
    enableRamManager: true,
    appearance: "redmond",
  },
);

const state = useWindowManager(props.store);

// Every window, minimized included.
const renderedWindows = computed(() => state.value.windows);
const activeWindowId = computed(() => state.value.activeWindowId);
const snapPreview = computed(() => state.value.snapPreview);

// `app` paints a sheet under the topmost dialog; `window` inerts the owner.
const dialogs = computed(() => state.value.windows.filter((w) => w.kind === "dialog" && !w.isClosing));
// The scrim outlives its dialog by one animation, or the backdrop blinks away.
const appModal = computed(() => state.value.windows.filter((w) => w.kind === "dialog" && (w.modality ?? "app") === "app"));
const liveAppModal = computed(() => appModal.value.filter((d) => !d.isClosing));
const scrimZ = computed(() => {
  const source = liveAppModal.value.length ? liveAppModal.value : appModal.value;
  return source.length ? Math.min(...source.map((d) => d.zIndex)) - 1 : null;
});
const scrimClosing = computed(() => appModal.value.length > 0 && liveAppModal.value.length === 0);
// App-modal dialogs are lifted out so the host's chrome cannot cover them.
const inModalLayer = (w: WindowState) => w.kind === "dialog" && (w.modality ?? "app") === "app";
const layered = computed(() => renderedWindows.value.filter(inModalLayer));
const grounded = computed(() => renderedWindows.value.filter((w) => !inModalLayer(w)));

const blockedOwners = computed(() => new Set(dialogs.value.filter((d) => d.modality === "window" && d.ownerId).map((d) => d.ownerId as string)));

// Recomputed, so a host swapping themes repaints without remounting the manager.
const mergedClasses = computed<PrismClassMap>(() => ({
  ...EMPTY_CLASSES,
  ...props.classes,
}));

const ram = props.enableRamManager ? new RamManager() : null;

// Windows linger for one exit animation, so the close is pure CSS in all three.
const closeTimers = new Map<string, ReturnType<typeof setTimeout>>();

// Just the store's protocol:
async function requestClose(id: string) {
  await props.store.requestClose(id);
}

// Driven off isClosing, so a close from a taskbar animates too.
watch(
  () => state.value.windows,
  (windows) => {
    for (const win of windows) {
      if (!win.isClosing || closeTimers.has(win.id)) continue;
      if (prefersReducedMotion()) {
        props.store.closeWindow(win.id);
        continue;
      }
      closeTimers.set(
        win.id,
        setTimeout(() => {
          closeTimers.delete(win.id);
          props.store.closeWindow(win.id);
        }, PWM_CLOSE_ANIMATION_MS),
      );
    }
  },
  { immediate: true },
);

const context: PrismContext = {
  store: props.store,
  ram,
  resolveComponent: props.resolveComponent,
  resolveConfig: props.resolveConfig ?? (() => undefined),
  isMobile: toRef(props, "isMobile"),
  appearance: toRef(props, "appearance"),
  taskbarHeight: toRef(props, "taskbarHeight"),
  labels: { ...DEFAULT_LABELS, ...props.labels },
  classes: mergedClasses,
  requestClose,
};
provide(PRISM_CONTEXT, context);

function onKeyDown(e: KeyboardEvent) {
  // Escape belongs to the topmost dialog, not to the window behind it.
  if (e.key === "Escape") {
    const open = props.store.dialogs;
    if (open.length) {
      const top = open.reduce((m, d) => (d.zIndex > m.zIndex ? d : m));
      void requestClose(top.id);
      e.preventDefault();
      return;
    }
  }
  const active = activeWindowId.value;
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
    if (!id || id === props.store.activeWindowId || !props.store.getWindowById(id)) return;
    props.store.focusWindow(id);
  });
}

onMounted(() => {
  document.addEventListener("keydown", onKeyDown);
  window.addEventListener("blur", onWindowBlur);
});
onUnmounted(() => {
  document.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("blur", onWindowBlur);
  if (iframeFocusTick) clearTimeout(iframeFocusTick);
  closeTimers.forEach(clearTimeout);
  closeTimers.clear();
  ram?.dispose();
});
</script>
