<script lang="ts">
  import { answers, ask } from "./dialogs";

  export let message = "";
  export let _windowId = "";
</script>

<div class="demo-body">
  <div>
    <h3>Prism window</h3>
    <p>{message}</p>
  </div>
  <div>
    <p class="demo-label">Confirm dialog</p>
    <div class="demo-ask-row">
      <button class="demo-btn" on:click={() => ask(_windowId, "app")}> Block the app </button>
      <button class="demo-btn" on:click={() => ask(_windowId, "window")}> Block this window </button>
      {#if $answers[_windowId]}
        <span class="demo-answer">
          Answered <code>{$answers[_windowId]}</code>
        </span>
      {/if}
    </div>
  </div>
  <ul class="demo-hints">
    <li><b>Drag</b> the title bar</li>
    <li><b>Resize</b> from any edge</li>
    <li><b>Double-click</b> to maximize</li>
    <li><b>Drag to an edge</b> to snap</li>
  </ul>
</div>
