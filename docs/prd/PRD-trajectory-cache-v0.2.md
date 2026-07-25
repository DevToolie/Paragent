# PRD — Stateful Execution Layer for Browser Agents
### (working title: *the trajectory cache*)

**Status:** v0.2 — decisions made, development-ready
**Owner:** [you]
**Last updated:** 2026-07-24
**Changes from v0.1:** decisions §7/§8 resolved; build plan inverted (gate harness before infrastructure); microVM demoted to Phase 2; replay-validity formally defined; privacy boundary specified as a mechanism, not a table; session-custody security added; cold-start wedge made explicit; personas + pricing hypothesis added.

---

## 1. One-line

A stateful execution layer that makes browser-agent tasks checkpointable, verifiable, and **cheaper every time they run** — because the system learns each site it visits and pools that knowledge across agents.

## 2. The problem

Browser agents treat every page load as a fresh problem: snapshot, reason from scratch, act, discard. Expensive (thousands of tokens per step), slow, fragile — agents stall at the same logins and re-derive the same flows on every run.

Two facts make this wasteful rather than merely hard:

1. **Agent tasks are overwhelmingly repeats.** The same login, the same console, the same config flow, thousands of times. Nothing today amortizes that.
2. **Traffic concentrates.** A small set of sites absorbs most agent visits. Knowledge about common sites compounds.

The academic version exists (WebCoach, Nov 2025 — cross-agent shared trajectory memory over browser-use), which validates the mechanism. No productized, verified, privacy-safe implementation exists.

## 3. The thesis

**Compilation, not compression.** Everyone else shrinks the page representation (accessibility trees took token cost from ~4,000 to ~300 — nearly solved, given away free). We do the orthogonal thing:

- **First run:** the model drives. Expensive, full reasoning. We record the trajectory.
- **On success:** compile the trajectory into a deterministic script with a post-condition **assertion** baked into every step.
- **Replay:** near-zero tokens, near-zero latency.
- **On assertion failure:** fall back to the model, repair the step, recompile.

Amortized cost trends toward zero and improves with use. Compression stays flat; compilation compounds.

**The moat** is the cross-agent cache: the 10,000th agent to run a flow inherits what the first 9,999 learned — a data network effect a competitor must reproduce from zero.

**The wedge (new — answers cold-start):** the moat needs traffic we don't have yet. But the design is economically self-justifying *single-tenant*: one customer's own repeated runs get cheaper and more reliable with zero pooling. v1 sells single-tenant ROI (cost + reliability). The network effect is what we *grow into*, not what we sell on day one. This is also the answer to "why does anyone buy before the cache is warm."

## 4. Non-goals

- **No browser engine.** Chromium underneath; statefulness at the runtime layer, not the engine layer.
- **No microVM in Phase 1** (changed from v0.1 — see §5.1 and §10). The thesis runs entirely at the CDP layer. VM snapshotting buys speculative forking and mid-task checkpoint/restore — valuable, but it optimizes a thesis that isn't yet proven. We do not build the expensive layer before measuring the speculative one.
- **No broad open-web coverage at seed.** Seed on a concentrated site set so the cache warms.
- **No credential vault / SSO-MFA handling in v1** (deferred safely — §7). The privacy boundary is NOT deferrable (§6).
- **No general-purpose agent memory.** Browser procedural memory with verification, specifically. Not a Mem0 competitor.

## 5. Architecture

Three layers. Build order is now bottom-up by *risk*, not by stack position.

### 5.1 Runtime — Phase 1: plain CDP; Phase 2: microVM
**Phase 1 (weeks 0–6):** stock Chromium + CDP + persisted browser profiles (cookies/storage-state) for session continuity. This is sufficient for record, compile, replay, assert, and repair — the entire thesis.

**Phase 2 (post-gate):** Chromium inside a microVM (Cloud Hypervisor class), snapshottable as a whole machine:
- checkpoint/restore of full session state (pages, cookies, storage, in-flight requests)
- fork a session to speculate down branches; keep the winner
- deterministic replay: pinned time, seeded randomness, recorded network
- rollback to any checkpoint on failure

Still the piece nobody has built well — but it is an *accelerant* for a proven loop, not a precondition for one.

### 5.2 Task-state machine (Phase 1)
Runs on CDP. Converts "click and hope" into "act, assert, know."
- A task is an explicit sequence of steps; each step carries a **post-condition assertion**
- "Step 4 of 7, verified, checkpoint here"
- The assertion is the checksum that makes any cached step safe to replay

### 5.3 Compiler + cache (Phase 1 single-tenant; pooling in Phase 2)
- Records trajectories, compiles on success, replays deterministically, repairs on assertion failure
- **Schema is multi-tenant and site-keyed from commit one** — pooling is off in Phase 1, but the write-time boundary (§6) ships with the first table, because it is fatal to retrofit
- Entries are confidence-weighted by recent success rate; stale entries self-invalidate on assertion failure; the repair rewrites the entry — self-healing, and (once pooled) the repair benefits everyone

**Page representation** (supporting, not headline): ~50-token page summary + query-into-DOM retrieval (`find_by_role`, text search, region expansion) + diffs instead of resnapshots.

## 6. The privacy boundary — now a mechanism, not a table

The cache will be cross-tenant; authenticated sessions expose private data. The research literature flags cross-tenant memory leakage as *structural*. v0.1 drew the line; v0.2 specifies the enforcement.

**The line (unchanged):**

| Layer | Example | Scope |
|---|---|---|
| Structural / public | "this login is email-then-password"; "this form validates async, wait for the green check" | **Pooled globally (Phase 2)** |
| Tenant-derived | metric names, thresholds, account contents, any value read from an authenticated page | **Tenant-scoped, never pooled** |

**The mechanism (new):**

1. **Positive allowlist, not redaction.** A poolable entry may contain ONLY: role-based locators from a fixed vocabulary (`role`, `landmark`, structural position), assertion *templates* with typed holes (`expect(toast).toMatch(SUCCESS_PATTERN)`), and flow topology (step ordering, wait conditions, branch structure). Anything not on the allowlist doesn't ship — we never try to "scrub" arbitrary content, because scrubbing fails open.
2. **Values are parameters, always.** Every value the agent typed or read is lifted into a typed parameter at compile time. The pooled entry stores the *slot* (`{monitor_name: string}`), never the value. Parameter bindings live tenant-scoped only.
3. **Selector taint-checking.** Selectors can smuggle tenant data (`data-account-id` attributes, account names inside `aria-label`s, tenant text in role+text queries). At write time, any locator containing free text or non-vocabulary attributes is classified tenant-scoped automatically. Only vocabulary-pure locators are pool-eligible. When a pool-eligible locator can't be constructed, the step pools as topology-only and the locator stays tenant-scoped — degraded sharing, zero leakage.
4. **Red-team test in CI from week 1:** seed a fake tenant with canary strings (unique account names, metric names, thresholds); run the full record→compile pipeline; assert zero canaries appear in any pool-eligible row. This test is a merge-blocker forever.

Cost: ~2 days at day one. Fatal to retrofit at month nine under an incident.

## 7. Login — DECIDED: Fork A (embrace auth, own-session v1)

Auth splits into two things that feel like one:

- **Authentication** (getting past the login screen): mostly free. The agent rides the user's *existing* authenticated session — persisted profile / storage-state. Human logs in once; session persists.
- **The hard parts** wearing login's coat: (a) SSO + MFA on re-auth → v3; (b) the privacy boundary → §6, day one.

**Decision: Fork A.** Rationale: auth complexity is a wall competitors must also climb — it is the exact wall that stops academic approaches from becoming products — and the authenticated-SaaS side is where willingness-to-pay lives. Fork B (public-only sites) demos faster but with weaker moat and weaker pricing; it survives as a fallback demo surface, not the business.

Roadmap under Fork A:
- **v1:** single-user, own-session, own-tools. Cache learns structural trajectories, tenant-scoped by default.
- **v2:** cross-tenant pooling of the structural layer, §6 boundary enforced at write-time. *Moat turns on here.*
- **v3:** SSO/MFA/credential handling for unattended enterprise runs. Fundable milestone on its own.

**Session custody (new, required by Fork A):** riding the user's session means we hold their cookies and storage-state — sensitive infrastructure in its own right. v1 requirements: storage-state encrypted at rest (per-tenant keys), never written to logs or trajectories, session material excluded from the compiler's input by construction, explicit customer consent language ("you are authorizing automation of your own account"), and a documented ToS position per anchor site. SOC 2 is a v2/v3 concern; the encryption and log-hygiene are not.

## 8. Anchor + first task — DECIDED (with one honesty fix)

**v0.1 had a self-contradiction:** the selection rule excludes anything with a clean API, but Datadog monitors, Grafana dashboards, and Sentry alerts all have APIs and mature Terraform providers. The defense is real but must be earned per-task, not assumed per-vendor: (a) most mid-market customers do not IaC their observability config, and (b) meaningful sub-flows are genuinely UI-only (integration tiles and their OAuth dances, SSO/SAML setup, team/permission flows, usage/billing navigation).

**Decision:**
- **Test-bed (the site we hammer for the gate): Grafana Cloud** — free tier, no run-count anxiety, real churn (frequent UI releases), representative SaaS-console DOM complexity.
- **Commercial anchor: Datadog** — highest pain, highest willingness-to-pay, tech-adjacent to founder network.
- **First ugly task (gate task):** *"Install and configure a data-source integration end-to-end, including its settings panel, then create an alert rule with a notification channel, and verify the alert appears in the list."* Chosen because the integration-setup portion is genuinely UI-only and the flow is long enough (8–12 steps) to make step-level validity statistics meaningful.
- **Week-0 task census (new, 2 days):** before locking, enumerate 15–20 candidate tasks across Datadog/Grafana/Sentry and mark each: API-coverable? Terraform-coverable? UI-only? Frequency? Pain? The anchor task set = the UI-only, high-frequency survivors. If fewer than ~6 survive, the anchor vertical is wrong — switch to the backup vertical below *before* building.
- **Backup vertical (pre-committed, so a pivot is a decision already made):** vendor security-review portals — browser-only by design, no API by construction, proven willingness-to-pay (Conveyor/Vanta-adjacent budgets), painful enough that humans dread it.

Selection rule (unchanged, now actually enforced by the census): **high-frequency + browser-only + no meaningful API + painful enough to pay for.**

## 9. Success metrics — now defined

**The one number: replay-validity**, defined precisely:

> **Step-level replay-validity over a window:** of all compiled steps executed in replay across the measurement window, the fraction whose post-condition assertion passes without model fallback.
> **Protocol:** compile the gate task once on day 0; replay it **3×/day for 14 days** against the live test-bed site (≥42 runs, ≥400 step-executions); no manual fixes during the window; repairs are performed by the loop and counted.

Gates:
- **Step-validity ≥ 80% over the 14-day window** AND **task-level success (with ≤2 repairs/run) ≥ 90%** → thesis holds, build Phase 2.
- **Step-validity < ~50%**, or **mean repair cost ≥ 70% of fresh-reasoning cost** (tokens + wall-clock, measured, not estimated) → thesis is dead → stop before the raise.
- In between → extend the window, add a second site, decide on data.

Secondary metrics: amortized tokens/task over N runs (must trend down and be plottable — this plot *is* the demo); cache hit-rate on anchor tasks over time (up); self-heal success rate on assertion failure (target ≥ 70% of failures repaired without human touch); time-to-repair; **canary-leak count (must be 0, always, from §6.4)**.

## 10. The build — inverted so the gate comes first

v0.1 scheduled the gate measurement in parallel with the microVM — but the gate needs the compiler loop, not the VM. The VM was the most expensive item and the *least* necessary for the riskiest claim. Fixed:

| Phase | Duration | Build | Exit criterion |
|---|---|---|---|
| **0 — Census** | 2 days | Task census on Datadog/Grafana/Sentry (§8); lock anchor task set; ToS review of test-bed | ≥6 UI-only high-frequency tasks, or pivot to backup vertical |
| **1 — Gate harness** | Weeks 1–2 | Throwaway loop: model records gate task once → hand-assisted compile to CDP/Playwright script *with per-step assertions* → cron 3×/day. Instrument everything (§9). Start the 14-day clock **at end of week 1**. | Harness running unattended; canary test green |
| **2 — Real loop** | Weeks 2–4 (overlaps the measurement window) | Task-state machine on CDP: steps, assertions, checkpoints; automatic compiler (no hand-assist); repair-on-assertion-failure end-to-end; tenant-scoped cache with §6 schema + write-time enforcement + red-team CI test | One real self-heal observed and logged |
| **3 — Decision** | End week 4 | Read the 14-day number against §9 gates | Build / extend / stop |
| **4 — Post-gate** | Weeks 5–8 | microVM runtime (checkpoint/restore, fork/speculate, deterministic replay); second anchor task; demo hardening | The demo below |
| **Parallel track** | Weeks 1–8 | Design-partner conversations with 5 teams matching the persona (§13) — sell the single-tenant wedge, not the network effect | 2 committed design partners by demo |

**The demo:** one task that costs full price once and pennies forever after — shown as the amortized-cost plot from §9 — and heals itself live when we break a selector on stage.

**The raise:** proof raise after the Phase-3 number. Not a narrative raise before it. (Decision 3 from v0.1 — resolved.)

## 11. Risks & open threats

- **Staleness** (research-flagged): high-confidence memory stays wrong after a site changes. Mitigation: assertion-guards + confidence decay + self-heal. Design law, not feature. *Now directly measured by the 14-day protocol.*
- **Cross-tenant leakage** (research-flagged, structural): §6 mechanism + merge-blocking canary test. Enforced at write-time or the company dies on first incident.
- **Anchor is API-displaceable:** the sharpest v0.1 blind spot. Mitigation: the week-0 census gates the anchor on *task-level* browser-onlyness; backup vertical pre-committed.
- **Session custody breach:** we hold customer cookies. Mitigation: §7 custody requirements from day one.
- **Permission / bot-detection / ToS:** sites are closing to agents; a visible cross-customer structural map is a legible target. v1 posture: customer-consented automation of the customer's own account, documented per anchor; hold the broader fight.
- **Solo + venture-scale signal:** answered with the Phase-3 number and two design partners, not narrative.
- **Platform competitors add caching** (new): Browserbase/Firecrawl could bolt on trajectory memory. Defense: the verified, assertion-guarded, privacy-bounded cache is the product, not a feature of hosting — and the census-picked vertical gives warm-cache depth a horizontal platform won't match early.

## 12. Positioning vs prior art

- **WebCoach (Nov 2025):** validates cross-agent trajectory memory. We differ as the production system: write-time privacy boundary, assertion-guarded replay, vertical-warmed cache.
- **Mem0 / general agent memory:** general-purpose, early on procedural memory. We are browser-procedural-memory-with-verification specifically.
- **Vercel agent-browser / Browserbase / Firecrawl:** loss-leaders for hosting/sessions/data. We sit above them; our value is the accumulated verified cache, not the snapshot. (See competitor-response risk, §11.)

## 13. Personas & pricing hypothesis (new)

**Buyer/user (v1):** platform/DevOps engineer or SRE lead at a 50–500-person company running 3+ SaaS consoles, already experimenting with agents, currently burning either engineer-hours or large token budgets on repetitive console work. Champions on reliability, buys on cost.

**Pricing hypothesis (to test with design partners, not to commit):** usage-based with a margin story that improves as the cache warms — e.g., per-task pricing at a discount to raw-model cost, where replay-hits are near-pure margin. The customer's bill goes *down* per task over time while margin goes *up*: aligned incentives, and the pricing page is itself the thesis. Floor: platform fee for session custody + tenant cache.

## 14. Decisions — all resolved

1. **Login fork:** **A** (§7).
2. **Anchor:** test-bed Grafana Cloud, commercial anchor Datadog, gate task per §8, subject only to the week-0 census; backup vertical pre-committed.
3. **Raise timing:** proof raise after the Phase-3 number (§10).

---

*Next artifact: system design — components and interfaces, the cache schema with the §6 allowlist and taint rules expressed in the tables, the canary CI test, and the Phase-1 harness spec.*
