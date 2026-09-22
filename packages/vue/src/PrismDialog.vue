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
  <Teleport v-if="mount" :to="mount">
    <slot />

    <slot name="footer" :ok="handleOk" :cancel="handleCancel" :dismiss="handleDismiss">
      <div v-if="showFooter" class="pwm-dialog-footer" :class="[cls.dialogFooter, { 'pwm-dialog-footer-reversed': reverseButtons }]">
        <button v-if="okCancel" type="button" class="pwm-dialog-btn" :class="cls.dialogButton" @click="handleCancel">
          {{ cancelText }}
        </button>

        <button v-if="dismissText" type="button" class="pwm-dialog-btn" :class="cls.dialogButton" @click="handleDismiss">
          {{ dismissText }}
        </button>

        <button type="button" class="pwm-dialog-btn" :class="[okDanger ? cls.dialogButtonDanger : cls.dialogButtonPrimary, { 'pwm-dialog-btn-loading': loading }]" :disabled="loading || okDisabled" @click="handleOk">
          <span v-if="loading" class="pwm-dialog-spinner" aria-hidden="true" />
          <span v-else>{{ okText }}</span>
        </button>
      </div>
    </slot>
  </Teleport>
</template>

<script lang="ts" setup>
// A dialog written where it is used, with its content in the parent's scope.
import { ref, computed, watch, inject, nextTick, onBeforeUnmount, useSlots } from "vue";
import { PWM_EXTERNAL_DIALOG_APP_ID, type DialogModality, type WindowManagerStore } from "@prism-wm/core";

import { PRISM_CONTEXT, EMPTY_CLASSES, type PrismClassMap } from "./context";

const props = withDefaults(
  defineProps<{
    store?: WindowManagerStore;
    classes?: Partial<PrismClassMap>;
    visible?: boolean;
    title?: string;
    icon?: unknown;
    width?: number;
    modality?: DialogModality;
    ownerId?: string;
    maskClosable?: boolean;
    okText?: string;
    cancelText?: string;
    dismissText?: string;
    okCancel?: boolean;
    okDisabled?: boolean;
    okDanger?: boolean;
    loading?: boolean;
    reverseButtons?: boolean;
    closeOnOk?: boolean;
    footer?: boolean;
  }>(),
  {
    visible: false,
    title: "",
    width: 420,
    modality: "app",
    maskClosable: false,
    okText: "OK",
    cancelText: "Cancel",
    dismissText: "",
    okCancel: true,
    okDisabled: false,
    okDanger: false,
    loading: false,
    reverseButtons: false,
    closeOnOk: true,
    footer: true,
  },
);

const emit = defineEmits<{
  "update:visible": [value: boolean];
  ok: [];
  cancel: [];
  dismiss: [];
}>();

const ctx = inject(PRISM_CONTEXT, null);
const slots = useSlots();

const store = computed(() => props.store ?? ctx?.store ?? null);
const cls = computed(() => ({
  ...EMPTY_CLASSES,
  ...(ctx?.classes.value ?? {}),
  ...(props.classes ?? {}),
}));
const showFooter = computed(() => props.footer && !slots.footer);

// The node inside the window body that our slot renders into.
const mount = ref<HTMLElement | null>(null);

// Cleared before either close path acts, so the second finds nothing to do.
const windowId = ref<string | null>(null);

function open() {
  if (!store.value || windowId.value) return;

  const id = store.value.openDialog(PWM_EXTERNAL_DIALOG_APP_ID, {
    external: true,
    title: props.title,
    icon: props.icon ?? null,
    width: props.width,
    modality: props.modality,
    ownerId: props.ownerId,
    maskClosable: props.maskClosable,
    onResult: () => {
      // A cancel, not a dismiss: dismiss belongs to the third button alone.
      if (!windowId.value) return;
      windowId.value = null;
      mount.value = null;
      emit("cancel");
      emit("update:visible", false);
    },
  });

  windowId.value = id;
  void attach(id);
}

// Waits for the manager to commit the node before looking for it.
async function attach(id: string) {
  await nextTick();
  await nextTick();
  if (windowId.value !== id) return;
  mount.value = document.querySelector<HTMLElement>(`[data-pwm-slot="${id}"]`);
}

// Close from this side. Idempotent, and cannot re-enter through onResult.
function close() {
  const id = windowId.value;
  if (!id || !store.value) return;
  windowId.value = null;
  mount.value = null;
  // beginClose, not closeWindow, or the exit animation never plays.
  store.value.beginClose(id);
}

function handleOk() {
  emit("ok");
  if (props.closeOnOk) {
    close();
    emit("update:visible", false);
  }
}

function handleCancel() {
  close();
  emit("cancel");
  emit("update:visible", false);
}

function handleDismiss() {
  close();
  emit("dismiss");
  emit("update:visible", false);
}

watch(
  () => props.visible,
  (value) => (value ? open() : close()),
  { immediate: true },
);

// A title that changes while the dialog is open has to be pushed to the window.
watch(
  () => props.title,
  (value) => {
    if (windowId.value && store.value) store.value.updateWindowTitle(windowId.value, value);
  },
);

// A dialog whose parent goes away has nothing left to ask about.
onBeforeUnmount(close);

defineExpose({ close });
</script>
