<script lang="ts">
  export let rows = 600;
</script>

<div class="heavy-grid">
  {#each { length: rows } as _, i (i)}
    <div class="heavy-cell">
      <span>#{i}</span>
      <span>payload-item-{i}.dat</span>
      <span>{(i * 37) % 999} KB</span>
    </div>
  {/each}
</div>
