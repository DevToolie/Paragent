---
title: "Pivot brief v0.3 — post-census selection rule"
doc_type: brief
status: accepted
owner: founder
created: 2026-07-24
updated: 2026-07-25
confidence: HIGH
supersedes: docs/prd/PRD-trajectory-cache-v0.2.md §8
sources_verified: true
---

# Pivot Brief — PRD v0.3 delta
### Post-census decision: the selection rule was wrong, not just the anchor

**Status:** decision brief, supersedes §8 of PRD v0.2
**Date:** 2026-07-24
**Trigger:** Week-0 census returned FAIL (2 survivors, 51 tasks killed as FULLY_API) — [A8-DECISION.md](../research/census-week0/A8-DECISION.md). Track-2 later FAIL — [DECISION.md](../research/vertical-search/DECISION.md).

---

## 1. What the census actually proved

The stated finding is "observability is the wrong anchor." The real finding is structural and it invalidates the selection rule itself.

**Read the survivors and near-misses as a set.** Every `NO_PATH_FOUND` and every substantive `PARTIAL` is one species: OAuth consent, IdP/SAML setup, marketplace install, token mint, billing/quota mutation, cross-product invite. These are **trust-boundary and commercial-boundary actions** — permanently browser-only because a human's *authority* must be exercised, not because the vendor's API roadmap is incomplete.

And every one of them scored FREQUENCY = 1. You install Slack once.

**The law this implies:**

> A vendor builds an API for whatever its customers do repeatedly. Frequency is the *cause* of API coverage, not an independent variable.

Therefore, in vendor SaaS, **high-frequency** and **permanently browser-only** are close to mutually exclusive. The intersection our thesis requires is a near-null set by construction. Datadog was not the wrong vendor — the *shape* was wrong, and re-running the census on Snowflake, Okta, or Salesforce admin would return the same verdict for the same reason.

---

## 2. The escape: invert who the user is

The law above holds only while **the person doing the work is the software's customer**. Invert that relationship and it collapses:

> When the person doing the work is the **counterparty** to the software's customer, they get no API, no bulk tools, and no roadmap sympathy — permanently — because the portal owner has no incentive to reduce their labor. Meanwhile frequency accrues to them, because they face *many* portals rather than one.

This is why A7's seller-side slice is correct, and for a stronger reason than "no API found." The absence is structural and durable, not a gap awaiting a product release.

**Candidate surfaces with this shape** (the pivot search space, not a commitment):

| Surface | Who does the work | Why permanently browser-only |
|---|---|---|
| Vendor security questionnaires / trust portals | Seller's security & sales-eng team | Portal serves the *buyer*; respondent is a guest |
| Healthcare payer portals (prior auth, eligibility, claims status) | Provider back-office staff | Payer has no incentive to speed up provider submissions |
| Carrier / freight / customs portals | Shipper & broker ops | Carrier-owned; shipper is the supplicant |
| Procurement & supplier onboarding (Ariba/Coupa-class) | Supplier's AR/sales-ops | Buyer-owned workflow |
| Regulatory & government filing portals | Compliance staff, agents, filers | No commercial pressure to build APIs at all |
| Insurance broker / carrier appointment portals | Agency staff | Carrier-owned, agency-borne labor |

Common signature: **the labor is externalized onto a party with no leverage, and that party faces N portals, not one.**

---

## 3. Replacement for §8's selection rule

**Retire:**
> high-frequency + browser-only + no meaningful API + painful enough to pay for

That rule is not wrong, it is *insufficient* — it accepts a null set. It tests for API absence without asking whether the absence is durable.

**Adopt:**

> **1. Counterparty test (new, primary):** the person doing the work is NOT the customer of the software they are using. If they are the customer, assume any high-frequency task will be API-covered — now or within a year — and reject.
>
> **2. Durability test (new):** the absence of an API is explained by *whose interests the software serves*, not by vendor backlog. Write the one-sentence reason the API will still be missing in three years. If you can't, reject.
>
> **3. Multiplicity test (new):** the user faces many instances of the surface (many portals, many payers, many agencies). This is what converts a per-instance-rare task into a high-frequency *job*, and it is also what makes a cross-instance cache valuable rather than a single-site script.
>
> **4. Frequency, pain, willingness-to-pay** (unchanged, still necessary).
>
> **5. Assertability** (unchanged, still necessary): a crisp observable end state, or the replay thesis cannot be verified and the task is useless to us regardless of its economics.

Note what test 3 does to the moat argument: under the counterparty model, the cross-agent cache stops being a nice-to-have and becomes the core product, because **no single customer can warm a cache across hundreds of counterparty portals alone.** That is a stronger network-effect story than the v0.1 one, and it is the story the census failure earned.

---

## 4. Two tracks, run in parallel — do not serialize

The census left you serialized on the slower of two orthogonal risks. Split them.

### Track 1 — Technical gate (starts Monday, no partner, no ToS exposure)

**Question:** do compiled trajectories survive site churn? Unanswered, vertical-independent, and the entire company rests on it.

**Method — self-hosted OSS as the test-bed.** Deploy an open-source console with genuine DOM complexity (Grafana OSS, self-hosted Sentry, Keycloak admin, Metabase) on your own infrastructure.
- Zero ToS exposure: it is your deployment of software you are licensed to run.
- No design partner required.
- **Churn becomes a controlled variable:** compile the trajectory against version *N*, then walk the instance forward release by release and measure step survival per version bump. This is accelerated churn — you get months of drift in days instead of waiting 14.

**Measure (per PRD §9):** step-level replay-validity across version bumps; task-level success with ≤2 repairs; repair cost vs. fresh-reasoning cost; self-heal rate.

**Caveat to state in the writeup:** version-bump churn is a *proxy* for organic production churn — arguably harsher (major versions redesign UIs wholesale) and less frequent in kind. Report it as a proxy, and confirm against one live site once standing is unambiguous. A number with an honest asterisk beats no number.

**Gate:** unchanged from §9. If replay-validity fails here, the vertical question is moot and you stop — which is worth knowing *before* spending weeks recruiting a design partner.

### Track 2 — Vertical search (5 business days, per A8's time-box)

Adopt A8's handoff with three amendments:

1. **Prioritize respondent-side, not visitor-side.** Trust-center visitor access (VR-06) is thin work on the wrong side of the transaction. Its appeal is test-bed convenience — which is precisely the error that made Grafana's free tier attractive before anyone checked whether Grafana tasks were browser-only. Do not let test-bed access pick the task twice.
2. **Run the counterparty rule (§3) across all six surfaces in the table**, not just security questionnaires. One agent per surface, same census format, 2 days. The cost of widening now is trivial compared to a second FAIL.
3. **Resolve the standing question before any pilot** (see §5). It is a harder problem in this vertical than in the last one, and the memo carries it forward as boilerplate.

---

## 5. The escalated ToS problem — flagged, not deferred

A6 rated Datadog and Grafana HIGH for console automation. In the counterparty model the risk **changes shape and gets worse in one specific way:**

- **Old position:** you were the vendor's customer. A written-consent carve-out or MSA amendment was negotiable, however expensive.
- **New position:** your user is an authorized guest in a portal owned by a third party you have *no commercial relationship with*. There is no contract to negotiate a carve-out into, and the portal owner's incentives run against you.

**What is genuinely better:** the user is a legitimately invited, authorized participant performing their own work — not a scraper harvesting content. That is a materially stronger posture than crawling.

**Required before any paid pilot** (counsel packet, owner: founder, inside the 5-day box):
- Written position on authorized-user automation vs. prohibited automated access, for the specific portal chosen.
- Architecture note: the agent acts *as* the user under their own credentials, performs no bulk extraction, and respects rate limits — document this, because it is the defense.
- Explicit decision on whether the product ever stores counterparty-portal content, and if so, under §6's allowlist.

This does not need to be *solved* this week. It needs to be *sized*, so it never becomes the second thing that kills a vertical after the build starts.

---

## 6. What the census could not see (deliberate gap)

A4 tested API **existence**, not API **adoption**. Plenty of mid-market teams click through Datadog by hand despite a mature Terraform provider.

I am not reopening the vertical on this, and the reason should be recorded: for any FULLY_API task, the buyer's cheapest fix is "adopt the provider" — a cheaper, more reliable, better-supported answer than a browser cache. Selling a fragile substitute for a solved problem is a worse business than selling into a surface where no solution can exist. The gap is real; it does not rescue the vertical.

---

## 7. Decisions

| # | Decision | Status |
|---|---|---|
| 1 | Observability config as anchor | **Rejected** (census FAIL, cited) |
| 2 | §8 selection rule | **Replaced** by the counterparty/durability/multiplicity rule (§3) |
| 3 | Technical gate | **Starts Monday**, self-hosted OSS, version-bump churn, no partner dependency |
| 4 | Vertical search | 5 business days, six surfaces, counterparty rule applied |
| 5 | Fork A (auth) | **Unchanged** — the counterparty model is still authenticated work |
| 6 | microVM | **Still deferred** to post-gate |
| 7 | Raise | **Still gated** on the Track-1 number, now available sooner than under the serialized plan |

**Kill condition, restated:** if Track 1 returns replay-validity < ~50% or repair cost ≈ fresh-reasoning cost, stop — regardless of how good the vertical from Track 2 looks. A perfect market for a mechanism that doesn't work is still nothing.

---

*Next artifact: Track-1 harness spec (self-hosted target, version matrix, assertion format, instrumentation) — writable immediately, independent of Track 2's outcome.*

## Open questions / what I could not verify

- C5 FAIL closes Wave-2 surface lock; whether founder reframes to sell-to-intermediaries is outside this brief ([DECISION.md](../research/vertical-search/DECISION.md) next action).
- Track-1 kill line “replay-validity < ~50%” vs PRD §9 fuller gate set — which document controls when Track 1 reports.
- Standing / ToS counsel packet sizing (§5) — flagged, not completed in-repo.
