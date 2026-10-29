# Full-measure rest import correction

The requested public Songsterr transcription (song 62399, “Don't Worry Baby”)
has an opening 2/4 measure with an explicitly silent measure/voice and one
undotted whole-rest symbol (`type: 1`, nominal whole-note duration `1/1`).
The importer previously counted that symbol as four quarters and rejected it
as overfull. Parser 1.3.1 now uses the current meter length for this narrowly
identified full-measure-rest representation, preserving the raw fraction.

Original synthetic tests in `tests/source/measure-rest.test.ts` cover 2/4,
3/4, 6/4 and 6/8, plus negative controls for pitched, unflagged, multiple,
dotted and grace beats. The four positive cases failed before the correction.
No downloaded score is included in these fixtures.

The initial preparation retry with intermediate difficulty and capo 0/2
comparison passed the opening rest but stopped at source part 2, which omits
`version`. No source/plan/arrangement was published at that stage. After the user
requested continuation, parser 1.4.0 added an explicit unversioned-part metadata
exception and bounded closed-slide endpoint support. See
`dont-worry-baby-draft.md` for the subsequent actual publication. No version was
inferred for part 2. Entirely unversioned sources still fail closed.

Verification passed: `bun install --frozen-lockfile`, `bun run check:source`
(102 tests), `bunx tsc --project tests/agent/tsconfig.json`,
`bun test tests/agent` (16 tests), `bun run check`, and `git diff --check`.
These checks do not establish acceptance or export of the requested song.
