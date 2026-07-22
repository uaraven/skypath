# Catalog data

Generated files — do not edit by hand. Regenerate with:

```
npm run catalog:build
```

## Sources and licence

| File             | Objects | Source                                       |
| ---------------- | ------: | -------------------------------------------- |
| `messier.json`   |     110 | OpenNGC                                      |
| `ngc.json`       |   7 916 | OpenNGC                                      |
| `ic.json`        |   5 028 | OpenNGC                                      |
| `sharpless.json` |     313 | VizieR VII/20 — Sharpless (1959) ApJS 4, 257 |
| `ldn.json`       |   1 787 | VizieR VII/7A — Lynds (1962) ApJS 7, 1       |

[OpenNGC](https://github.com/mattiaverga/OpenNGC) by Mattia Verga is licensed
**CC-BY-SA-4.0**. Attribution has to appear in the app (the credits line built
from `catalogSources`), and the share-alike term applies to the data, not to the
surrounding code. The two VizieR tables are served by CDS and carry the usual
requirement to cite the original publication, which the `source` string does.

## Departures from the sources

- `MESSIER_OVERRIDES` in the generator records where we resolve an entry
  differently from OpenNGC. Currently one: **M102 = NGC 5866**, where OpenNGC
  treats M102 as a re-observation of M101.
- OpenNGC rows typed `Dup` or `NonEx`, and NED sub-components (names with a
  space, like `IC0080 NED01`), are not emitted as objects. A `Dup` row's
  designation is folded into the object it duplicates so it stays searchable.
- Rows in VII/7A that the catalogue never numbered are dropped — there is no
  designation to file them under (1802 numbers, 1787 usable rows).
- The **Caldwell** catalogue (`C`) is lifted from OpenNGC's `Identifiers`
  column, so its numbers fold into the NGC/IC objects they name rather than
  forming a file of their own (105 of the 109 tagged). The four OpenNGC does not
  carry — C9 (Sh2-155), C14 (the Double Cluster), C41 (the Hyades) and C99 (the
  Coalsack) — have no single NGC/IC row to attach to, so they are absent.

## Known gap: no cross-match between Sharpless/LDN and NGC/IC

Objects are merged across files only when they **share a designation**, and
neither VizieR table carries NGC or IC numbers (nor does OpenNGC carry Sh2 or
LDN ones). So NGC 7000 and Sh2-117 are the same nebula but appear as two
entries, and the Sharpless and LDN objects have no common names at all —
searching "Cave Nebula" will not find Sh2-155. Closing this needs either a
positional cross-match (risky for degree-scale objects whose catalogued centres
disagree) or a curated alias table in the generator.

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
  the ~40 Messier objects NGC also contains are one object with two numbers.
