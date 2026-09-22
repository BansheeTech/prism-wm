<script lang="ts">
  import { PrismWindowManager, createWindowManager, toReadable } from "@prism-wm/svelte";
  import "@prism-wm/styles/prism.css";
  import "./dock.css";
  import logo from "../../../assets/prism-wm-logo-128.webp";
  import DemoApp from "./DemoApp.svelte";
  import HeavyApp from "./HeavyApp.svelte";
  import AboutApp from "./AboutApp.svelte";
  import ConfirmDialog from "./ConfirmDialog.svelte";
  import { bindStore } from "./dialogs";
  import { onDestroy } from "svelte";

  let isMobile = false;
  const mq = window.matchMedia("(max-width: 768px)");
  const syncMobile = () => (isMobile = mq.matches);
  syncMobile();
  mq.addEventListener("change", syncMobile);
  onDestroy(() => mq.removeEventListener("change", syncMobile));

  const DOCK_HEIGHT = 64;

  const store = createWindowManager({ taskbarHeight: DOCK_HEIGHT });
  bindStore(store);

  const state = toReadable(store);
  $: minimized = $state.windows.filter((w) => w.isMinimized);

  function open() {
    const n = store.windows.length + 1;
    store.openWindow("demo", {
      title: `Demo Window ${n}`,
      allowMultiple: true,
      width: 460,
      height: 320,
      data: { message: `This is window #${n}, rendered by @prism-wm/svelte.` },
    });
  }

  function openHeavy() {
    const n = store.windows.length + 1;
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

  let appearance: "redmond" | "cupertino" = "redmond";
  const looks = [
    { id: "redmond", label: "Redmond" },
    { id: "cupertino", label: "Cupertino" },
  ] as const;

  const resolve = (win: { appId: string }) => (win.appId === "about" ? AboutApp : win.appId === "heavy" ? HeavyApp : win.appId === "confirm" ? ConfirmDialog : DemoApp);

  open();
  open();
</script>

{#key appearance}
  <PrismWindowManager {store} {appearance} resolveComponent={resolve} {isMobile} taskbarHeight={DOCK_HEIGHT} />
{/key}

<nav class="demo-bar" aria-label="Demo">
  <div class="demo-brand">
    <img class="demo-mark" src={logo} alt="" />
    <span class="demo-pkg"><span class="demo-scope">@prism-wm/</span>svelte</span>
  </div>
  <span class="demo-sep"></span>
  <button class="demo-btn primary" on:click={open}>New window</button>
  <button class="demo-btn" title="Opens a window with ~2000 nodes" on:click={openHeavy}> Heavy window </button>
  <span class="demo-sep"></span>
  <div class="demo-seg" role="group" aria-label="Window chrome">
    {#each looks as look (look.id)}
      <button aria-pressed={appearance === look.id} on:click={() => (appearance = look.id)}>
        {look.label}
      </button>
    {/each}
  </div>
  {#if minimized.length}
    <span class="demo-sep"></span>
    {#each minimized as win (win.id)}
      <button class="demo-dock-item" title="Restore {win.title}" on:click={() => store.focusWindow(win.id)}>
        <span>{win.title}</span>
      </button>
    {/each}
  {/if}
</nav>

<button class="demo-info" title="About & license" aria-label="About and license" on:click={openAbout}>
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path fill="currentColor" d="M12.838 17.638q.362-.363.362-.888t-.362-.888t-.888-.362t-.887.363t-.363.887t.363.888t.887.362t.888-.363M12 22q-2.075 0-3.9-.788t-3.175-2.137T2.788 15.9T2 12t.788-3.9t2.137-3.175T8.1 2.788T12 2t3.9.788t3.175 2.137T21.213 8.1T22 12t-.788 3.9t-2.137 3.175t-3.175 2.138T12 22m.1-14.3q.625 0 1.088.4t.462 1q0 .55-.337.975t-.763.8q-.575.5-1.012 1.1t-.438 1.35q0 .35.263.588t.612.237q.375 0 .638-.25t.337-.625q.1-.525.45-.937t.75-.788q.575-.55.988-1.2t.412-1.45q0-1.275-1.037-2.087T12.1 6q-.95 0-1.812.4T8.975 7.625q-.175.3-.112.638t.337.512q.35.2.725.125t.625-.425q.275-.375.688-.575t.862-.2" />
  </svg>
</button>
