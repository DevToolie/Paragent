---
title: "Counsel packet sizing — authorized-user automation of a counterparty portal"
doc_type: brief
status: draft
owner: B0
created: 2026-08-14
updated: 2026-08-14
confidence: HIGH
supersedes: null
sources_verified: true
---

# Counsel packet — sizing (pivot brief §5, issue #36)

## What this document is, and is not

**This is not legal advice, and nothing in it is a legal conclusion.** Nobody who wrote this
document is a lawyer, this repository is not a law firm, and no statement below should be read
as a position this project has adopted. Where an external legal concept is mentioned, it is
either cited to a source with an access date, or explicitly marked as a question for counsel —
never asserted as settled.

This is a **sizing brief**, per pivot brief §5's own framing:

> "This does not need to be *solved* this week. It needs to be *sized*, so it never becomes the
> second thing that kills a vertical after the build starts."
> — [pivot-brief-v0.3.md §5](../prd/pivot-brief-v0.3.md)

It produces: what a counsel engagement would need to cover, the questions it must answer, what
currently bears on those questions in the architecture at HEAD, and what must be true before the
engagement is worth starting. It does **not** produce a position on any specific portal, because
none is chosen — see below.

## 0. Why this cannot be a position today

Track 2 (vertical search) is a documented **FAIL** with **no anchor locked**
([ADR-0004](../decisions/ADR-0004-vertical-track2-fail.md)) — there is no specific counterparty
portal to write a position for. [Issue #103](https://github.com/DevToolie/Paragent/issues/103)
already records this precisely: the ToS-position requirement (session-custody.md's SC-06) is
"**inapplicable, not merely undone**." `docs/README.md` pins the same fact at the top of the doc
index: *"Vertical lock: **none** — ... Do not invent a lock."*

This document honors that constraint. It is written as a **template and trigger condition** —
what gets filled in, by whom, the moment an anchor is locked — not as a position on a hypothetical
site. No anchor, vertical, portal name, or client is invented anywhere below.

## 1. Trigger condition — when this converts into a real position

This brief is not the deliverable #103 asks for; it is the sizing that makes #103 well-defined
when its trigger fires. The conversion sequence, matching #103's own "Before you open the PR"
checklist:

1. **An anchor/vertical is actually locked** — a new ADR that reverses or supersedes ADR-0004
   ("new primary evidence that a named surface is DURABLE ... and a reachable non-PHI /
   non-tax-bank test bed", per ADR-0004's Reversal cost section), or an explicit product pivot to
   a different company shape, which ADR-0004 says "needs a new ADR" of its own.
2. **The founder** (owner, per pivot brief §5: "counsel packet, owner: founder") identifies the
   actual portal and pulls its Terms of Service / anti-automation clause verbatim.
3. **Counsel is engaged** with three inputs: (a) that ToS text, (b) the position outline in §2
   below, filled in for the specific clause language, and (c) the architecture note in §3 below,
   re-verified against the code at whatever commit is current when the engagement starts —
   architecture drifts, and a stale architecture note handed to counsel is worse than none.
4. **The output is a new, portal-specific written position** — filed as #103 (or its
   successor issue), never as an edit to this document. This document stays the reusable
   template; it does not accumulate a specific site's facts.

## 2. Position outline — authorized-user automation vs. prohibited automated access

*(Acceptance criterion 1.)*

### 2.1 The distinction, as the product team understands it — not a legal conclusion

Two informal categories the product needs counsel to draw a real line between, for a specific
portal's specific ToS:

- **Authorized-user automation** (the posture this product claims): an agent acting under the
  credentials of a person who already has ordinary, granted access to the portal, performing the
  same discrete UI actions that person could perform manually, at a pace and volume comparable to
  manual use, on their own behalf.
- **Prohibited automated access** (what anti-automation clauses typically target): bulk or
  automated data extraction, circumventing rate limits or access controls, using automation to
  exceed what the account holder's role entitles them to see or do, evading per-account limits via
  multiple accounts, or accessing functionality through non-UI channels the account holder was not
  given.

Pivot brief §5 states the favorable framing directly: *"the user is a legitimately invited,
authorized participant performing their own work — not a scraper harvesting content. That is a
materially stronger posture than crawling."* That is this project's stated intent, not a verified
legal outcome — §3 below checks how much of it the code actually delivers today.

### 2.2 Questions counsel must answer, once a portal is locked

These are open questions for counsel, not assertions. Background sources are cited in §2.4 so
counsel starts from the same record this brief used, not to pre-answer them.

1. Does automating access that is already granted to the account holder — via a scripted browser
   acting under that person's own session — fall within "authorized access," for the relevant
   federal and state computer-fraud statutes, for *this* portal's access model? The U.S. Supreme
   Court's *Van Buren v. United States* (2021) adopted a "gates-up-or-down" reading of "exceeds
   authorized access" under the Computer Fraud and Abuse Act, turning on whether an area is
   technically off-limits rather than on how permitted access is used — a question for counsel is
   whether that reasoning, decided in a criminal CFAA case, extends to this portal's specific ToS
   and to any state-law equivalent that applies.
2. Does the specific portal's ToS contain an anti-automation, anti-bot, or "no automated means"
   clause, and if so, does its text distinguish automation performed *by* the authorized account
   holder from automation performed by an unaffiliated third party? Many such clauses are written
   for the latter case and may not contemplate the former at all.
3. Does the portal's ToS assessment for automation change based on whether the accessed content
   is behind a login (this project's case, always, per PRD §7 Fork A) versus publicly reachable
   without one? *hiQ Labs, Inc. v. LinkedIn Corp.* (9th Cir., most recently affirmed on remand
   2022) held that automated collection from a public, unauthenticated page likely does not
   violate the CFAA's "without authorization" clause — a fact pattern counsel should note is the
   **opposite** of this project's, which is always authenticated, single-account access. Whether
   *hiQ*'s reasoning cuts for or against an authenticated case is a question for counsel, not
   something this brief resolves.
4. Does a breach-of-ToS theory (contract law) survive independently of any computer-fraud
   analysis, and if the ToS is a clickwrap/browsewrap the account holder agreed to individually
   (not a negotiated MSA — pivot brief §5's "no contract to negotiate a carve-out into" point),
   what does breaching it expose the account holder to, versus what it exposes this project to as
   the tool the account holder used?
5. Does automating under the user's own logged-in session (this project's architecture — see §3)
   read differently from a "connected app" that uses an official OAuth/API integration, in the
   specific portal's ToS language? The portal may treat these as the same category or as
   materially different ones.
6. Is the portal in a regulated sector with access-control rules layered on top of its ToS —
   pivot brief §5's own candidate list includes healthcare payer portals, carrier/customs
   portals, and government filing portals, each of which may carry sector-specific
   authorized-access rules independent of general computer-fraud law. This question cannot be
   answered generically; it depends entirely on which surface is eventually locked.
7. Given §3's honest gaps (no rate limiter enforced today — see §3.3), does counsel consider that
   gap load-bearing to the "authorized-user automation" posture, or immaterial to it? This is
   explicitly a question to put to counsel, not a determination this brief makes.

### 2.3 Facts about our architecture that bear on the answer

Summarized here; full grounding with file citations is in §3.

Favors the "authorized-user automation" reading: the agent authenticates with the account
holder's own credentials through the portal's normal login form (§3.1); it performs the same
named UI actions (click, fill, select, navigate, etc.) a human performs, one at a time, never
concurrently (§3.1, §3.4); it does not capture full page content, HTML, or screenshots — only
role/label metadata for the specific elements a step touches (§3.2); nothing it stores is
transmitted anywhere except the compiled program the same tenant later replays, subject to the
pooling boundary in §4.

Cuts against, or is simply unverified: there is **no enforced rate limiter** anywhere in the
codebase today — nothing paces requests to a target site to a human-comparable rate (§3.3, a real
gap, not a caveat). Session persistence across runs is not implemented at all currently (browser
context is created fresh and discarded — §3.5), so a "session continuity" claim beyond a single
run is not yet true of the code, only of the product intent in PRD §7.

### 2.4 Evidence table — legal background cited above

| Claim | Source | Access date |
| --- | --- | --- |
| CFAA "exceeds authorized access" is defined at 18 U.S.C. § 1030(e)(6); "without authorization" is left undefined in the statute | [Cornell LII, 18 U.S.C. § 1030](https://www.law.cornell.edu/uscode/text/18/1030) | 2026-08-14 |
| *Van Buren v. United States* (2021) adopted a "gates-up-or-down" reading of "exceeds authorized access" under the CFAA, turning on whether an area is technically off-limits rather than on the purpose of the access | [Congress.gov CRS Legal Sidebar, Van Buren v. United States](https://www.congress.gov/crs-product/LSB10616) | 2026-08-14 |
| *hiQ Labs, Inc. v. LinkedIn Corp.* (9th Cir., most recently affirmed on remand April 2022) held that automated collection of data from a public, unauthenticated web page likely does not violate the CFAA's "without authorization" clause, and that violating a public site's ToS alone is not sufficient to trigger CFAA liability under that clause | [Fenwick, "HiQ Labs Scrapes by Again: The Ninth Circuit Reaffirms that Data-Scraping Does Not Violate the CFAA"](https://www.fenwick.com/insights/publications/hiq-labs-scrapes-by-again-the-ninth-circuit-reaffirms-that-data-scraping-does-not-violate-the-cfaa-1) | 2026-08-14 |

These three sources establish background only. None of them was decided on facts matching this
project's architecture (authenticated, single-account, UI-level automation of a counterparty's
portal), and counsel must be the one to say whether or how they apply.

## 3. Architecture note

*(Acceptance criterion 2.)* Every claim below is grounded in the code at HEAD of this branch,
commit `b722676` (based on `origin/main`, 2026-08-13). Where the code does not do something a
casual reader might assume it does, that is stated plainly — an architecture note that overstates
this project's posture is worse than no note, and this is the document most likely to be read by
someone outside the repo.

### 3.1 The agent acts as the user

Login happens through the portal's own form, filled with the account holder's own credentials,
not through an API-level bypass. `establishSession` (`src/recorder/preamble.ts:125-199`) drives
Playwright to `page.goto()` the login page, `fill()` the username/password fields, and `click()`
the submit button — the same steps a human takes at a keyboard. It then verifies the session by
checking the portal's own "who am I" endpoint (`verifySession`, `preamble.ts:272-304`), rather
than assuming success.

Once authenticated, every subsequent action in a replay is one of a small, named vocabulary —
`navigate`, `click`, `fill`, `select`, `check`, `uncheck`, `press`, `hover`, `wait`, `upload` —
executed against a single resolved locator per step (`executeAction`,
`src/runner/actions.ts:94-306`). There is no code path that issues a raw HTTP request to the
portal outside of what Playwright's browser automation naturally sends as part of rendering and
interacting with the page.

Steps execute **strictly sequentially, never concurrently**: `ReplayRunner` walks
`program.steps` in a single `for...of` loop (`src/runner/replay.ts:270`), attempting one step,
waiting for its outcome, and only then moving to the next. There is no `Promise.all` or parallel
dispatch anywhere in `src/runner/` or `src/recorder/` that would fan out multiple actions against
a live target concurrently (verified by search; the only concurrency-shaped code in the runner
package is the wall-clock budget check described in §3.3, which is time-based, not
request-based).

### 3.2 No bulk extraction

Nothing in the current pipeline captures a page's full content. The two places that read
anything from a live page for measurement purposes are narrowly scoped:

- `capturePageState` (`src/runner/page-state.ts:28-62`), which feeds the repair model's view of
  the page (see §4's repair-egress note), reads only `page.url()`, `page.title()`, a fixed
  enumeration of ARIA landmark roles (`VISIBLE_LANDMARKS_EXPRESSION_JS`, shared from
  `src/shared/landmarks.ts` so the recorder and runner never drift — see `architecture.md`
  invariant 6), and a best-effort network-idle probe. It does not call `page.content()`,
  read `innerHTML`, or serialize the DOM.
- `captureFingerprint` (`src/recorder/fingerprint.ts:26-`) similarly reads `page.url()`,
  `page.title()`, and structural counts (form/heading/link/button/input counts, landmark roles) —
  counts and role names, not the underlying content.

The only place any element's text is read is per-locator, for a single interactive element's
accessible name/label, and it is truncated to 120 characters
(`src/recorder/locators.ts:79`, `.slice(0, 120)`). A repo-wide search found no call to
`page.content()`, `innerHTML`, `outerHTML`, or `page.screenshot()` anywhere in `src/`. There is no
code path that walks a table, a list, or a search-results page and harvests its rows — the
recorder captures **steps a human took**, one locator and one action at a time, not the data a
page displays.

### 3.3 Rate limits — not enforced today; state this plainly

**There is no rate limiter anywhere in this codebase that paces requests to an automated
target.** A repo-wide search for rate-limiting, throttling, or backoff logic in `src/` returns
exactly one match, and it is unrelated: a comment at `src/runner/repair-anthropic.ts:281` about
handling a rate-limit *error response* from the Anthropic API (the repair model provider), not
about pacing requests to the portal being automated. Nothing in `src/recorder/` or
`src/runner/` inserts a delay between actions, caps actions-per-minute, or otherwise slows the
agent down to a human-comparable cadence.

Two mechanisms that exist are easy to mistake for a rate limiter and are not one:

- **ADR-0011's per-run wall-clock budget** (default 300,000 ms / 5 minutes,
  `src/runner/replay.ts`) caps the *total elapsed time of one run*, checked between steps. It
  exists to stop a hung run, not to pace the rate of individual actions — a run that completes
  eleven rapid-fire steps in two seconds and then hangs on the twelfth is unaffected by this
  budget until the clock runs out.
- **Per-step timeouts** (`DEFAULT_ASSERTION_TIMEOUT_MS` = 5,000 ms in the compiler;
  `NETWORK_IDLE_WAIT_MS` = 5,000 ms in `src/runner/actions.ts:69`) bound how long a single step
  *waits* for a condition. They are upper bounds on patience, not lower bounds on spacing —
  nothing prevents two steps from firing back-to-back with no gap at all.

Pivot brief §5 lists "respects rate limits" as part of the architecture defense required before
any paid pilot. **That defense does not exist in code today.** Whether the *lack* of an explicit
throttle is acceptable — because sequential, single-session, single-locator-per-step execution
is inherently no faster than human-comparable interaction, or because Playwright's own action
timings (page load waits, element visibility waits) impose an incidental floor — is exactly the
kind of architectural fact counsel needs, not a conclusion this brief draws. If counsel needs an
explicit pacing mechanism as part of the position, it does not exist yet and would need to be
built before a pilot, not merely documented.

### 3.4 No concurrent multi-session automation of one portal

Each recorded or replayed run uses a single `Page` inside a single Playwright `BrowserContext`
(`src/recorder/cli.ts`, `experiments/gate-v1/live-run.ts`). Nothing in the runner or recorder
spins up multiple contexts or pages against the same target concurrently. The matrix harness used
for the internal Track-1 gate (`experiments/gate-v1/`) does walk multiple *versions* of the
self-hosted test-bed, but that is orthogonal — it is Track-1-only infrastructure this project
runs itself against its own containers (ADR-0003), not a pattern that applies to a counterparty
portal, and `experiments/gate-v1/` is explicitly "throwaway... not a product API"
(`architecture.md` invariant 5).

### 3.5 Session material — scoped to one run, not yet persisted

Per PRD §7 (Fork A), the product's stated intent is that the agent rides the user's own
authenticated session. Today, that session exists only for the duration of one run: both the
recorder's `select-task`/CLI path and the live matrix driver call `browser.newContext()` fresh and
never call Playwright's `context.storageState()`, `context.cookies()`, `context.addCookies()`, or
`chromium.launchPersistentContext()` — verified by repo-wide search and independently confirmed in
[session-custody.md](./session-custody.md)'s SC-01 gap analysis. `src/session/` — the
encrypted-at-rest module built for this purpose (`session-state-encryption.md`) — exists and is
merge-blocking-canary-tested, but **has no caller anywhere in `src/`**
(`architecture.md`'s package table states this directly: "Not a pipeline stage, and has no
callers"). So today there is no persisted session for a counterparty ToS position to reason
about; the moment that changes, this note becomes stale and must be re-verified, per §1's
conversion sequence.

## 4. Storage decision

*(Acceptance criterion 3.)* **Explicit decision:** yes, the product does store content derived
from any portal it automates, including a future counterparty portal — as a compiled trajectory
(`trajectory.schema.json`, written by the recorder) and, where the cache hop is wired, as cache
rows (`cache-row.schema.json` + `assertion.schema.json`, written by the compiler and cache). This
is not portal-specific: there is no code path today that special-cases "counterparty" vs.
"self-hosted" origin, so the same rule that governs the Grafana OSS test-bed governs any future
counterparty portal.

**What is stored, in all cases, and what is not.** Stored: role-based and structural locators, a
synthesized assertion per step, and flow topology — never raw page content, HTML, screenshots,
HAR captures, cookies, or storage-state (verified in §3.2 and 3.5; also see
[session-custody.md](./session-custody.md) SC-02/SC-03 and `architecture.md` invariant 3,
`assertNoLiteralSecrets`, `src/recorder/redact.ts:102-117`). A literal typed value (a password, an
account number typed into a field) never reaches a trajectory at all — it becomes a parameter
slot, never the value.

**Whether that stored content may be shared cross-tenant is routed entirely through
[boundary-spec.md](./boundary-spec.md)'s §6 positive allowlist**, exactly as it is for every
other site: role-based locators against `ALLOWED_ARIA_ROLES` and UI-chrome names, structural
position without free text, allowlisted test IDs, vocabulary CSS attributes, typed-hole assertion
templates, and flow topology only — enforced write-time and fail-closed by `writeCacheRow`
(`src/cache/write.ts`), merge-blocking canary-tested (`tests/canary/canary.test.ts`,
`tests/canary/mutation.test.ts`, `tests/canary/store-leak.test.ts`). Anything a counterparty
portal's page authors write into a label, testid, or free-text string that is not on the
allowlist is **tenant-scoped by default** (`pool_eligible=false`) and never reaches the
cross-tenant pool — the allowlist fails closed rather than scrubbing content into apparent safety
(boundary-spec.md's own stated design principle).

**One caveat specific to a closed counterparty portal, not present for the self-hosted OSS
test-bed:** [ADR-0017](../decisions/ADR-0017-pool-vocabulary-rule.md)'s vocabulary rule — a
pinned, source-cited snapshot of accessible names verified against a public open-source
artifact — only applies to software this project can verify against a public tag.
`boundary-spec.md` states this limit itself: the vocabulary rule "does not extend to closed SaaS
portals, which have no public vocabulary to verify against and remain on the 50-word floor." In
practice this means a counterparty portal's UI text is *more* likely to taint and stay
tenant-scoped than the OSS test-bed's is — the safe direction, but it also means less of a locked
counterparty portal's structure would ever be poolable, which is a product-shape fact worth
carrying into any future costing of that vertical.

**A second, distinct boundary — not storage, but adjacent and worth flagging alongside it:**
[ADR-0012](../decisions/ADR-0012-repair-context-budget.md) governs what a *repair* payload may
send to a third-party model provider (Anthropic), which is a live network call once
[#27](https://github.com/DevToolie/Paragent/issues/27) replaces the current
`StubRepairModelClient` (`src/runner/repair.ts:17-27`, which always returns
`corrected_action: null` and consumes no real tokens today — this egress is not live yet). The
repair payload may carry a failed step's locators, the assertion's type, the page URL, title,
landmarks, and the role + accessible name of visible interactive elements — never input values
(`src/shared/page-context.ts`, `serializeRepairContext()`, merge-blocking
`tests/canary/repair-egress.test.ts`). `boundary-spec.md` itself flags the open question this
document inherits: *"an accessible name is page-authored... on a closed portal it may carry
tenant strings this spec has not classified."* This is not resolved here, and it is not a storage
question — it is a transmission-to-a-third-party question that will need its own answer before a
real repair model runs against a locked counterparty portal, tracked by the same open item
boundary-spec.md already records.

## 5. Sizing — what this would cost, in time and decisions

The issue this document answers is titled "Size," not "solve." What follows is the shape of the
cost, not a fabricated number — per `CONTRIBUTING.md` rule 3, a metric this project has not
measured does not get invented here, including a legal-fee or hours estimate nobody has quoted.

**The dependency chain**, each link blocking the next:

1. Anchor lock (new ADR or product pivot) — blocks everything below. Not on this project's
   critical path today; Track 1 is the near-term company-deciding measurement per pivot brief §4.
2. Founder pulls the specific portal's ToS text — cheap, hours not days, but cannot happen before
   step 1.
3. Architecture note re-verification against the code at that time (§3 above, re-run) — cheap if
   the gaps in §3.3/§3.5 are unchanged; more work if a rate limiter or session persistence has
   since landed and needs re-describing accurately.
4. Counsel engagement proper — the position outline (§2) filled in against the real ToS text.
   **This project has no attorney-hours or fee estimate for this step; that is a question to put
   to counsel once step 2 exists, not a number this brief can source.** Pivot brief §5 scopes the
   counsel packet as founder-owned work meant to fit "inside the 5-day box" alongside Track 2's
   vertical search — that box bounds the *internal* sizing and drafting effort (this document),
   not necessarily external counsel's own turnaround time, which this brief has no basis to
   estimate.
5. If the position is favorable enough to proceed: the storage decision (§4) gets re-confirmed
   for the specific portal (the general mechanism already exists and needs no new code — see §4),
   and any architecture gap counsel flags as load-bearing (most likely candidate: §3.3's missing
   rate limiter) gets scoped as an engineering issue before a paid pilot, not after.

**What's already done, so it does not need to be re-sized later:** the pooling-boundary mechanism
(§4), the storage/no-storage split (§4), and the "acts as the user" architecture (§3.1) are real,
merge-blocking-tested, and portal-agnostic — a locked anchor does not require new privacy-boundary
engineering, only re-verification that nothing drifted.

**What is not done, and should be treated as a real precondition, not a documentation gap:**
§3.3's rate limiter and §3.5's session persistence. Both are currently absent from the code, not
merely undocumented.

## 6. Preconditions — what must be true before this is worth starting for real

- An anchor is actually locked (§1.1) — not merely a promising candidate from pivot brief §5's
  table.
- The specific portal's ToS text is in hand, verbatim, not summarized from memory.
- SC-05 (explicit customer consent language, [issue
  #102](https://github.com/DevToolie/Paragent/issues/102)) has a product decision, since counsel
  will reasonably ask what the account holder is told before their session is automated, and that
  is currently "not addressed" per session-custody.md.
- Someone has decided whether §3.3's missing rate limiter is acceptable to bring to counsel as-is
  or needs to be built first — bringing an inaccurate architecture note to counsel is worse than
  bringing an honest gap.

## Open questions / what I could not verify

- Whether *Van Buren*'s CFAA reasoning, or *hiQ*'s, would actually be found applicable by counsel
  to this project's specific fact pattern (authenticated, single-account, UI-level automation) —
  explicitly left to counsel; this brief only establishes that these are the background cases to
  start from, not that they resolve anything.
- Whether the missing rate limiter (§3.3) is something counsel would treat as load-bearing to the
  "authorized-user automation" defense, or as immaterial given sequential single-session
  execution — a question for counsel, not decided here.
- Attorney time and fee cost for the counsel engagement itself (§5, step 4) — no quote exists;
  this brief declines to invent one per `CONTRIBUTING.md` rule 3.
- Whether state-law computer-fraud statutes (as distinct from the federal CFAA background cited
  in §2.4) materially change the analysis for a given portal's jurisdiction — not researched here,
  and would depend on which state(s) the counterparty and the account holder are in.
- Whether a portal-specific regulatory overlay (HIPAA-adjacent rules for a healthcare payer
  portal, agency-specific rules for a government filing portal — both named as candidate surfaces
  in pivot brief §5's table, neither locked) would add requirements beyond the general ToS
  question — cannot be sized generically; depends entirely on which surface, if any, is ever
  locked.
- Whether the code's rate-limiting and session-persistence gaps (§3.3, §3.5) will have closed by
  the time an anchor is locked — if so, §3 of whatever document supersedes this one needs
  re-verification against the code at that time, not a copy of this section.
