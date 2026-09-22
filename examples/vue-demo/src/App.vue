<script lang="ts" setup>
import { computed, defineComponent, h, onUnmounted, ref } from "vue";
import { PrismWindowManager, createWindowManager, useWindowManager } from "@prism-wm/vue";
import "@prism-wm/styles/prism.css";
import "./dock.css";
import logo from "../../../assets/prism-wm-logo-128.webp";
import AboutApp from "./AboutApp.vue";

const DemoApp = defineComponent({
  props: {
    message: { type: String, default: "" },
    _windowId: { type: String, default: "" },
  },
  setup: (p) => () => h("div", { class: "demo-body" }, [h("div", null, [h("h3", null, "Prism window"), h("p", null, p.message)]), h("div", null, [h("p", { class: "demo-label" }, "Confirm dialog"), h("div", { class: "demo-ask-row" }, [h("button", { class: "demo-btn", onClick: () => ask(p._windowId, "app") }, "Block the app"), h("button", { class: "demo-btn", onClick: () => ask(p._windowId, "window") }, "Block this window"), answers.value[p._windowId] ? h("span", { class: "demo-answer" }, ["Answered ", h("code", null, answers.value[p._windowId])]) : null])]), h("ul", { class: "demo-hints" }, [h("li", null, [h("b", null, "Drag"), " the title bar"]), h("li", null, [h("b", null, "Resize"), " from any edge"]), h("li", null, [h("b", null, "Double-click"), " to maximize"]), h("li", null, [h("b", null, "Drag to an edge"), " to snap"])])]),
});

const HeavyApp = defineComponent({
  props: { rows: { type: Number, default: 600 } },
  setup: (p) => () =>
    h(
      "div",
      { class: "heavy-grid" },
      Array.from({ length: p.rows }, (_, i) => h("div", { key: i, class: "heavy-cell" }, [h("span", null, `#${i}`), h("span", null, `payload-item-${i}.dat`), h("span", null, `${(i * 37) % 999} KB`)])),
    ),
});

const answers = ref<Record<string, string>>({});

const ConfirmDialog = defineComponent({
  props: { _windowId: { type: String, default: "" } },
  setup: (p) => () => h("div", { class: "demo-confirm" }, [h("p", null, "Everything you typed will be lost."), h("div", { class: "demo-confirm-actions" }, [h("button", { class: "demo-btn ghost", onClick: () => store.resolveDialog(p._windowId, "cancel") }, "Cancel"), h("button", { class: "demo-btn", onClick: () => store.resolveDialog(p._windowId, "no") }, "No"), h("button", { class: "demo-btn primary", onClick: () => store.resolveDialog(p._windowId, "yes") }, "Yes")])]),
});

function ask(ownerId: string, modality: "app" | "window") {
  store.openDialog("confirm", {
    title: "Discard changes?",
    ownerId,
    modality,
    width: 380,
    data: { ownerId },
    maskClosable: true,
    dismissValue: "cancel",
    onResult: (value) => {
      answers.value = { ...answers.value, [ownerId]: String(value) };
    },
  });
}

const isMobile = ref(false);
const mq = window.matchMedia("(max-width: 768px)");
const syncMobile = () => (isMobile.value = mq.matches);
syncMobile();
mq.addEventListener("change", syncMobile);
onUnmounted(() => mq.removeEventListener("change", syncMobile));

const DOCK_HEIGHT = 64;

const store = createWindowManager({ taskbarHeight: DOCK_HEIGHT });

const state = useWindowManager(store);
const minimized = computed(() => state.value.windows.filter((w) => w.isMinimized));

let n = 0;
function open() {
  n += 1;
  store.openWindow("demo", {
    title: `Demo Window ${n}`,
    allowMultiple: true,
    width: 460,
    height: 320,
    data: { message: `This is window #${n}, rendered by @prism-wm/vue.` },
  });
}

function openHeavy() {
  n += 1;
  store.openWindow("heavy", {
    title: `Heavy Window ${n}`,
    allowMultiple: true,
    width: 620,
    height: 460,
    data: { rows: 600 },
  });
}

function openAbout() {
  store.openWindow("about", { title: "About Prism", width: 480, height: 600 });
}

const appearance = ref<"redmond" | "cupertino">("redmond");
const looks = [
  { id: "redmond", label: "Redmond" },
  { id: "cupertino", label: "Cupertino" },
] as const;

const resolve = (win: { appId: string }) => (win.appId === "about" ? AboutApp : win.appId === "heavy" ? HeavyApp : win.appId === "confirm" ? ConfirmDialog : DemoApp);

open();
open();
</script>

<template>
  <PrismWindowManager :store="store" :appearance="appearance" :resolve-component="resolve" :is-mobile="isMobile" :taskbar-height="DOCK_HEIGHT" />

  <nav class="demo-bar" aria-label="Demo">
    <div class="demo-brand">
      <img class="demo-mark" :src="logo" alt="" />
      <span class="demo-pkg"><span class="demo-scope">@prism-wm/</span>vue</span>
    </div>
    <span class="demo-sep" />
    <button class="demo-btn primary" @click="open">New window</button>
    <button class="demo-btn" title="Opens a window with ~2000 nodes" @click="openHeavy">Heavy window</button>
    <span class="demo-sep" />
    <div class="demo-seg" role="group" aria-label="Window chrome">
      <button v-for="look in looks" :key="look.id" :aria-pressed="appearance === look.id" @click="appearance = look.id">
        {{ look.label }}
      </button>
    </div>
    <template v-if="minimized.length">
      <span class="demo-sep" />
      <button v-for="win in minimized" :key="win.id" class="demo-dock-item" :title="`Restore ${win.title}`" @click="store.focusWindow(win.id)">
        <span>{{ win.title }}</span>
      </button>
    </template>
  </nav>

  <button class="demo-info" title="About & license" aria-label="About and license" @click="openAbout">
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M12.838 17.638q.362-.363.362-.888t-.362-.888t-.888-.362t-.887.363t-.363.887t.363.888t.887.362t.888-.363M12 22q-2.075 0-3.9-.788t-3.175-2.137T2.788 15.9T2 12t.788-3.9t2.137-3.175T8.1 2.788T12 2t3.9.788t3.175 2.137T21.213 8.1T22 12t-.788 3.9t-2.137 3.175t-3.175 2.138T12 22m.1-14.3q.625 0 1.088.4t.462 1q0 .55-.337.975t-.763.8q-.575.5-1.012 1.1t-.438 1.35q0 .35.263.588t.612.237q.375 0 .638-.25t.337-.625q.1-.525.45-.937t.75-.788q.575-.55.988-1.2t.412-1.45q0-1.275-1.037-2.087T12.1 6q-.95 0-1.812.4T8.975 7.625q-.175.3-.112.638t.337.512q.35.2.725.125t.625-.425q.275-.375.688-.575t.862-.2" />
    </svg>
  </button>
</template>
