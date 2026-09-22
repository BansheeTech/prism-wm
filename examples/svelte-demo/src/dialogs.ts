import { writable } from "svelte/store";
import type { WindowManagerStore } from "@prism-wm/core";

export const answers = writable<Record<string, string>>({});

let store: WindowManagerStore;
export function bindStore(s: WindowManagerStore) {
  store = s;
}

export function ask(ownerId: string, modality: "app" | "window") {
  store.openDialog("confirm", {
    title: "Discard changes?",
    ownerId,
    modality,
    width: 380,
    data: { ownerId },
    maskClosable: true,
    dismissValue: "cancel",
    onResult: (value) =>
      answers.update((a) => ({ ...a, [ownerId]: String(value) })),
  });
}

export function pick(dialogId: string, value: string) {
  store.resolveDialog(dialogId, value);
}
