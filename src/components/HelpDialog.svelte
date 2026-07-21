<script lang="ts">
  /**
   * The Help / About dialog. Its prose is the HTML rendering of
   * `.plan/help.md` — kept in sync by hand rather than rendered from Markdown
   * at runtime, so the app ships no Markdown parser and the copy is reviewable
   * as plain HTML.
   *
   * This is also where the data attribution lives now that the footer is gone.
   * The OpenNGC credit is a licence term (CC-BY-SA-4.0), not decoration.
   */
  import Modal from './Modal.svelte'

  interface Props {
    onclose: () => void
  }

  let { onclose }: Props = $props()

  const version = __APP_VERSION__
</script>

<Modal title="SkyPath" {onclose} wide>
  <div class="help">
    <p class="version">Version {version}</p>

    <h4>What is it</h4>
    <p>
      I built SkyPath to solve one particular problem: my backyard has a very
      limited view of the night sky. When looking for a suitable
      astrophotography target I usually use
      <a
        href="https://telescopius.com"
        target="_blank"
        rel="noopener noreferrer">Telescopius</a
      >. It lets you search for targets above a given altitude and within
      certain quadrants of the sky, but, of course, it knows nothing about your
      local obstructions.
    </p>
    <p>
      <a
        href="https://nighttime-imaging.eu/"
        target="_blank"
        rel="noopener noreferrer">NINA</a
      >
      lets you create a horizon file describing your specific horizon, and it can
      then search for targets that clear it. The trouble is that my computer running
      NINA is usually attached to the telescope. To use it I have to either bring
      the telescope indoors or run power out to it, connect remotely, and only then
      use NINA's search to check whether the target of interest is obstructed.
    </p>
    <p>
      And if I decide to drive out to a dark site, I have to switch NINA to a
      different horizon file, change the coordinates, and search all over again.
    </p>
    <p>
      SkyPath brings the NINA horizon and a quick search across the most popular
      deep-sky catalogs — Messier, NGC, IC, Sharpless, and LDN — together in one
      place.
    </p>

    <h4>Using SkyPath</h4>
    <p>
      SkyPath lets you define multiple <em>observatories</em> — each a location and
      its horizon — and switch between them quickly to see how a given target rides
      the sky from each one. You can also search for the planets and the Moon, not
      just deep-sky objects.
    </p>
    <p>
      SkyPath runs entirely in your browser and sends no data to any server.
      There is no account to create: your observatories are kept in the
      browser's local storage and never leave your computer. That does mean they
      won't follow you to another browser or computer — use Export and Import to
      move your settings between them.
    </p>
    <p>
      Once you have picked a target and an observatory, SkyPath draws the
      altitude chart: the target's path across the sky through the night,
      overlaid with your horizon and the bands of day, twilight, and night.
    </p>
    <p>
      There is also an all-sky chart — a fish-eye view of the whole sky as if
      you were looking straight up, with the same target path and horizon. It is
      the same data shown from a different angle.
    </p>
    <p>
      Drag the time slider to see when the target crosses your horizon, when
      twilight and darkness begin, and so on. You can also overlay the Moon's
      path and phase on either chart.
    </p>

    <h4>Report bugs and suggestions</h4>
    <p>
      To report a bug or suggest an improvement, open an issue in the
      <a
        href="https://codeberg.org/uaraven/skypath/issues"
        target="_blank"
        rel="noopener noreferrer">issue tracker</a
      >.
    </p>

    <h4>Data and open source</h4>
    <p>Deep-sky data:</p>
    <ul>
      <li>
        Messier, NGC and IC objects:
        <a
          href="https://github.com/mattiaverga/OpenNGC"
          target="_blank"
          rel="noopener noreferrer">OpenNGC</a
        >, licensed CC-BY-SA-4.0.
      </li>
      <li>
        Sharpless (1959) ApJS 4, 257 — catalogue VII/20, via
        <a
          href="https://vizier.cds.unistra.fr/"
          target="_blank"
          rel="noopener noreferrer">VizieR</a
        > (CDS).
      </li>
      <li>
        Lynds (1962) ApJS 7, 1 — catalogue VII/7A, via
        <a
          href="https://vizier.cds.unistra.fr/"
          target="_blank"
          rel="noopener noreferrer">VizieR</a
        > (CDS).
      </li>
    </ul>
    <p>
      Ephemeris calculations use
      <a
        href="https://github.com/cosinekitty/astronomy"
        target="_blank"
        rel="noopener noreferrer">astronomy-engine</a
      >.
    </p>
    <p>
      Horizon files follow the
      <a
        href="https://nighttime-imaging.eu/"
        target="_blank"
        rel="noopener noreferrer">NINA</a
      > format.
    </p>
    <p>
      SkyPath is built with
      <a href="https://svelte.dev/" target="_blank" rel="noopener noreferrer"
        >Svelte</a
      >
      and
      <a href="https://vite.dev/" target="_blank" rel="noopener noreferrer"
        >Vite</a
      >.
    </p>

    <h4>License</h4>
    <p>
      SkyPath is free and open-source software, licensed under the GPL-3.0
      license. The source code is hosted on
      <a
        href="https://codeberg.org/uaraven/skypath"
        target="_blank"
        rel="noopener noreferrer">Codeberg</a
      >.
    </p>
  </div>

  {#snippet actions()}
    <button type="button" onclick={onclose}>Close</button>
  {/snippet}
</Modal>

<style>
  .help {
    font-size: 0.9rem;
    line-height: 1.6;
    color: var(--text);
  }

  .version {
    color: var(--text-dim);
    font-family: var(--font-mono);
    font-size: 0.8rem;
    margin-top: 0;
  }

  .help h4 {
    margin: 1.5rem 0 0.4rem;
    color: var(--accent-bright);
    font-size: 1rem;
  }

  .help h4:first-of-type {
    margin-top: 0.5rem;
  }

  .help p {
    margin: 0.5rem 0;
  }

  .help ul {
    margin: 0.5rem 0;
    padding-left: 1.25rem;
  }

  .help li {
    margin: 0.25rem 0;
  }
</style>
