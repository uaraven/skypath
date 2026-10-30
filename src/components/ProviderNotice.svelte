<script lang="ts">
  /**
   * A temporary banner for a third-party outage — currently CDS (Aladin Lite's
   * HiPS tiles behind the framing assistant's sky view).
   *
   * Dismissal is per page load, not persisted: the notice is meant to be
   * short-lived, and a reload is a fair moment to remind the user that the
   * preview may still be down.
   *
   * To remove it once the provider is back: delete this file and its
   * `<ProviderNotice />` line (plus the import) in `App.svelte`. Nothing else
   * refers to it.
   */
  let dismissed = $state(false)
</script>

{#if !dismissed}
  <div class="notice" role="status">
    <p>
      The target preview may be unavailable right now — its provider, the
      Strasbourg astronomical Data Center (CDS), is currently down. Everything
      else works as usual.
    </p>
    <button
      type="button"
      class="dismiss"
      aria-label="Dismiss notice"
      onclick={() => (dismissed = true)}>×</button
    >
  </div>
{/if}

<style>
  .notice {
    /* `.app` is a fixed-height flex column on wide screens; never squeeze this. */
    flex: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.5rem;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--chart-marker);
    border-radius: var(--radius-card);
    background: var(--bg-panel);
    font-size: 0.85rem;
  }

  .notice p {
    margin: 0;
  }

  .dismiss {
    flex: none;
    padding: 0 0.5rem;
    border-color: transparent;
    background: transparent;
    font-size: 1.25rem;
    line-height: 1;
  }
</style>
