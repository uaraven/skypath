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
| `lbn.json`       |   1 125 | VizieR VII/9 — Lynds (1965) ApJS 12, 163     |
| `barnard.json`   |     349 | VizieR VII/220A — Barnard (1927) Atlas       |
| `abell.json`     |      72 | VizieR V/84 — Strasbourg-ESO PN catalogue    |

[OpenNGC](https://github.com/mattiaverga/OpenNGC) by Mattia Verga is licensed
**CC-BY-SA-4.0**. Attribution has to appear in the app (the credits line built
from `catalogSources`), and the share-alike term applies to the data, not to the
surrounding code. The three VizieR tables are served by CDS and carry the usual
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
- **LBN** numbers are lifted from the `Identifiers` column too, _and_ have
  their own file (`lbn.json`). OpenNGC only tags ~99 of the 1 125 Lynds
  numbers on an NGC/IC object; reading them from `Identifiers` first means
  those objects already claim the designation by the time `lbn.json` is
  merged in, so its rows for them fold in instead of duplicating, and the
  other ~1 026 become standalone objects.

- **Abell means the planetary nebulae**, not the galaxy clusters. They share
  numbers (A 21 is both), so only one can own the `Abell` prefix; the nebulae
  are the amateur imaging targets. V/84 lists ~15 000 planetary nebulae, so
  the generator keeps the rows named `A nn` — 72 of Abell's 86; the other 14
  are not in V/84 under that name. Its `Idents` column carries cross-IDs that
  the generator lifts (`Sh 2-274`, `NGC 6742`): Abell 21 merges with Sh2-274
  and Abell 50 into NGC 6742. `abell.json` is loaded **before** Sharpless so
  the planetary nebula's position and `PN` type win over the HII centroid.
  Neither Abell nor Barnard rows carry a magnitude or common name; Abell has no
  size either.
- **Barnard** numbers can carry a letter (`B 44a`); the generator keeps them
  as written. 58 of the 349 have no catalogued diameter. There is no
  Barnard↔LDN cross-match (B 33, the Horsehead, is one object and LDN 1630
  another), same gap as below.
- The generator's `VIZIER_HOST` environment variable swaps the server
  (`VIZIER_HOST=vizier.cfa.harvard.edu npm run catalog:build`); the Strasbourg
  host was returning 404 on 2026-11-14.

## Known gap: no cross-match between Sharpless/LDN and NGC/IC

Objects are merged across files only when they **share a designation**, and
neither VizieR table carries NGC or IC numbers (nor does OpenNGC carry Sh2 or
LDN ones). So NGC 7000 and Sh2-117 are the same nebula but appear as two
entries, and the Sharpless and LDN objects have no common names at all —
searching "Cave Nebula" will not find Sh2-155. Closing this needs either a
positional cross-match (risky for degree-scale objects whose catalogued centres
disagree) or a curated alias table in the generator. LBN is the exception: see
above for how it partially cross-matches via OpenNGC's `Identifiers` column.

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
