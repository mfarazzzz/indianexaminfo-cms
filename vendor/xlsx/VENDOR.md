# vendor/xlsx — SheetJS Community Edition 0.20.3, vendored

Owner batch 6, Phase X2. This directory replaces the `xlsx` package that used to come from the
npm registry.

## Why it is here and not from npm

The npm registry copy of `xlsx` is frozen at **0.18.5** and `npm audit` reports it as
`{"xlsx": "*"}` — vulnerable range "everything", `fixAvailable: none`. There is no npm version to
upgrade to. SheetJS moved distribution to their own site (https://cdn.sheetjs.com/) after 0.18.5,
and 0.20.3 is the current Community Edition release there.

Keeping the dependency off the registry URL in `package.json` was the owner's requirement: the
build must not depend on cdn.sheetjs.com being reachable, so the bytes are committed here and
referenced as `file:vendor/xlsx`.

## Provenance

| | |
|---|---|
| upstream | SheetJS Community Edition (`xlsx`) |
| version | **0.20.3** (`package.json` → `"version": "0.20.3"`) |
| obtained from | `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` |
| tarball size | 2,409,319 bytes |
| tarball sha256 | `8dc73fc3b00203e72d176e85b50938627c7b086e607c682e8d3c22c02bb99fe8` |
| licence | **Apache License 2.0** — `LICENSE` (11,355 bytes) is the Apache-2.0 text, and `package.json` says `"license": "Apache-2.0"` |
| runtime dependencies | none (`package.json` → `"dependencies": {}`) |
| vendored size | 2,511,259 bytes across 11 files (this document excluded) |

## The two local edits to the vendored `package.json`, and why

`package.json` is upstream's, with **two fields removed** — nothing else was touched, and no
source file was edited:

| removed | because |
|---|---|
| `devDependencies` (24 entries) | npm treats a `file:` dependency's devDependencies as installable and pulled **607 packages** into the lockfile — eslint 7, jsdom 11, `request`, `tough-cookie@2.5`, typescript 2.2, mocha, sinon — none of which the CMS uses, several of which are themselves advisories, and all of which a fresh `npm ci` would need the **registry** for. Removing the field is what makes the vendoring real: `npm install` then reported `removed 607 packages, changed 1 package, and audited 550 packages`, and the lockfile's only `vendor/xlsx` entry is the package itself. |
| `bin` (`"xlsx": "./bin/xlsx.njs"`) | `bin/` is not vendored (it is a CLI shim this app never runs), so the field would point at a file that is deliberately absent. |

The `scripts` field is kept as-is: it contains only test/lint/build hooks (`pretest`, `test`,
`build`, `lint`, `dtslint`), no `install`/`prepare`/`postinstall`, so npm executes nothing from
the vendored package. `unpkg`/`jsdelivr` still name `dist/xlsx.full.min.js`, which is dropped —
those fields are CDN hints for a browser `<script>` tag, a path this build never takes (Vite
resolves `module` → `xlsx.mjs`).

Edited file: `package.json` 3,537 bytes, sha256
`2cf1fdbfab4e97330d9052ede505cf9a049d1ff537562869e7d95278be396ae1` (upstream's copy is 4,168
bytes, sha256 `bb9458277a69b41a304a89e45f19173ac0d23f2fc296091db49dba3c8b61c546`).

## What was kept, and what was dropped

The tarball is 8,076,339 bytes. Only the entry points this application resolves are committed:

| file | bytes | sha256 | why |
|---|---|---|---|
| `package.json` | 3,537 | `2cf1fdbfab4e97330d9052ede505cf9a049d1ff537562869e7d95278be396ae1` | name/version/main/module/types; `dependencies` is empty — **edited**, see the section above |
| `LICENSE` | 11,355 | `4d2a38ac35cda06a555c84074a819d413339cd3691b822cae50f8f322fe01f64` | Apache-2.0 must travel with the code |
| `README.md` | 1,494 | `97161c0a7368fd50782c9c38ae25641e9880d9799e4095861580ce7b8359d91b` | upstream's own pointer to the site |
| `CHANGELOG.md` | 9,428 | `897b88e9889d75dc6a56b167a9457e71447cc8eabbed2513abef8015db66cccf` | tells you what changed when 0.20.4 arrives |
| `xlsx.js` | 975,564 | `fd159f1e2d694e12cd0709c1ec1b63c6e1f045d2c4ce857a346f9b965798cbfa` | `main` — the CJS entry (vitest/node resolution) |
| `xlsx.mjs` | 1,008,308 | `1a0fb062ee9781b13f6687371b202aaefc53b6ce55b530c027e01f9c087b77db` | `module` — the ESM entry Vite bundles |
| `xlsxworker.js` | 454 | `ef112678f0b48219de630faa7a36094f605ce17d64c7115da82b500b0febc538` | worker shim referenced by the build |
| `dist/cpexcel.js` | 471,759 | `5f0cc8cc3c764e924a2877f32dcd93709756d0b6c26d2471bfd911ce6f8e81c2` | **required**, not optional: `xlsx.js:4446` does `set_cptable(require('./dist/cpexcel.js'))` for codepage decoding |
| `dist/cpexcel.d.ts` | 1,063 | `c6497a18bc9c9d686340e7f4cc402c14a11e4e5a658900b48d42171b9b462af5` | types for the above |
| `types/index.d.ts` | 27,917 | `191e4e6aceae3602aa3a1e9a6bc0e98821d6d5fb787e2bc16e250439482bddb6` | `types` — `tsc --noEmit` compiles against it |
| `types/tsconfig.json` | 380 | `6d9aa161334f6e452f744096020034803fb15bf025fe8f578535d6889d52e6c7` | ships with `types/` |

Dropped from the tarball, and why:

* `dist/xlsx.core.min.js`, `dist/xlsx.full.min.js`, `dist/xlsx.mini.min.js`,
  `dist/xlsx.extendscript.js`, `dist/xlsx.zahl.js`, `dist/xlsx.zahl.mjs`, `dist/shim.min.js` and
  the three `.map` files (≈5.5 MB) — alternative prebuilt bundles. This app imports the package
  root, so Vite/node pick `xlsx.mjs`/`xlsx.js`; the minified alternatives are never resolved.
* `dist/cpexcel.full.mjs` (472,893 B) — the ESM codepage table. `xlsx.mjs` has no reference to
  `dist/` at all (checked: `Select-String -Pattern "cpexcel|dist/" xlsx.mjs` → no match), only
  `xlsx.js` does, so the CJS side is the one that needs it.
* `bin/xlsx.njs` and `bower.json` — a CLI shim and a bower manifest; neither is used by a bundler.

## Verifying this copy

The per-file hashes above are of the vendored files, so they are checkable without re-downloading
anything except `package.json`, which is intentionally edited:

```bash
# integrity of every untouched vendored file, straight from the repo
git hash-object vendor/xlsx/xlsx.mjs vendor/xlsx/xlsx.js vendor/xlsx/dist/cpexcel.js   # git blob ids
sha256sum vendor/xlsx/xlsx.mjs vendor/xlsx/xlsx.js vendor/xlsx/dist/cpexcel.js

# to re-verify against upstream: the tarball hash is recorded above, and every file here except
# package.json must be byte-identical to the same path inside the tarball's package/ directory
curl -sSLO https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
sha256sum xlsx-0.20.3.tgz        # expect 8dc73fc3…bb99fe8
tar -xzf xlsx-0.20.3.tgz         # then diff -r package/ vendor/xlsx/ excluding VENDOR.md
```

## Upgrading

Replace the directory with the new tarball's `package/` contents using the same file list, apply
the same two `package.json` removals (`devDependencies`, `bin`), update the table above (and the
`xlsx` version in the commit message), then re-run `npm install && npm run typecheck && npm test`
and the import/export round-trip tests in
`src/lib/utils/excelBulkOps.roundtrip.test.ts`.

## Licence notice

Apache License 2.0, © SheetJS. The `LICENSE` file in this directory is the licence text as
distributed upstream; it must stay alongside the code.
