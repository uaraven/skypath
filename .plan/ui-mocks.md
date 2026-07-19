# Main screen

## Search tab

Main screen is a two-panel view split vertically.

Left side is a list of "observatories" with buttons below for adding, editing and deleting the observatories.

Right side is a tabview with two tabs: 
 - Search
 - Results

Search allows searching the object database by entering its designation or partial name.

Below search bar is list of objects found. Each row contains name of the objecs, known designations in catalogs and altitude chart for the observatory selected on the left.

Clicking on the object row switches to the Results tab (See next mockup)

```
+-----------------------------------------------------------------------+                                    
|+-----------------++-----------++-----------+                          |                                    
||Backyard         ||**Search** ||Results    |                          |                                    
||Greenwich        |+-----------++-----------+                          |                                    
||Mount Wilson     |+------------------------------------++-----------+ |                                    
||                 || Andromeda                          || Search    | |                                    
||                 |+------------------------------------++-----------+ |                                    
||                 |+--------------------------------------------------+|                                    
||                 ||+-----------------------------------------------+ ||                                    
||                 |||M 31            |                              | ||                                    
||                 |||Andromeda Galaxy|                              | ||                                    
||                 |||                |    Altitude chart            | ||                                    
||                 |||                |                              | ||                                    
||                 |||                |                              | ||                                    
||                 ||+-----------------------------------------------+ ||                                    
||                 ||                                                  ||                                    
||                 ||                                                  ||                                    
||                 ||                                                  ||                                    
||                 ||                                                  ||                                    
||                 ||                                                  ||                                    
||                 ||                                                  ||                                    
||                 ||                                                  ||                                    
||                 ||                                                  ||                                    
||                 ||                                                  ||                                    
||                 ||                                                  ||                                    
||                 ||                                                  ||                                    
||                 ||                                                  ||                                    
||                 ||                                                  ||                                    
||                 ||                                                  ||                                    
||                 ||                                                  ||                                    
||                 ||                                                  ||                                    
||                 ||                                                  ||                                    
||                 ||                                                  ||                                    
||                 ||                                                  ||                                    
||+----++----+     ||                                                  ||                                    
||| +  || -  |     ||                                                  ||                                    
|||    ||    |     ||                                                  ||                                    
||+----++----+     ||                                                  ||                                    
|+-----------------++--------------------------------------------------+|                                    
+-----------------------------------------------------------------------+                             
```

## Results tab

Results tab displays:
 - altitude chart
 - all-sky view
 - list of important times for the day and the object:
   - sunset
   - sunrise
   - moonset
   - moonrise
   - moon phase
   - Civil, nautical and astronomical twighlight and dawn times
   - object rise time
   - object rise time over horizon
   - object transit time
   - object set time for horizon and for alt=0º

```
+-----------------------------------------------------------------------+                                    
|+-----------------++-----------++-----------+                          |                                    
||Backyard         ||Search     ||**Results**|                          |                                    
||Greenwich        |+-----------++-----------+                          |                                    
||Mount Wilson     | +------------------------------------------------+ |                                    
||                 | |                                                | |                                    
||                 | |                                                | |                                    
||                 | |                Altitude chart                  | |                                    
||                 | |                                                | |                                    
||                 | +------------------------------------------------+ |                                    
||                 | +------------------------------------------------+ |                                    
||                 | |                                                | |                                    
||                 | |                                                | |                                    
||                 | |                                                | |                                    
||                 | |                                                | |                                    
||                 | |                                                | |                                    
||                 | |                                                | |                                    
||                 | |                 All-sky view                   | |                                    
||                 | |                                                | |                                    
||                 | |                                                | |                                    
||                 | |                                                | |                                    
||                 | |                                                | |                                    
||                 | |                                                | |                                    
||                 | |                                                | |                                    
||                 | |                                                | |                                    
||                 | |                                                | |                                    
||                 | |                                                | |                                    
||                 | +------------------------------------------------+ |                                    
||                 | +------------------------------------------------+ |                                    
||                 | |                                                | |                                    
||                 | |                                                | |                                    
||                 | |                                                | |                                    
||                 | |                                                | |                                    
||                 | |                 Times and directions Alt/Az    | |                                    
||+----++----+     | |                                                | |                                    
||| +  || -  |     | |                                                | |                                    
|||    ||    |     | |                                                | |                                    
||+----++----+     | |                                                | |                                    
|+-----------------+ +------------------------------------------------+ |                                    
+-----------------------------------------------------------------------+                
```

## Observatory editor

Adding or editing the observatory opens following modal dialog:

```
+--------------------------------------------------------+
|     +-------------------------------------------------+|
| Name|                                                 ||
|     +-------------------------------------------------+|
|          +------------+          +------------+ +----+ |
| Latitude |            | Longitude|            | | ?  | |
|          +------------+          +------------+ +----+ |
|         +---------------------------+ +--------------+ |
| Horizon |                           | |  Upload      | |
|         +---------------------------+ +--------------+ |
|         or paste here                                  |
|         +--------------------------------------------+ |
|         |                                            | |
|         |                                            | |
|         |                                            | |
|         |                                            | |
|         +--------------------------------------------+ |
|                            +----------+ +-----------+  |
|                            | Save     | | Cancel    |  |
|                            +----------+ +-----------+  |
+--------------------------------------------------------+
```

User should be able to enter observatory name, it's coordinates (lat, lon, elevation). Elevation is not shown on the map but it should be there

User can either upload a horizon file or paste direction-altiture pairs in the text editor

Deleting observatory must open confirmation dialog before removing observatory from the list.