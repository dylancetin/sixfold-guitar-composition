# U05 candidate evidence

Base: ce201e0. Scope: pure linear-repeat expansion, not source acquisition or renderer acceptance.

`bun test tests/engine/form.test.ts` checks the independent literal 46→64 schedule (256 quarters), final four passes, inherited 80→120 repeat restoration at quarter 12 / tick 11520 (13 seconds), ordinary contiguous ties, rejection of repeat-entry orphan ties, overlapping repeats and missing initial tempo.

The first run caught an overprecise expected floating second value (difference 0.68µs from an approximate published fact). The oracle now uses the published 172.405680s with five-decimal tolerance; rational occurrence timing and tick assertions remain exact. Entry restoration is materialized once at every occurrence, including explicit written tempo at offset zero.

Candidate row: U05 | implemented; isolated original/form tests | live source-dependent integration pending | no renderer claim.
