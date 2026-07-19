<script lang="ts">
  /**
   * The site footer: data attribution and the link home.
   *
   * The catalog line is **required**, not decorative — OpenNGC is CC-BY-SA-4.0
   * and attribution is a licence term. It is built from `catalogSources` rather
   * than written out here, so adding a catalog in `dso.ts` credits it
   * automatically instead of silently shipping unattributed data.
   */
  import { catalogSources } from '../lib/catalog'

  /** The attribution strings carry their URL inline, as `Name (https://…)`. */
  interface SourceLine {
    text: string
    href?: string
    label?: string
    rest?: string
  }

  /**
   * Splits `Name (https://…), rest` into a link plus the remainder, so the URL
   * is rendered as an anchor on the name instead of printed raw beside it.
   * Lines without a URL fall through unchanged.
   */
  function linkify(source: string): SourceLine {
    const match = /^(.*?)\s*\((https?:\/\/[^\s)]+)\)(.*)$/.exec(source)
    if (!match) return { text: source }
    const [, label, href, rest] = match
    return { text: source, href, label, rest }
  }

  const sources = catalogSources.map(linkify)
</script>

<footer class="credits">
  <div class="attribution">
    <p>
      Deep-sky data:
      {#each sources as source, index}
        {#if index > 0}<span class="sep">·</span>{/if}
        {#if source.href}
          <a href={source.href} target="_blank" rel="noopener noreferrer"
            >{source.label}</a
          >{source.rest}
        {:else}
          {source.text}
        {/if}
      {/each}
    </p>
    <p>
      Ephemeris:
      <a
        href="https://github.com/cosinekitty/astronomy"
        target="_blank"
        rel="noopener noreferrer">astronomy-engine</a
      >. Horizon files follow the
      <a
        href="https://nighttime-imaging.eu/"
        target="_blank"
        rel="noopener noreferrer">N.I.N.A.</a
      > format.
    </p>
  </div>

  <p class="site">
    <a href="https://voronin.cc">voronin.cc</a>
  </p>
</footer>

<style>
  /* Mirrors the main site's footer: hairline rule, small and dimmed. */
  .credits {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem 1.5rem;
    margin-top: 2rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--border-soft);
    font-size: 0.7rem;
    color: var(--text-faint);
  }

  .attribution {
    /* Long attribution text wraps rather than pushing the site link off. */
    min-width: 0;
  }

  .credits p {
    line-height: 1.5;
  }

  .sep {
    padding: 0 0.25rem;
  }
</style>
