<script lang="ts">
  import { parseHorizon } from '../lib/horizon'

  interface Props {
    /** Raw NINA horizon text; empty means a flat 0° horizon. */
    text: string
  }

  let { text = $bindable() }: Props = $props()

  let fileInput = $state<HTMLInputElement | null>(null)
  let fileError = $state<string | null>(null)

  const parsed = $derived(parseHorizon(text))

  /** Issues are listed in full up to this many; beyond it the rest are counted. */
  const MAX_LISTED_ISSUES = 5

  async function loadFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return

    fileError = null
    try {
      text = await file.text()
    } catch {
      fileError = `Could not read ${file.name}.`
    }
    // Reset so re-picking the same file after an edit fires change again.
    input.value = ''
  }

  function clear() {
    text = ''
    fileError = null
  }
</script>

<div class="horizon">
  <div class="actions">
    <button type="button" onclick={() => fileInput?.click()}>
      Upload horizon file
    </button>
    <button type="button" onclick={clear} disabled={text === ''}>Clear</button>
    <input
      class="file"
      type="file"
      accept=".txt,.hrz,text/plain"
      bind:this={fileInput}
      onchange={loadFile}
    />
  </div>

  <label>
    <span>…or paste it here</span>
    <textarea
      bind:value={text}
      rows="8"
      spellcheck="false"
      placeholder={'# azimuth altitude, one pair per line\n0 15\n90 22\n180 8'}
    ></textarea>
  </label>

  <p class="summary" class:warn={parsed.issues.length > 0}>
    {#if text.trim() === ''}
      No horizon — a flat horizon at 0° will be used.
    {:else}
      {parsed.points.length}
      {parsed.points.length === 1 ? 'point' : 'points'}
      {#if parsed.issues.length > 0}
        · {parsed.issues.length}
        {parsed.issues.length === 1 ? 'problem' : 'problems'}
      {/if}
    {/if}
  </p>

  {#if fileError}
    <p class="summary warn">{fileError}</p>
  {/if}

  {#if parsed.issues.length > 0}
    <ul class="issues">
      {#each parsed.issues.slice(0, MAX_LISTED_ISSUES) as issue (issue.line)}
        <li>
          <span class="line">line {issue.line}</span>
          {issue.message}
        </li>
      {/each}
      {#if parsed.issues.length > MAX_LISTED_ISSUES}
        <li class="more">
          …and {parsed.issues.length - MAX_LISTED_ISSUES} more
        </li>
      {/if}
    </ul>
  {/if}
</div>

<style>
  .horizon {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .actions {
    display: flex;
    gap: 0.5rem;
  }

  .file {
    display: none;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.8rem;
    color: var(--text-dim);
  }

  textarea {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    line-height: 1.5;
    resize: vertical;
  }

  .summary {
    font-size: 0.8rem;
    color: var(--text-dim);
  }

  .summary.warn {
    color: var(--accent-bright);
  }

  .issues {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    font-size: 0.75rem;
    color: var(--text-dim);
  }

  .line {
    font-family: var(--font-mono);
    color: var(--accent-bright);
    margin-right: 0.4rem;
  }

  .more {
    color: var(--text-faint);
  }
</style>
