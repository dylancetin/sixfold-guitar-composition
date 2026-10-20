# Published-arrangement viewer design

The product is now a listening/reading surface, not a creation studio. Requests happen in
project chat. Remove the source-entry rail, prompt, stage approvals, edit forms and save UI.

Palette retained deliberately for an acoustic manuscript: walnut `#3d3229`, maple
`#e8ba6b`, paper `#fffef9`, bench `#e8e4dc`, ink `#282d2a`, melody teal `#236b64`.
Literata carries song titles; DM Sans carries quiet controls. No decorative hero artwork.

Library: small masthead → collection title → generous, numbered published-song rows.
An empty collection directs the musician to project chat with prose, never a create button.

Viewer: `library link / song title + actual downloads / score with persistent transport |
voice mixer + note inspector`. The score gets most of the width and its own bounded scroll
surface; a long full-song performance does not push transport offscreen. Arrangement notes
and provenance follow below. Mobile stacks the inspector after the score, keeps transport
reachable, and scrolls notation internally rather than squeezing the music.

Review of plan: the old creation sidebar and numbered workflow would imply editing, so both
are removed. The only numbered list is an actual library index. Role colors identify audio
controls, not progress. A published draft remains explicitly unreviewed. Model attribution
comes from its manifest, rationale from notes.md, and no AI/provider settings exist here.
