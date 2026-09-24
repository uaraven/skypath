# framing assistant

This document describes the functionality of a framing assistant for Skypath.

## Goal

The goal is to allow user to estimate the framing of their astrophotography camera for the selected object.

Framing assistant takes place of the currently existing object preview.

## Rigs

Adding framing assistant requires adding "rigs" list. This transforms left bar from the list of observatories into two lists:
 - observatories
 - rigs

Each of the sections has their own add/edit/delete buttons. Hamburger menu with import and export is common and imports/exports both observatories and rigs.

See section on import/export below.

Rigs are telescopes + cameras. 

Add button opens a dialog where the user can enter their telescope and camera settings.
Edit button opens the same dialog to update the settings.
Delete button deletes currently selected rig. Functionality and UX is the same as in observatories.

Telescopes are defined by their focal length and aperture (not technically needed)

Cameras are defined by their sensor size and resolution.

Cameras can be defined by physical sensor size in mm and resultion OR by resolution and pixel pitch in µm.

Add/edit dialog shows calculated details for the rig:

image resulution in arcsec per pixel, diffraction limit of the telescope, vertical and horizontal field of view.

## Cameras

There is limited number of popular camera chips, so the user can choose one from the list or enter entirely custom values.

List of camera sensors:
 - Sony IMX455 9576x6388, 3.76x3.76µm pixel, 36x24mm
 - Sony IMX585 3840x2160, 2.9x2.9μm pixel, 11.2x6.3mm
 - Sony IMX533 3008x3008, 3.76x3.76µm pixel, 11.3x11.3mm
 - Sony IMX571 6252x4176, 3.76x3.76µm pixel, 23.5x15.7mm
 - Sony IMX183 5544x3694, 2.4x2.4μm pixel, 13.2x8.8mm
 - Sony IMX264 2464x2056, 3.45x3.45µm pixel, 8.5x7.1mm
 - Sony IMX678 3840x2160, 2x2µm, 7.68x4.32mm
 - Sony IMX662 1920x1080, 2.9x2.9µm, 5.57x3.13mm
 - Panasonic MN34230 4646x3520, 3.8x3.8µm, 17.6x13.3mm
 - Sony IMX294 bin2 4144x2822 4.63x4.63µm, 19.1x13.0mm
 - Sony IMX294 bin1 8288x5644 2.3x2.3µm, 19.1x13.0mm
 - OmniVision OS08B10, 3840x2160, 2.9x2.9µm, 11.2x6.3

## Framing assistant features

Framing assistant view shows the target in the rectangular iframe scaled to 25% larger than the largest rig's field of view.

There should be a frame drawn around the target indicating the field of view of the camera. If the user changes the rig using the list of the left - the frame changes to reflect that rig.

There should be a slider below the iframe which selects 0 to 360 rotation of the frame.

Aladin lite apis allow drawing of overlay layers. See API docs: https://aladin.cds.unistra.fr/AladinLite/doc/API/

## Rig storage

Nothing changes - the rigs are stored in browsers local store. 

## Import and export

Export saves both rigs and observatories in a json file.

Import currently shows a dialog asking to update or replace the storage with the contents of json file. There should be added an option to select whether Observatories, Rigs or both should be imported. The option of replace/append applies to selected element.
