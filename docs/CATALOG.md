# Game catalog policy

OPTIVEX does not invent game requirements. Every bundled entry in `src/OPTIVEX.App/Data/catalog.json` must have:

- an **official source URL** (the publisher or developer's own page, or the store listing), read directly;
- a **last-verified date** (the day it was read);
- only the figures the source actually publishes. Anything else is `null` and shown as "Not published".

Third-party articles are **not** accepted as sources. While preparing Phase 4 the same game's requirements differed between articles (for example Baldur's Gate 3's storage was quoted as 70, 122 and 150 GB, and graphics cards differed), and Mojang had raised Minecraft: Java Edition's requirements in July 2026. Only the publisher's current page was trusted.

## Current bundled entries

| Game | Source | Verified |
|---|---|---|
| Baldur's Gate 3 (Windows) | https://baldursgate3.game/support/system-requirements_47 | 2026-11-12 |
| Minecraft: Java Edition | https://www.minecraft.net/en-us/article/minecraft-java-edition-system-requirements | 2026-11-12 |

The Minecraft entry comes from Mojang's announcement article, which gives core count, RAM and VRAM targets but no CPU/GPU model names or storage figure. OPTIVEX shows those as "Not published".

## Adding entries
- **As a user:** Gaming Center → Add a game. Saved locally and permanently labelled *User-provided / not verified*.
- **To the bundled catalog:** add an object to `catalog.json` with `sourceKind: "Official"`, an `https://` source and a `lastVerified` date. The `BundledCatalogTests` unit tests reject entries without them, with duplicate ids, or that fail validation.

Requirements change when games are updated. Re-check the source before relying on an entry, and update `lastVerified` only after re-reading it.
