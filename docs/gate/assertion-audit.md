---
title: Assertion-strength audit — create-stat-dashboard-from-testdata
doc_type: spec
status: draft
owner: B3
created: 2026-07-30
updated: 2026-07-30
confidence: HIGH
supersedes: null
sources_verified: true
---

# Gate — assertion-strength audit (issue #61)

Step-level replay-validity — the PRD §9 headline number — is "the fraction of compiled steps
whose post-condition assertion passes without model fallback." That number is only as
trustworthy as the assertions. This audit reads every row of the committed live bundle and asks,
per step: **if this step silently did nothing, would its assertion fail?** It does not change any
assertion or `strength` label — that is follow-up work, tracked below per row.

Two things came out of doing this audit that go beyond a table read: an empirical check (required
by the issue) that surfaced a **strong-labelled assertion that does not actually catch a no-op
today**, for a reason unrelated to assertion strength, and a smaller runner-side timing gap found
while building the check. Both are reported here in full because they change what the load-bearing
count means in practice — see "Critical finding" and "Consequence for the gate" below.

## Source artifact

`artifacts/compiled/traj-gate-live-create-stat-dashboard-from-testdata-9.5.21.bundle.json` — the
live 12-step ADR-0006 recording, compiled by B3 (`docs/gate/compiler.md`). Intents are read from
the source trajectory, `experiments/gate-v1/trajectories/grafana-create-stat-dashboard-from-testdata-9.5.21.json`.

Counts below are reproducible with:

```bash
node scripts/assertion-audit.mjs
```

## Per-step table

| Step | Intent | Action | Assertion type | Strength | Would fail on a silent no-op? |
| --- | --- | --- | --- | --- | --- |
| 0 | Open the new-dashboard page | navigate | `url-matches` | strong | **Yes** — confirmed live |
| 1 | Add a visualization to the empty dashboard | click | `url-matches` | strong | **Yes** — confirmed live |
| 2 | Open the visualization picker | click | `element-visible` (visible:true, on the clicked control) | weak | No — asserts the clicked button, not what appeared. Empirically also broken (see Finding 1): the target locator resolves to 0 elements live, so it currently fails *unconditionally*, whether or not the step ran |
| 3 | Choose the Stat visualization | click | `element-visible` (visible:false, ADR-0007) | strong | **In principle, yes** — but confirmed **no** empirically (Finding 1): the target locator resolves to 0 elements live, so "hidden" is trivially satisfied either way |
| 4 | Name the query series | fill | `element-visible` (visible:true) | weak | No — cannot assert the typed value. Empirically also broken like step 2: target locator resolves to 0 elements live, so it currently fails unconditionally |
| 5 | Set how many series the query returns | fill | `element-visible` (visible:true) | weak | No — same shape as step 4. Not independently tested live; presumed (not confirmed) to share its mechanism |
| 6 | Title the panel | fill | `element-visible` (visible:true) | weak | No — same shape. Only `pool_eligible: true` row in the bundle. Not independently tested live |
| 7 | Apply the panel and return to the dashboard | click | `url-matches` | strong | **Yes** (not independently tested; identical evaluator to steps 0/1, which were confirmed) |
| 8 | Open the save-dashboard drawer | click | `element-visible` (visible:true, on the clicked control) | weak | No — same shape as step 2. Notable: `post_state` gains a new `form` landmark this step never uses (see recommendation) |
| 9 | Title the dashboard | fill | `element-visible` (visible:true) | weak | No — same shape as 4-6. ADR-0006: no rendered echo independent of step 11 (save) |
| 10 | Save the dashboard | click | `url-matches` | strong | **Yes** (not independently tested; identical evaluator to steps 0/1) |
| 11 | Return to the dashboards list | click | `url-matches` | strong | **Yes** (not independently tested; identical evaluator to steps 0/1) |

## Load-bearing step count

**6/12** steps (0, 1, 3, 7, 10, 11) carry an assertion that, read on its own terms, would fail if
the step silently did nothing. This is exactly the strong/weak split `docs/gate/compiler.md`
already reports (6 strong / 6 weak) — in this bundle, `strength: strong` and "load-bearing" line
up perfectly under a table-only reading. `scripts/assertion-audit.mjs` derives both numbers
mechanically from the bundle and prints a note if they ever diverge.

**They diverge in practice.** See the next section — the empirical check the issue requires
found that one of the six strong rows does not function as load-bearing today, for a reason the
static table cannot see.

## Empirical verification

Run against a freshly booted, freshly seeded `9.5.21` testbed instance (`npm run testbed --
--version 9.5.21`), using the unmodified `ReplayRunner` / `evaluateAssertion` / `bundleToProgram`
code paths — no product code was patched for this check. Method: take the real `CompiledProgram`
for the relevant step(s), replace the target step's `compiled_action` with `{ type: "wait",
locator_fallback_chain: [] }` (a genuine no-op — the assertion object is left untouched, and
`ReplayRunner` freezes it regardless), and run.

| Step | Real action | Neutered (no-op) action | Conclusion |
| --- | --- | --- | --- |
| 0 | (see caveat below) | `ASSERTION_FAILED` — `url "http://127.0.0.1:3000/?orgId=1" !~ /^http:\/\/[^\/?#]+:[^\/?#]+\/dashboard\/new\?orgId=1$/` | **Confirmed load-bearing** |
| 1 | `PASS` | `ASSERTION_FAILED` — `url "…/dashboard/new?orgId=1" !~ /…&editPanel=1$/` | **Confirmed load-bearing** |
| 3 | `PASS` | `PASS` (14 ms — `hidden` state satisfied instantly) | **Confirmed NOT load-bearing today** — see Finding 1 |
| 4 | `REPAIR_EXHAUSTED` / `TIMEOUT` after 5000 ms (real fill, real action succeeds) | not run (already fails on the real path) | **Confirmed broken independent of no-op status** — see Finding 1 |

Steps 0 and 1 satisfy the issue's "at least two 'would catch a no-op' claims verified
empirically" requirement. Step 3 is the audit's central finding, reported in full below rather
than quietly dropped.

### Finding 1 — structural-locator staleness, not assertion strength, breaks steps 2–4 live

While reaching step 3 for the check above, step 2's own assertion (weak, `element-visible`
expecting `visible: true`) timed out after 5000 ms on a **freshly booted, unmodified 9.5.21
instance** — the same version the trajectory was recorded on, no version bump involved. Direct
inspection found the cause: the assertion's target — a recorded structural/positional CSS path,
e.g.

```text
body > main > div:nth-of-type(2) > div:nth-of-type(4) > div > div > div >
  div:nth-of-type(2) > div > div:nth-of-type(1) > div > div > button:nth-of-type(1)
```

— resolves to **zero elements** (`page.locator(path).count() === 0`) on a fresh run, even though
the step's own *action* succeeds via a different candidate in the same `locator_fallback_chain`
(`role_name: "toggle-viz-picker"`, confirmed present and clickable). The same check on step 3's
and step 4's structural targets found the identical pattern: 0 matches, live, same version,
fresh boot.

This is exactly the risk ADR-0006 left open and did not resolve: *"whether the recorded step-7
locator … is stable across two recordings on the same instance. #24 must diff two runs; if it is
not stable, that is phantom churn."* This audit did not diff two recordings — it diffed one
recording against one live re-run of the identical version — and found the structural locator
unstable even under that weaker test.

The consequence is not uniform, because Playwright's `waitFor` treats "the locator matches
nothing" as satisfying `state: "hidden"` immediately:

- **Step 3** (`expected.visible: false`): a target that never resolves means "hidden" is
  trivially true, whether or not the click happened. The "strong" assertion currently passes
  unconditionally — confirmed both ways above.
- **Steps 2 and 4** (`expected.visible: true`): a target that never resolves means the assertion
  can never be satisfied — it times out after the full budget regardless of whether the step's
  real action succeeded. Confirmed for step 2 (weak) and step 4 (weak); the real fill in step 4
  genuinely worked (`executeAction` returned `ok: true`) and the assertion still timed out.

Steps 5, 6, 8 and 9 were **not** independently tested and are not claimed as confirmed — they are
flagged because they share step 2's or step 4's exact assertion shape (`element-visible` on a
recorded structural path) and are the natural next candidates for the same defect. This is a
presumption, not a count; do not carry it into any published number without testing it.

This is a locator-stability defect, not an assertion-strength defect — it belongs with issue #24,
not with this audit's recommendations below — but it directly undercuts the load-bearing count
this audit exists to produce, so it is reported here rather than filed silently elsewhere.

### Finding 2 (minor) — `url-matches` does not poll despite carrying `timeout_ms`

`src/runner/assertions.ts`'s `url-matches` case reads `page.url()` once, synchronously, with no
retry loop — unlike `element-visible`, which polls via Playwright's `loc.waitFor({ timeout })`.
Grafana 9.5.21 appends `?orgId=1` to `/dashboard/new` client-side, **confirmed empirically to land
roughly 500 ms after `domcontentloaded`** on a fresh full page load. A real, correctly-executed
step 0 run through the unmodified `ReplayRunner` therefore fails on this race, not on churn or a
weak assertion:

```text
url "http://127.0.0.1:3000/dashboard/new" !~ /^http:\/\/[^\/?#]+:[^\/?#]+\/dashboard\/new\?orgId=1$/
```

Confirmed the race is specific to a fresh full navigation: the same check on step 1's in-app
client-side route push (clicking "Add new panel") showed the URL update is synchronous — no
delay, no race. Worked around here (not fixed) by settling manually before handing control to
`ReplayRunner` for the step-1/step-3 checks above. Out of scope for this PR — it is a runner
evaluator gap, not a compiler assertion-strength question — recommend a follow-up: make
`url-matches` poll up to `timeout_ms` the same way `element-visible` already does.

## Recommendations for the six weak steps

| Step | Recommendation | Blind spot (`docs/gate/compiler.md`) |
| --- | --- | --- |
| 2 — open viz picker | **inherently weak**, per ADR-0006's explicit call ("opening a picker … with no rendered echo"). Dissenting note: `pre_state.dom_digest` (`006b965317eacdbc`) differs from `post_state.dom_digest` (`dee4609c1269959d`) for this step even though no new landmark appears — the compiler's own priority-8 `custom`/`post_digest_changed_or_stable` fallback is already built and would be *strictly* better than "is the clicked button still visible" (which cannot discriminate a no-op even in principle), but `synthesizeAssertion` never reaches it here because the `wantsElement` branch fires first whenever a primary (clicked-control) locator exists. Worth a **strengthen** follow-up to reorder branch priority for this shape of step. | 8 (side effects on elements other than the target) |
| 4 — name the query series | **needs richer fingerprint**. ADR-0006: the alias is rendered back as stat labels on both matrix extremes — synthesis could emit `text-matches` against a typed hole once the recorder captures *where* the value lands. | 1 (typed input values never stored) |
| 5 — set series count | **needs richer fingerprint**. ADR-0006: rendered back as the number of stat values shown — needs both a rendered-echo capture (like step 4) and a structured count field to synthesize `count-equals` against a real value rather than the current unreachable `expected.count: 0` placeholder. | 1 (typed input values) and 3 (structured counts) |
| 6 — title the panel | **needs richer fingerprint**. ADR-0006: rendered back at `data-testid Panel header {panel_title}` on both matrix extremes — same shape as step 4. | 1 (typed input values never stored) |
| 8 — open save-dashboard drawer | **strengthen**, with a concrete, already-available signal. `pre_state.visible_landmarks` is `[main, navigation, banner]`; `post_state.visible_landmarks` is `[main, navigation, banner, form]` — a genuine new landmark, computed by the compiler's own `newLandmarks()` helper (`src/compiler/assertions.ts:67-70`) and already called at line 158/216/282/298. It is never used as the assertion *target*, though: `const locator = primary ?? landmarkAsLocator(landmarkPick)` (line 286) only reaches `landmarkAsLocator` when `primary` is `undefined`, and a click step almost always has one (the clicked control's own locator). Asserting `element-visible` on the new `form` landmark (an ARIA-role locator, not a positional one) instead of on the clicked button would be both more discriminating *and*, per Finding 1, considerably less likely to be a stale structural path. | 8 (side effects on elements other than the target) |
| 9 — title the dashboard | **inherently weak**, per ADR-0006's explicit call: the typed value has no rendered echo independent of step 11 (save) — a richer fingerprint at step 9 itself would not help. Accept and label. | 1 (typed input values never stored) — accepted, not liftable here |

No `strength` label is changed by this table. Steps 4, 5 and 6 are exactly the "route to 8/4"
ADR-0006 already named and attributed to this issue; steps 2, 8 and 9 are the three ADR-0006 calls
"honestly weak," of which step 8 has a concrete, previously-unused strengthening path this audit
found by reading the compiler source, and step 2 has a weaker, dissenting one.

## Statement of consequence for the gate

Two distinct problems threaten the section 9 number, and the gate memo must not conflate them.

**1. Assertion strength (this audit's subject).** 6/12 steps carry an assertion that, read on its
own terms, would fail on a silent no-op; 6/12 do not, entirely for reasons already documented in
`docs/gate/compiler.md` (typed values never stored, reveals with no URL change and no rendered
echo). If the matrix runs on this bundle unchanged, the memo must state the 6/12 split
explicitly, not just the headline replay-validity percentage.

**2. Locator staleness (found empirically while completing this audit's required live check —
Finding 1).** At least 3 of the 12 rows (steps 2, 3, 4) carry an assertion **target** locator that
does not resolve on a freshly booted, unmodified 9.5.21 instance — not a version bump, the exact
base version the trajectory was recorded on. This is not a strength problem; it is the "is this
structural locator stable run-to-run" question ADR-0006 explicitly left open for issue #24, now
answered empirically: no, at least not for these three rows. Its effect on the number runs in
**both directions at once**, which is what makes it dangerous to leave undisclosed:

- Step 3's "strong" assertion currently **passes unconditionally** — confirmed real-click and
  confirmed neutered-no-op both `PASS`. A step that does nothing would be scored as valid.
- Steps 2's and 4's "weak" assertions currently **fail unconditionally** — confirmed the real,
  correctly-executed fill at step 4 still times out. Steps that work correctly would be scored as
  failures, for a reason that is not churn.

**Consequence, stated plainly:** until issue #24 confirms (or fixes) run-to-run structural-locator
stability, a section 9 number computed from this bundle cannot be trusted at face value even
*before* any cross-version comparison — a low step-validity score on the unchanged base version
would be indistinguishable from real product churn, and a passing step 3 would be indistinguishable
from a genuinely-completed one. This is a stronger caveat than "weak assertions inflate the
number": some rows here would currently deflate it and one would inflate it, simultaneously. The
gate memo issue must carry **both** this audit's 6/12 strength caveat **and** the Finding 1
locator-staleness caveat forward as explicit, separate requirements — collapsing them into one
footnote would lose the fact that they point in opposite directions.

## Open questions / what I could not verify

- Whether steps 5, 6, 8 and 9 share steps 2's/4's confirmed live locator-resolution failure.
  Flagged in Finding 1 as presumed, not tested — the natural next step before issue #24 is closed.
- Whether the structural-locator instability found here is specific to this task's DOM depth
  (deeply nested query-editor / picker components) or would reproduce on a shallower flow. Not
  compared against another recorded task.
- Whether re-recording on 9.5.21 today (rather than diffing against the live DOM directly, as this
  audit did) would reproduce the same structural paths — that is precisely issue #24's "diff two
  recordings" question, still open.
- Whether `url-matches`'s missing poll loop (Finding 2) affects any step beyond 0 in this bundle.
  Steps 1, 7, 10 and 11 are all click-triggered, in-app route changes like step 1 (confirmed
  synchronous, no race); step 0 is the only `navigate`-triggered one in this task.
- Whether the step-8 landmark-based strengthening this audit proposes would survive a version
  bump — the `form` role landmark was only checked against 9.5.21; not walked across the matrix.
