/*
 * Prism Window Manager (@prism-wm), Vue adapter tests
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
 * <PrismDialog>: a dialog declared in a parent's template, whose content stays
 * in that parent's scope. The point of these tests is that the slot really is
 * the parent's, that it sees the parent's reactive state, and that every route out
 * of the dialog agrees with the parent's v-model.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { defineComponent, h, ref, nextTick } from "vue";
import { mount, type VueWrapper } from "@vue/test-utils";
import { createWindowManager } from "../src/useWindowManager";
import PrismWindowManager from "../src/PrismWindowManager.vue";
import PrismDialog from "../src/PrismDialog.vue";
import { PWM_CLOSE_ANIMATION_MS, centerDialog, type WindowManagerStore } from "@prism-wm/core";

const last = <T,>(a: T[]): T | undefined => a[a.length - 1];

async function flushClose() {
  await new Promise((r) => setTimeout(r, PWM_CLOSE_ANIMATION_MS + 30));
  await nextTick();
}

const mounted: VueWrapper[] = [];
function track(w: VueWrapper) {
  mounted.push(w);
  return w;
}

function mountHost(store: WindowManagerStore, dialogProps: Record<string, unknown> = {}, slot?: (state: { name: ReturnType<typeof ref<string>> }) => unknown) {
  const events: string[] = [];
  const name = ref("Documents");
  const visible = ref(false);

  const Host = defineComponent({
    setup() {
      return () => [
        h(PrismWindowManager, { store, resolveComponent: () => null }),
        h(
          PrismDialog,
          {
            store,
            visible: visible.value,
            "onUpdate:visible": (v: boolean) => (visible.value = v),
            onOk: () => events.push("ok"),
            onCancel: () => events.push("cancel"),
            onDismiss: () => events.push("dismiss"),
            ...dialogProps,
          },
          { default: () => (slot ? slot({ name }) : h("p", { class: "body" }, name.value)) },
        ),
      ];
    },
  });

  const wrapper = mount(Host, { attachTo: document.body });
  track(wrapper);
  return { wrapper, events, name, visible };
}

async function open(visible: { value: boolean }) {
  visible.value = true;
  await nextTick();
  await nextTick();
  await nextTick();
}

describe("PrismDialog", () => {
  let store: WindowManagerStore;
  beforeEach(() => {
    store = createWindowManager({
      getViewport: () => ({ width: 1024, height: 768 }),
    });
  });

  afterEach(() => {
    mounted.splice(0).forEach((w) => w.unmount());
    document.body.innerHTML = "";
  });

  it("opens no window until visible turns true", async () => {
    const { visible } = mountHost(store);
    expect(store.getState().windows).toHaveLength(0);

    await open(visible);
    expect(store.getState().windows).toHaveLength(1);
  });

  it("opens a dialog, not a plain window", async () => {
    const { visible } = mountHost(store, { title: "Rename Folder" });
    await open(visible);

    const win = store.getState().windows[0];
    expect(win.kind).toBe("dialog");
    expect(win.external).toBe(true);
    expect(win.title).toBe("Rename Folder");
  });

  it("renders the slot inside the window body", async () => {
    const { wrapper, visible } = mountHost(store);
    await open(visible);

    const slot = document.querySelector(".pwm-window-slot");
    expect(slot).not.toBeNull();
    expect(slot?.querySelector(".body")?.textContent).toBe("Documents");
    wrapper.unmount();
  });

  it("keeps the slot in the parent's scope, which is the whole point", async () => {
    const { wrapper, visible, name } = mountHost(store);
    await open(visible);

    expect(document.querySelector(".body")?.textContent).toBe("Documents");

    name.value = "Pictures";
    await nextTick();
    expect(document.querySelector(".body")?.textContent).toBe("Pictures");
    wrapper.unmount();
  });

  it("closes the window when visible turns false", async () => {
    const { visible } = mountHost(store);
    await open(visible);
    expect(store.getState().windows).toHaveLength(1);

    visible.value = false;
    await nextTick();
    await flushClose();
    expect(store.getState().windows).toHaveLength(0);
  });

  it("never asks resolveComponent for an external dialog", async () => {
    let asked = 0;
    const Host = defineComponent({
      setup() {
        const visible = ref(true);
        return () => [
          h(PrismWindowManager, {
            store,
            resolveComponent: () => {
              asked++;
              return null;
            },
          }),
          h(PrismDialog, { store, visible: visible.value }, { default: () => h("p", "x") }),
        ];
      },
    });

    track(mount(Host, { attachTo: document.body }));
    await nextTick();
    await nextTick();
    await nextTick();

    expect(store.getState().windows).toHaveLength(1);
    expect(asked).toBe(0);
  });

  describe("the built-in button row", () => {
    it("emits ok and closes by default", async () => {
      const { events, visible } = mountHost(store, { okText: "Rename" });
      await open(visible);

      const ok = last([...document.querySelectorAll<HTMLButtonElement>(".pwm-dialog-btn")]);
      expect(ok?.textContent?.trim()).toBe("Rename");
      ok?.click();
      await nextTick();

      expect(events).toEqual(["ok"]);
      expect(visible.value).toBe(false);
    });

    it("stays open on ok when closeOnOk is false", async () => {
      const { events, visible } = mountHost(store, { closeOnOk: false });
      await open(visible);

      last([...document.querySelectorAll<HTMLButtonElement>(".pwm-dialog-btn")])?.click();
      await nextTick();

      expect(events).toEqual(["ok"]);
      expect(visible.value).toBe(true);
      expect(store.getState().windows).toHaveLength(1);
    });

    it("emits cancel and closes", async () => {
      const { events, visible } = mountHost(store);
      await open(visible);

      document.querySelector<HTMLButtonElement>(".pwm-dialog-btn")?.click();
      await nextTick();
      await flushClose();

      expect(events).toEqual(["cancel"]);
      expect(visible.value).toBe(false);
      expect(store.getState().windows).toHaveLength(0);
    });

    it("hides Cancel when ok-cancel is false", async () => {
      const { visible } = mountHost(store, { okCancel: false });
      await open(visible);

      expect(document.querySelectorAll(".pwm-dialog-btn")).toHaveLength(1);
    });

    it("disables OK while loading or ok-disabled", async () => {
      const { visible } = mountHost(store, { okDisabled: true });
      await open(visible);

      const ok = last([...document.querySelectorAll<HTMLButtonElement>(".pwm-dialog-btn")]);
      expect(ok?.disabled).toBe(true);
    });

    it("flips the row for reverseButtons rather than reordering the DOM", async () => {
      const { visible } = mountHost(store, { reverseButtons: true });
      await open(visible);

      const footer = document.querySelector(".pwm-dialog-footer");
      expect(footer?.classList.contains("pwm-dialog-footer-reversed")).toBe(true);
      expect(footer?.firstElementChild?.textContent?.trim()).toBe("Cancel");
    });

    it("can be replaced wholesale by a footer slot", async () => {
      const visible = ref(true);
      const Host = defineComponent({
        setup: () => () => [
          h(PrismWindowManager, { store, resolveComponent: () => null }),
          h(
            PrismDialog,
            { store, visible: visible.value },
            {
              default: () => h("p", "x"),
              footer: () => h("button", { class: "mine" }, "Mine"),
            },
          ),
        ],
      });
      track(mount(Host, { attachTo: document.body }));
      await nextTick();
      await nextTick();
      await nextTick();

      expect(document.querySelector(".mine")).not.toBeNull();
      expect(document.querySelector(".pwm-dialog-footer")).toBeNull();
    });
  });

  it("reports a CANCEL when the window is closed from outside", async () => {
    const { events, visible } = mountHost(store, { dismissText: "Don't Save" });
    await open(visible);

    store.closeWindow(store.getState().windows[0].id);
    await flushClose();

    expect(events).toEqual(["cancel"]);
    expect(events).not.toContain("dismiss");
    expect(visible.value).toBe(false);
  });

  it("reports a dismissal only from the dismiss button", async () => {
    const { events, visible } = mountHost(store, { dismissText: "Don't Save" });
    await open(visible);

    const dismiss = [...document.querySelectorAll<HTMLButtonElement>(".pwm-dialog-btn")].find((b) => b.textContent?.trim() === "Don't Save");
    dismiss?.click();
    await nextTick();
    await flushClose();

    expect(events).toEqual(["dismiss"]);
  });

  it("pushes a title change to the open window", async () => {
    const visible = ref(true);
    const title = ref("Step 1");
    const Host = defineComponent({
      setup: () => () => [h(PrismWindowManager, { store, resolveComponent: () => null }), h(PrismDialog, { store, visible: visible.value, title: title.value }, { default: () => h("p", "x") })],
    });
    track(mount(Host, { attachTo: document.body }));
    await nextTick();
    await nextTick();
    await nextTick();

    expect(store.getState().windows[0].title).toBe("Step 1");
    title.value = "Step 2";
    await nextTick();
    expect(store.getState().windows[0].title).toBe("Step 2");
  });

  it("re-centres once the host's content has landed", async () => {
    const { visible } = mountHost(store, { width: 400 });
    await open(visible);

    const win = store.getState().windows[0];
    const slot = document.querySelector<HTMLElement>(".pwm-window-slot");
    expect(slot).not.toBeNull();

    store.setMeasuredHeight(win.id, 500);
    const at = centerDialog(400, 500, { width: 1024, height: 768 }, null);
    store.updateWindowPosition(win.id, at.x, at.y);

    const placed = store.getState().windows[0];
    expect(placed.height).toBe(500);
    expect(placed.y).toBe(at.y);
    expect(placed.y + placed.height / 2).toBeCloseTo(768 / 2, 0);
  });

  it("marks the window as a dialog so CSS can fade it instead", async () => {
    const { visible } = mountHost(store);
    await open(visible);

    const el = document.querySelector(".pwm-window");
    expect(el?.classList.contains("pwm-dialog")).toBe(true);
  });

  it("keeps the scrim up while the dialog fades out", async () => {
    const { visible } = mountHost(store);
    await open(visible);
    expect(document.querySelector(".pwm-scrim")).not.toBeNull();

    void store.requestClose(store.getState().windows[0].id);
    await nextTick();
    await nextTick();

    const scrim = document.querySelector(".pwm-scrim");
    expect(scrim).not.toBeNull();
    expect(scrim?.classList.contains("pwm-scrim-closing")).toBe(true);

    await flushClose();
    expect(document.querySelector(".pwm-scrim")).toBeNull();
  });

  it("closes its window when the parent unmounts", async () => {
    const managerWrapper = track(
      mount(PrismWindowManager, {
        attachTo: document.body,
        props: { store, resolveComponent: () => null },
      }),
    );

    const visible = ref(true);
    const DialogOnly = defineComponent({
      setup: () => () => h(PrismDialog, { store, visible: visible.value }, { default: () => h("p", "x") }),
    });
    const dialogWrapper = mount(DialogOnly, { attachTo: document.body });
    await nextTick();
    await nextTick();
    await nextTick();
    expect(store.getState().windows).toHaveLength(1);

    dialogWrapper.unmount();
    await flushClose();
    expect(store.getState().windows).toHaveLength(0);
    managerWrapper.unmount();
  });
});
