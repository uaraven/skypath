<script lang="ts">
  /**
   * The two-panel shell: observatories on the left, a Search / Results tabview
   * on the right (`.plan/ui-mocks.md`).
   *
   * App owns the cross-cutting selections — which object, which date — because
   * both tabs read them and the Search tab writes one of them.
   */
  import { untrack } from 'svelte'
  import skypathIcon from '../images/skypath.svg'
  import HelpDialog from './components/HelpDialog.svelte'
  import Icon from './components/Icon.svelte'
  import ObjectSearch from './components/ObjectSearch.svelte'
  import ObservatoryManager from './components/ObservatoryManager.svelte'
  import ResultsPanel from './components/ResultsPanel.svelte'
  import type { SkyObject } from './lib/astro/types'
  import { objectById } from './lib/catalog'
  import { horizonFromText } from './lib/horizon'
  import {
    observatories,
    observatoryLocation,
    selectedObservatory,
  } from './lib/observatory'
  import {
    formatIsoDate,
    session as sessionStore,
    SessionStore,
  } from './lib/session'

  const version = __APP_VERSION__

  type Tab = 'search' | 'results'

  interface Props {
    /** Defaults to the app-wide session; tests inject one with its own storage. */
    session?: SessionStore
  }

  let { session = sessionStore }: Props = $props()

  let helpOpen = $state(false)

  const selected = $derived(selectedObservatory($observatories))

  const horizon = $derived(horizonFromText(selected.horizonText))

  const location = $derived(observatoryLocation(selected))

  // The saved object and night, restored before first paint so the app never
  // renders "nothing chosen" and then flips. `untrack` because the store
  // instance is fixed for the life of the component — only reading it here
  // would otherwise look like a reactive dependency on the prop.
  const restored =
    untrack(() => objectById(session.state.objectId ?? '')) ?? null

  // Landing on Search with the previous object silently loaded would hide the
  // thing that was restored; if there is one, open it.
  let tab = $state<Tab>(restored ? 'results' : 'search')
  let object = $state<SkyObject | null>(restored)
  // Held here, not in ObjectSearch, because the tabview unmounts the inactive
  // tab — the search term has to survive a trip to Results and back.
  let query = $state('')
  // `<input type="date">` speaks `YYYY-MM-DD`; keeping the state in that form
  // avoids round-tripping a Date through the local/UTC boundary on every edit.
  let dateText = $state(
    untrack(() => formatIsoDate(session.dateOr(new Date()))),
  )

  const date = $derived(parseDateText(dateText))

  // Every change is written straight back. There is no explicit save anywhere
  // in the app, and a browser tab is as likely to be closed as navigated away.
  $effect(() => session.setObjectId(object?.id ?? null))
  $effect(() => session.setDate(date))

  /**
   * The date input's value as a local date. Parsed here rather than with
   * `parseIsoDate` because a half-typed or cleared input is a normal state for
   * `<input type="date">` and has to fall back to today, not to null.
   */
  function parseDateText(text: string): Date {
    const [year, month, day] = text.split('-').map(Number)
    if (!year || !month || !day) return new Date()
    return new Date(year, month - 1, day)
  }

  function choose(chosen: SkyObject) {
    object = chosen
    tab = 'results'
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'search', label: 'Search' },
    { id: 'results', label: 'Results' },
  ]

  /**
   * Arrow-key navigation for the tablist, per the ARIA tabs pattern: the
   * tablist is one tab stop (roving `tabindex`), and the arrows move between
   * the tabs inside it. Selection follows focus, which is the right call for
   * two cheap-to-render panels.
   */
  function onTabKey(event: KeyboardEvent) {
    const current = TABS.findIndex((t) => t.id === tab)
    const next = {
      ArrowRight: (current + 1) % TABS.length,
      ArrowLeft: (current - 1 + TABS.length) % TABS.length,
      Home: 0,
      End: TABS.length - 1,
    }[event.key]
    if (next === undefined) return

    event.preventDefault()
    tab = TABS[next].id
    // The tab that just became selected is the one holding the tab stop, so
    // focus has to follow or the next Tab press leaves the tablist entirely.
    const tablist = event.currentTarget as HTMLElement
    tablist.querySelectorAll<HTMLElement>('[role="tab"]')[next].focus()
  }
</script>

<div class="app">
  <header class="masthead">
    <div class="title">
      <img class="logo" src={skypathIcon} alt="" width="56" height="56" />
      <div>
        <h1>SkyPath</h1>
        <p class="tagline">
          Know what's up tonight — and when it clears your horizon
        </p>
      </div>
    </div>
    <button type="button" class="help-button" onclick={() => (helpOpen = true)}>
      <Icon name="help" size={16} />
      Help
    </button>
  </header>

  <main>
    <ObservatoryManager />

    <section class="panel workspace">
      <div class="tabbar">
        <!-- The tabs carry the roving tabindex; the list itself is never a stop. -->
        <div
          role="tablist"
          aria-label="Views"
          tabindex="-1"
          onkeydown={onTabKey}
        >
          {#each TABS as { id, label } (id)}
            <button
              type="button"
              role="tab"
              id="tab-{id}"
              aria-selected={tab === id}
              aria-controls="panel-{id}"
              tabindex={tab === id ? 0 : -1}
              class:active={tab === id}
              onclick={() => (tab = id)}>{label}</button
            >
          {/each}
        </div>

        <label class="date">
          <span>Night of</span>
          <input type="date" bind:value={dateText} />
        </label>
      </div>

      {#if tab === 'search'}
        <div role="tabpanel" id="panel-search" aria-labelledby="tab-search">
          <ObjectSearch
            {location}
            {horizon}
            {date}
            onselect={choose}
            bind:query
          />
        </div>
      {:else}
        <div role="tabpanel" id="panel-results" aria-labelledby="tab-results">
          <ResultsPanel
            {object}
            {location}
            {horizon}
            {date}
            observatoryName={selected.name}
          />
        </div>
      {/if}
    </section>
  </main>

  <footer class="colophon">
    <p>
      SkyPath v{version}.
      <a href="https://voronin.cc/astro">https://voronin.cc/astro</a>
    </p>
  </footer>

  {#if helpOpen}
    <HelpDialog onclose={() => (helpOpen = false)} />
  {/if}
</div>

<style>
  .app {
    max-width: 1400px;
    margin: 0 auto;
    padding: 2rem 1rem;
  }

  .masthead {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .title {
    display: flex;
    align-items: center;
    gap: 0.85rem;
  }

  .logo {
    flex: none;
    width: 3.5rem;
    height: 3.5rem;
    border-radius: 0.75rem;
  }

  .help-button {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    flex: none;
  }

  .tagline {
    color: var(--text-faint);
    font-family: var(--font-mono);
    font-size: 0.75rem;
  }

  .colophon {
    margin-top: 2rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border);
    color: var(--text-dim);
    font-family: var(--font-mono);
    font-size: 0.8rem;
    text-align: center;
  }

  /* The mock's vertical split: a fixed-width site list, charts taking the rest. */
  main {
    display: grid;
    grid-template-columns: 15rem minmax(0, 1fr);
    align-items: start;
    gap: 1.5rem;
  }

  .workspace {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .tabbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    border-bottom: 1px solid var(--border);
  }

  [role='tablist'] {
    display: flex;
    gap: 0.25rem;
  }

  /* Tabs, not pills: strip the shared button's border and radius and mark the
     active one with an underline that sits on the tabbar's divider. */
  [role='tab'] {
    padding: 0.5rem 1rem;
    border: 0;
    border-bottom: 2px solid transparent;
    border-radius: 0;
    background: transparent;
    color: var(--text-dim);
    /* Overlap the 1px divider so the underline merges with it. */
    margin-bottom: -1px;
  }

  [role='tab']:hover {
    background: transparent;
    color: var(--text);
    border-bottom-color: var(--border);
  }

  [role='tab'].active {
    color: var(--accent-bright);
    border-bottom-color: var(--accent-bright);
  }

  [role='tab']:focus-visible {
    outline: 2px solid var(--accent-bright);
    outline-offset: -2px;
  }

  .date {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
    color: var(--text-dim);
  }

  .date input {
    font-family: var(--font-mono);
    font-size: 0.8rem;
  }

  /* Below the split the list stacks above the workspace rather than squeezing. */
  @media (max-width: 800px) {
    main {
      /*
       * `minmax(0, 1fr)`, not `1fr`: a bare `1fr` track has an automatic
       * minimum of `auto`, so it refuses to shrink below its content and the
       * scrollable altitude chart pushed the whole page wider instead of
       * scrolling inside its own box.
       */
      grid-template-columns: minmax(0, 1fr);
    }
  }

  @media (max-width: 600px) {
    .app {
      padding: 1rem 0.75rem;
    }

    h1 {
      font-size: 2rem;
    }

    /* Panel padding is 1.5rem a side — a quarter of a phone's width. */
    .app :global(.panel) {
      padding: 1rem;
    }
  }
</style>
