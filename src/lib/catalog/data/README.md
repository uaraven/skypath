# Catalog data

Generated files — do not edit by hand. Regenerate with:

```
npm run catalog:build
```

## Source and licence

The deep-sky data is derived from [OpenNGC](https://github.com/mattiaverga/OpenNGC)
by Mattia Verga, licensed **CC-BY-SA-4.0**. Attribution has to appear in the app
(the credits line built from `catalogSources`), and the share-alike term applies
to the data, not to the surrounding code.

## Departures from the source

`MESSIER_OVERRIDES` in the generator records where we resolve an entry
differently from OpenNGC. Currently one: **M102 = NGC 5866**, where OpenNGC
treats M102 as a re-observation of M101.

## File format

Each file enumerates one catalog and matches `CatalogFile` in `../types.ts`:

```json
{
  "catalog": "M",
  "title": "Messier catalog",
  "source": "…attribution…",
  "objects": [
    {
      "id": "M1",
      "designations": ["M1", "NGC1952", "LBN833"],
      "names": ["Crab Nebula"],
      "ra": 5.575547,
      "dec": 22.014472,
      "type": "SNR",
      "magnitude": 8.4,
      "constellation": "Tau"
    }
  ]
}
```

- `ra` is in **hours** (0–24), `dec` in degrees, both J2000.
- `designations` are plain strings parsed on load; every prefix used must be
  registered in `../catalogs.ts` or loading throws.
- Objects appearing in more than one file are merged by shared designation, so
  adding NGC later will not duplicate the Messier objects it contains.
