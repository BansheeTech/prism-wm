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
  // A dialog written where it is used, with its content in the parent's scope.
  import { createEventDispatcher, onDestroy, tick } from "svelte";
  import { PWM_EXTERNAL_DIALOG_APP_ID, type DialogModality, type WindowManagerStore } from "@prism-wm/core";

  import { EMPTY_CLASSES, cx, getOptionalPrismContext, type PrismClassMap } from "./context.js";

  // Required unless the dialog sits inside a window and can read the context.
  export let store: WindowManagerStore | null = null;
  // Host classes for the button row.
  export let classes: Partial<PrismClassMap> = {};

  export let visible = false;
  export let title = "";
  export let icon: unknown = null;
  export let width = 420;
  export let modality: DialogModality = "app";
  export let ownerId: string | undefined = undefined;
  export let maskClosable = false;

  export let okText = "OK";
  export let cancelText = "Cancel";
  export let dismissText = "";
  export let okCancel = true;
  export let okDisabled = false;
  export let okDanger = false;
  export let loading = false;
  // OK first, Cancel last. For confirms whose OK is destructive.
  export let reverseButtons = false;
  // Set false when OK can fail, and close it yourself once it worked.
  export let closeOnOk = true;
  // Drop the built-in button row entirely.
  export let footer = true;

  const dispatch = createEventDispatcher<{ ok: void; cancel: void; dismiss: void }>();
  const ctx = getOptionalPrismContext();

  $: activeStore = store ?? ctx?.store ?? null;
  $: cls = { ...EMPTY_CLASSES, ...classes } as PrismClassMap;

  // A real element Svelte keeps updating; opening the dialog moves it into place.
  let holder: HTMLElement | null = null;

  // Cleared before either close path acts, so the second finds nothing to do.
  let windowId: string | null = null;

  async function open() {
    if (!activeStore || windowId) return;

    const id = activeStore.openDialog(PWM_EXTERNAL_DIALOG_APP_ID, {
      external: true,
      title,
      icon,
      width,
      modality,
      ownerId,
      maskClosable,
      onResult: () => {
        // A cancel, not a dismiss: dismiss belongs to the third button alone.
        if (!windowId) return;
        windowId = null;
        visible = false;
        dispatch("cancel");
      },
    });
    windowId = id;

    // Two ticks:
    await tick();
    await tick();
    if (windowId !== id) return;
    const mount = document.querySelector<HTMLElement>(`[data-pwm-slot="${id}"]`);
    if (mount && holder) mount.appendChild(holder);
  }

  // Close from this side. Idempotent, and cannot re-enter through onResult.
  function close() {
    const id = windowId;
    if (!id || !activeStore) return;
    windowId = null;
    // beginClose, not closeWindow, or the exit animation never plays.
    activeStore.beginClose(id);
  }

  function handleOk() {
    dispatch("ok");
    if (closeOnOk) {
      close();
      visible = false;
    }
  }

  function handleCancel() {
    close();
    visible = false;
    dispatch("cancel");
  }

  function handleDismiss() {
    close();
    visible = false;
    dispatch("dismiss");
  }

  $: if (visible) void open();
  $: if (!visible) close();

  // A title that changes while the dialog is open has to be pushed to the window.
  $: if (windowId && activeStore) activeStore.updateWindowTitle(windowId, title);

  // A dialog whose parent goes away has nothing left to ask about.
  onDestroy(close);
</script>

{#if visible}
  <div bind:this={holder} style="display: contents">
    <slot />

    <slot name="footer" ok={handleOk} cancel={handleCancel} dismiss={handleDismiss}>
      {#if footer}
        <div class={cx("pwm-dialog-footer", reverseButtons && "pwm-dialog-footer-reversed", cls.dialogFooter)}>
          {#if okCancel}
            <button type="button" class={cx("pwm-dialog-btn", cls.dialogButton)} on:click={handleCancel}>
              {cancelText}
            </button>
          {/if}

          {#if dismissText}
            <button type="button" class={cx("pwm-dialog-btn", cls.dialogButton)} on:click={handleDismiss}>
              {dismissText}
            </button>
          {/if}

          <button type="button" class={cx("pwm-dialog-btn", okDanger ? cls.dialogButtonDanger : cls.dialogButtonPrimary, loading && "pwm-dialog-btn-loading")} disabled={loading || okDisabled} on:click={handleOk}>
            {#if loading}
              <span class="pwm-dialog-spinner" aria-hidden="true"></span>
            {:else}
              <span>{okText}</span>
            {/if}
          </button>
        </div>
      {/if}
    </slot>
  </div>
{/if}
