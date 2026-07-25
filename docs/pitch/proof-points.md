---
title: Pitch proof points (Wave 1 draft)
doc_type: pitch
status: draft
owner: D1
created: 2026-07-25
updated: 2026-07-25
confidence: HIGH
supersedes: null
sources_verified: true
---

# Proof points — claim register

Diligence backing for [`narrative.md`](./narrative.md), [`deck-outline.md`](./deck-outline.md), [`objections.md`](./objections.md), [`one-pager.md`](./one-pager.md).

**Status vocabulary**

| Status | Meaning |
| --- | --- |
| PROVEN | Cited artifact in-repo or URL + access_date |
| PENDING | Expected from a named track/agent; not yet available |
| ASSUMED | Working hypothesis / pack framing; not independently evidenced |

**Rule:** every substantive claim in the four pitch docs appears below. No unsourced assertions. Performance numbers: none invented.

---

## A. Product definition & process

| ID | Claim | Appears in | Status | Source |
| --- | --- | --- | --- | --- |
| A1 | Paragent is a stateful execution layer for browser agents: record → compile with post-condition assertions → replay → repair on failure | narrative, deck 1, one-pager, objections (implied) | PROVEN (as stated product intent) | [README.md](../../README.md); mechanism efficacy **PENDING TRACK-1** |
| A2 | Pre-seed; thesis unproven; gate number pending; no invented metrics | narrative, deck 2, one-pager | PROVEN | [README.md](../../README.md) |
| A3 | Contracts define trajectory, assertion, cache-row, metrics schemas | narrative, deck 10–12, objections §5 | PROVEN | [contracts/](../../contracts/); [contracts/README.md](../../contracts/README.md) |
| A4 | Metrics schema supports computing replay-validity, success with ≤2 repairs, repair vs fresh (tokens + wall-clock), self-heal, time-to-repair | narrative, deck 12, objections §5 | PROVEN (field definitions) | [metrics.schema.json](../../contracts/metrics.schema.json) |
| A5 | No gate number / numeric §9 thresholds exist yet | narrative, deck 11–12, one-pager, objections §5/§7 | PROVEN | [README.md](../../README.md); [docs/prd/README.md](../prd/README.md) open questions; metrics values unmeasured |
| A6 | Stack is TypeScript + Node + Playwright | (supporting; deck mechanism context) | PROVEN | [ADR-0001](../decisions/ADR-0001-typescript-node-playwright.md) |
| A7 | Repo privacy mode ALL-PRIVATE; still no secrets in git | (supporting; ToS/privacy posture) | PROVEN | [ADR-0002](../decisions/ADR-0002-repo-privacy.md); [README.md](../../README.md) |
| A8 | `pool_eligible` / fail-closed pooling fields exist on cache-row schema | narrative, deck 15, one-pager | PROVEN (schema) | [cache-row.schema.json](../../contracts/cache-row.schema.json) |
| A9 | Full PRD §6 privacy boundary spec / PRD v0.2 text | narrative, deck 15, one-pager | PENDING | Files `docs/prd/PRD-trajectory-cache-v0.2.md` and `pivot-brief-v0.3.md` **absent from tree** at draft (2026-07-25); only [prd/README.md](../prd/README.md) placeholder |
| A10 | Wave-1 pitch is draft; finalize after C5 | narrative frontmatter, deck 9, one-pager | ASSUMED (process) | Wave pack Agent D1; vertical lock pending C5 |

---

## B. Week-0 census (observability) — proven kills

| ID | Claim | Appears in | Status | Source |
| --- | --- | --- | --- | --- |
| B1 | Week-0 census killed SaaS observability config as anchor | narrative, deck 4–6, objections §1/§7, one-pager | PROVEN | [A8-DECISION.md](../research/census-week0/A8-DECISION.md) — verdict FAIL, 2026-07-24 |
| B2 | Survivor count = 2 of 70 (`SN-17`, `DD-06`) | narrative, deck 4, one-pager | PROVEN | [A8-DECISION.md](../research/census-week0/A8-DECISION.md) |
| B3 | Gate: ≤2 survivors → FAIL; applied | narrative, deck 4 | PROVEN | [A8-DECISION.md](../research/census-week0/A8-DECISION.md) §Gate application |
| B4 | Single-vendor concentration of 4+ survivors NOT MET | narrative, deck 4 | PROVEN | [A8-DECISION.md](../research/census-week0/A8-DECISION.md) |
| B5 | FULLY_API = 51 / 70 | narrative, deck 5, objections §1, one-pager | PROVEN | [A8-DECISION.md](../research/census-week0/A8-DECISION.md) citing [A4-adversary.md](../research/census-week0/A4-adversary.md); access_date 2026-07-24 per A8 |
| B6 | Join completeness 70/70 task_ids with A4+A5 | (backing for B2–B5) | PROVEN | [A8-DECISION.md](../research/census-week0/A8-DECISION.md) |
| B7 | No Grafana Cloud free-tier survivor / gate task | narrative (status), deck 4 notes | PROVEN | [A8-DECISION.md](../research/census-week0/A8-DECISION.md) |
| B8 | Decision: do not lock Datadog/Grafana/Sentry observability config as Week-0 anchor | narrative, objections §7 | PROVEN | [A8-DECISION.md](../research/census-week0/A8-DECISION.md) §Decision narrative |
| B9 | Wrong thesis falsified: recurring observability console config as browser-agent gold | narrative, deck 6, objections §1 | PROVEN | [A8-DECISION.md](../research/census-week0/A8-DECISION.md) §"Wrong thesis the kill list falsifies" |
| B10 | Highest A5 pain often sat on tasks A4 killed as FULLY_API | narrative, deck 6 | PROVEN | [A8-DECISION.md](../research/census-week0/A8-DECISION.md) evidence-quality §4 + killed table |
| B11 | Structural finding: vendor builds API for what customers do repeatedly → high-frequency and permanently browser-only nearly mutually exclusive when user is vendor's customer | narrative, deck 3, one-pager, objections §1 | PROVEN (as census archive paraphrase for observability) | [census-week0/README.md](../research/census-week0/README.md); [A8-DECISION.md](../research/census-week0/A8-DECISION.md) |
| B12 | Generalization of B11 beyond observability | narrative, deck 3 | ASSUMED | Pivot hypothesis; pending Track 2 falsification |
| B13 | Census archive is an asset to preserve | narrative, deck 4–5 | PROVEN (as project policy) | [census-week0/README.md](../research/census-week0/README.md); Wave pack §7 |
| B14 | "Killed own anchor in 48 hours" | narrative (qualified), deck (process) | ASSUMED | Wave pack / founder framing; dated FAIL is 2026-07-24 — wall-clock **not independently verified** in census files |
| B15 | 51-item evidence-backed falsification list produced before writing the execution layer | narrative, deck 5, one-pager | PROVEN (kill list exists; sequencing relative to Track-1 code is pack/README posture) | [A4-adversary.md](../research/census-week0/A4-adversary.md); [A8](../research/census-week0/A8-DECISION.md); Track-1 "harness in progress" — [README.md](../../README.md) |

---

## C. ToS overlay (observability vendors)

| ID | Claim | Appears in | Status | Source |
| --- | --- | --- | --- | --- |
| C1 | Datadog customer-consented console-agent risk HIGH; AUP §4 framing/scraping without prior written consent | narrative kill table, deck 17, objections §4 | PROVEN | [A6-tos.md](../research/census-week0/A6-tos.md); summarized in [A8](../research/census-week0/A8-DECISION.md) — access_date 2026-07-24 |
| C2 | Grafana Cloud risk HIGH; ToS bans spidering/harvesting / software that interacts with Service | narrative, deck 17, objections §4 | PROVEN | [A6-tos.md](../research/census-week0/A6-tos.md); [A8](../research/census-week0/A8-DECISION.md) — access_date 2026-07-24 |
| C3 | Sentry MED; structural ban on using Service on behalf of / as product to third parties | objections §4 | PROVEN | [A6-tos.md](../research/census-week0/A6-tos.md); [A8](../research/census-week0/A8-DECISION.md) — access_date 2026-07-24 |
| C4 | Counsel + written consent prerequisite for DD/GC console pilots | objections §4 | PROVEN (as A8 implication) | [A8-DECISION.md](../research/census-week0/A8-DECISION.md) §A6 |
| C5 | Next-vertical portal ToS | objections §4, deck 17 | PENDING | Per-surface spike in Track 2 |

---

## D. Pivot / counterparty thesis

| ID | Claim | Appears in | Status | Source |
| --- | --- | --- | --- | --- |
| D1 | Target work where laborer is COUNTERPARTY to software's customer: no API/bulk tools/roadmap sympathy permanently; multiplicity across portals creates frequency | narrative, deck 7, one-pager, objections §1 | ASSUMED | Wave-2 shared context; founder pivot framing; `pivot-brief-v0.3.md` **missing from tree** |
| D2 | Counterparty claim is falsifiable by Track 2 (API/EDI/intermediary) | narrative, deck 8, objections §7 | ASSUMED (method) | Wave pack Agents C4–C5 |
| D3 | Vertical not locked; search in progress | narrative, deck 9, one-pager, all docs front matter | PROVEN (as current status) | [README.md](../../README.md) Track 2; C5 not run |
| D4 | Two orthogonal tracks: (1) churn survival on self-hosted OSS; (2) commercial vertical search; neither waits | narrative, deck 19, objections §9 | ASSUMED (operating plan) | Wave-2 shared context; [README.md](../../README.md) status table |
| D5 | Track 1 version-bump churn is a proxy for organic production churn | narrative | ASSUMED (honesty requirement) | Wave pack / B1 brief; B1 docs may elaborate when merged |
| D6 | Second consecutive vertical FAIL implicates the thesis, not only anchor selection | narrative kill table, objections §7 | ASSUMED (decision rule) | Wave pack Agent C5 gate text |
| D7 | "Two failed censuses" as present fact | objections §7 (explicitly rejected) | PROVEN correction | Only Week-0 FAIL exists; second census PENDING C5 |

---

## E. A7 backup scout (not a lock)

| ID | Claim | Appears in | Status | Source |
| --- | --- | --- | --- | --- |
| E1 | Seller-side portal questionnaire fill / trust-center visitor is a conditionally credible backup wedge | narrative, deck 18 | PROVEN (as A7 scout verdict) | [A7-backup.md](../research/census-week0/A7-backup.md) §4 — access_date 2026-07-24 |
| E2 | Buyer-side TPRM inventory/assessment launch is weaker (heavily API'd) | narrative (non-lock), objections context | PROVEN (as A7) | [A7-backup.md](../research/census-week0/A7-backup.md) |
| E3 | Vanta documents UI-only gaps (e.g. start security review; link evidence) and ships Chrome extension because portals lacked spreadsheet export | deck 18 / objections §8 backing | PROVEN | URLs in [A7-backup.md](../research/census-week0/A7-backup.md) §5 — e.g. https://developer.vanta.com/docs/guides/create-vendors-and-attach-documentation ; https://www.vanta.com/resources/how-we-built-questionnaire-automation-browser-extension — access_date 2026-07-24 |
| E4 | SafeBase/Drata Chrome extension markets portal autofill (OneTrust, Whistic, ProcessUnity, etc.) | objections §8 | PROVEN | https://chromewebstore.google.com/detail/safebase-by-drata/mfmcakkhgmcedieeoahcnomefgigcnhm — via [A7](../research/census-week0/A7-backup.md) — access_date 2026-07-24 |
| E5 | Multiple portal-autofill tools = demand signal and competition | objections §8 | PROVEN (existence of category) | [A7-backup.md](../research/census-week0/A7-backup.md) §4 competition note |
| E6 | Invitation-gated test beds are the biggest 14-day measurement obstacle for VR wedge | objections §9, narrative | PROVEN (as A7) | [A7-backup.md](../research/census-week0/A7-backup.md) §4 obstacle |
| E7 | A7 wedge is nominated as locked vertical | — | N/A — **not claimed** in pitch docs | Explicit non-lock in narrative/deck |

---

## F. Mechanism economics & moat (mostly unmeasured)

| ID | Claim | Appears in | Status | Source |
| --- | --- | --- | --- | --- |
| F1 | Replay at near-zero / near-free token cost | narrative, deck 11, one-pager | PENDING | **[PENDING TRACK-1]** — do not invent |
| F2 | Amortized cost trends down; snapshot-compression competitors stay flat | narrative, deck 11, objections §2 | ASSUMED (product bet) + PENDING measurement | Wave pack D1 mechanism point; measure via [metrics.schema.json](../../contracts/metrics.schema.json) |
| F3 | Compilation survives site churn at acceptable rates | narrative kill table, deck 20, objections §2/§7 | PENDING | **[PENDING TRACK-1]** |
| F4 | Under counterparty model, cross-portal pooling is the product (not v2) | narrative, deck 13, one-pager | ASSUMED | Wave pack D1 moat point; requires Track 2 multiplicity |
| F5 | v1 cold-start is economically self-justifying single-tenant | narrative, deck 14, one-pager | ASSUMED | Wave pack D1 cold-start; not measured |
| F6 | Differentiation vs OpenAI/Anthropic/Browserbase = compiled asserted poolable cache + privacy allowlist | objections §2 | ASSUMED | Competitive framing; no primary-source competitor roadmap cited |
| F7 | If models get cheap enough, caching wedge can die | narrative, deck 20, objections §5 | ASSUMED (kill condition logic) | Wave pack D1 "what would make us wrong"; empirical curve **[PENDING TRACK-1]** |
| F8 | Portal bot-detection / MFA / CAPTCHA can block agents | objections §6, deck 20 | ASSUMED as risk class; partial census support | PARTIAL/browser residues in [A4](../research/census-week0/A4-adversary.md); portal MFA notes in [A7](../research/census-week0/A7-backup.md); severity PENDING per vertical |
| F9 | Intermediary already owning workflow kills counterparty thesis for that surface | narrative, deck 20, objections §7 | ASSUMED (method) | Wave pack Agent C4 intermediary rule |
| F10 | Solo-founder self-falsification is a diligence asset vs "why hasn't a funded team done this" | narrative, objections §3 | ASSUMED (narrative judgment) | Process evidence is B1–B15 PROVEN; interpretation ASSUMED |
| F11 | Financing / intro ask: support finishing Track 1 number + Track 2 adjudication | deck 21, one-pager | ASSUMED | Founder ask TBD; no dollar amounts invented |
| F12 | Track 1 can measure mechanism without third-party ToS/design partner via self-hosted OSS | objections §9, deck 19 | ASSUMED (plan) | Wave-2 shared context Track 1 |

---

## G. Explicit non-claims (integrity)

| ID | Non-claim | Why listed |
| --- | --- | --- |
| G1 | No latency, cost-savings %, or replay-validity % stated as fact | Hard rule — inventing metrics is fireable |
| G2 | No locked vertical name | C5 pending |
| G3 | No customer / design-partner names | Privacy rule |
| G4 | No assertion that an API "does not exist" globally — only cited FULLY_API / NO_PATH_FOUND per census method | A4 hard rule preserved |
| G5 | Deck does not claim two censuses have already failed | objections §7 |

---

## Coverage checklist (four files → register)

| File | Claim IDs covering it |
| --- | --- |
| narrative.md | A1–A5, A8–A10, B1–B15, C1–C2, D1–D6, E1–E2, E6, F1–F5, F7, F9–F10 |
| deck-outline.md | A1–A5, A8–A10, B1–B5, B9, B11–B13, C1–C2, C5, D1–D4, E1, E3–E5, F1–F5, F7–F9, F11 |
| objections.md | A1, A4–A5, B1, B5, B8–B9, B11, C1–C5, D1, D3–D4, D6–D7, E3–E6, F2–F3, F6–F10, F12 |
| one-pager.md | A1–A2, A5, A8–A9, B1–B2, B5, B15, D1, D3, F1, F4–F5, F11 |

---

## PENDING index (actionable)

| Item | Blocked on |
| --- | --- |
| All performance / replay / cost figures | Track 1 measurement |
| §9 numeric kill thresholds | PRD v0.2 in tree + Track 1 |
| Vertical lock + nominated first task | C5 `DECISION.md` |
| Pivot brief / PRD text cross-links | Founder drop of `pivot-brief-v0.3.md` + `PRD-trajectory-cache-v0.2.md` |
| Per-surface ToS + bot-detection | Track 2 scouts + counsel |
| Privacy boundary-spec narrative | B5 + PRD §6 |
| Whether A7 remains lead after C1–C5 | C5 |
| 48h wall-clock confirmation | Founder |
| Competitor roadmap primary sources | Optional diligence pass |
| Raise ask dollars / instrument | Founder |

---

## Open questions / what I could not verify

- Whether parent agent briefly had PRD files on disk that were never committed — they are absent from `origin/main` and this branch at write time.
- Uncommitted Track-2 scout files in other agents' working trees are **out of scope** for this register until merged; pitch must not lock on them.
- Any claim that appears in a future deck design beyond this outline needs a new proof-points row before use.
