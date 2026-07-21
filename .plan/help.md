# SkyPath

SkyPath version ${version}

## What is it

I built SkyPath to solve one particular problem: my backyard has a very limited view of the night sky. When looking for a suitable astrophotography target I usually use [Telescopius](https://telescopius.com). It lets you search for targets above a given altitude and within certain quadrants of the sky, but, of course, it knows nothing about your local obstructions.

[NINA](https://nighttime-imaging.eu/) lets you create a horizon file describing your specific horizon, and it can then search for targets that clear it. The trouble is that my computer running NINA is usually attached to the telescope. To use it I have to either bring the telescope indoors or run power out to it, connect remotely, and only then use NINA's search to check whether the target of interest is obstructed.

And if I decide to drive out to a dark site, I have to switch NINA to a different horizon file, change the coordinates, and search all over again.

SkyPath brings the NINA horizon and a quick search across the most popular deep-sky catalogs — Messier, NGC, IC, Sharpless, and LDN — together in one place.

## Using SkyPath

SkyPath lets you define multiple "observatories" — each a location and its horizon — and switch between them quickly to see how a given target rides the sky from each one. You can also search for the planets and the Moon, not just deep-sky objects.

SkyPath runs entirely in your browser and sends no data to any server. There is no account to create: your observatories are kept in the browser's local storage and never leave your computer. That does mean they won't follow you to another browser or computer — use Export and Import to move your settings between them.

Once you have picked a target and an observatory, SkyPath draws the altitude chart: the target's path across the sky through the night, overlaid with your horizon and the bands of day, twilight, and night.

There is also an all-sky chart — a fish-eye view of the whole sky as if you were looking straight up, with the same target path and horizon. It is the same data shown from a different angle.

Drag the time slider to see when the target crosses your horizon, when twilight and darkness begin, and so on. You can also overlay the Moon's path and phase on either chart.

## Report bugs and suggestions

To report a bug or suggest an improvement, open an issue in the [issue tracker](https://codeberg.org/uaraven/skypath/issues).

## Data and open source

Deep-sky data:

- Messier, NGC and IC objects: [OpenNGC](https://github.com/mattiaverga/OpenNGC), licensed CC-BY-SA-4.0.
- Sharpless (1959) ApJS 4, 257 — catalogue VII/20, via [VizieR](https://vizier.cds.unistra.fr/) (CDS).
- Lynds (1962) ApJS 7, 1 — catalogue VII/7A, via [VizieR](https://vizier.cds.unistra.fr/) (CDS).

Ephemeris calculations use [astronomy-engine](https://github.com/cosinekitty/astronomy).

Horizon files follow the [NINA](https://nighttime-imaging.eu/) format.

SkyPath is built with [Svelte](https://svelte.dev/) and [Vite](https://vite.dev/).

## License

SkyPath is free and open-source software, licensed under the GPL-3.0 license.

The source code is hosted on [Codeberg](https://codeberg.org/uaraven/skypath).
