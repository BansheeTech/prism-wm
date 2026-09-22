<script lang="ts">
  import { pick } from "./dialogs";

  export let _windowId = "";
</script>

<div class="demo-confirm">
  <p>Everything you typed will be lost.</p>
  <div class="demo-confirm-actions">
    <button class="demo-btn ghost" on:click={() => pick(_windowId, "cancel")}> Cancel </button>
    <button class="demo-btn" on:click={() => pick(_windowId, "no")}>No</button>
    <button class="demo-btn primary" on:click={() => pick(_windowId, "yes")}> Yes </button>
  </div>
</div>
