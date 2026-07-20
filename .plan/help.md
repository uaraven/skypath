# SkyPath

SkyPath version ${version}

## What is it

I designed SkyPath to solve one particular problem: my backyard has a very limited field of view of the night sky. When looking for a suitable astrophotography target I usually use [Telescopius](https://telescopius.com). It allows you to search for targets above certain altitude and certain quadrants, but, obviously, it does not know about your local obstructions.

[NINA](https://nighttime-imaging.eu/) allows you to create the horizon file with your specific horizon and NINA can seach for the targets above your horizon. The problem is my computer with NINA is usually mounted on the telescope. I need to either unmount it or provide power to it, connect to it remotely and the use NINA search to check if the target of interest is obstructed. 

If I am going to drive to a dark site, I need to switch to NINA options and choose a different horizon file, then change coordinates and search again.

SkyPath is NINA Horizon + quick search in most popular DSO catalogs: NGC, IC, Messier, LDN, etc.

## Using SkyPath

SkyPath allows the user to create multiple "observatories" coordinates of the place and the horizon and quickly change between them to see your line of sights for the given celestial object.

SkyPath runs completely in the browser and doesn't send any data to any server. You don't need an account, the observatories are stored in the browser storage and never leave you computer. This, of course, means that if you use SkyPath on another computer - your observatories will not be there. Use export and import to move your settings between browsers/computers.

When you have chosen the object and the observatory, you will see the altitude chart - the trajectory of the object in the sky overlayed with your horizon and day/night/dawn.

Additionally there is an all-sky chart which displays the bottom-up view of the sky with the same object trajectory and the horizon. It's the same data, just a different view.

You can move the time slider to see when the object crosses the horizon, when the dawn or twilight start, etc. you can also overlay moon path and phase on top of the charts.

## Report bugs and suggestions

To report a bug or suggest an improvement open an issue in the [issue tracker](https://codeberg.org/uaraven/skypath/issues)


## Data and Open source

NGC, IC and Messier deep-sky data: [OpenNGC](https://github.com/mattiaverga/openngc), CC-BY-SA-4.0

Sharpless (1959) ApJS 4, 257 — catalogue VII/20 via VizieR (CDS, https://vizier.cds.unistra.fr/)

Lynds (1962) ApJS 7, 1 — catalogue VII/7A via VizieR (CDS, https://vizier.cds.unistra.fr/).

Ephemeris: [astronomy-engine](https://github.com/cosinekitty/astronomy) 
