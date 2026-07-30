# Adding a DSO photo

For the deep space objects the results page should include the 
image of the object.

One of the ways to get that image is to use NASA skyview service.

Skyview provides the API to get the square image of the sky at any given coordinates (RA+Dec).

The url is

https://skyview.gsfc.nasa.gov/current/cgi/runquery.pl?Survey={survey}&position={ra},{dec}&Return=GIF&size={deg}&pixels={pix}

 - `survey` = digitized+sky+survey or dss2r for visual DSS survey that covers most of the sky
 - `ra` and `dec` are coordinates in decimal format
 - `deg` is the size of the viewport in degrees
 - `pix` is the size of the resulting picture in pixels pix x pix


More parameters are described here:

https://astrobase.readthedocs.io/en/latest/_modules/astrobase/services/skyview.html


The goal is to include the preview of the object in the object details page. The size of the image in degrees should be retrieved from the object size. If object size is unavailable, use default of 30'. 

The image retrieval can take some time, the spinner should be displayed while the image is loading. Image should be displayed above the title and should be placed into a collapsible div, so that it can be closed to avoid wasting space 