---
title: Week-0 census archive (FAILED observability anchor)
doc_type: research
status: killed
owner: B0
created: 2026-07-24
updated: 2026-07-24
confidence: HIGH
supersedes: null
sources_verified: true
---

# Week-0 census — observability config (KILLED)

This directory is an **asset**, not an embarrassment. It is the evidence-backed
falsification of the first anchor vertical.

**Verdict:** FAIL — 2 survivors of 70; no single-vendor concentration.
See `A8-DECISION.md`.

| File | Role |
| --- | --- |
| A1-datadog.md | Scout |
| A2-grafana.md | Scout |
| A3-sentry.md | Scout |
| A4-adversary.md | Kill list (51/70 FULLY_API) |
| A5-evidence.md | Frequency/pain evidence |
| A6-tos.md | ToS overlay |
| A7-backup.md | Backup vertical notes |
| A8-DECISION.md | Adjudicator memo |

Structural finding (paraphrased from A8): a vendor builds an API for whatever
its customers do repeatedly, so high-frequency and permanently browser-only are
nearly mutually exclusive **when the user is the vendor's customer**.

## Open questions / what I could not verify

- Whether any of the 2 survivors (SN-17, DD-06) deserve a follow-up outside the
  pivot — A8 says do not lock observability; leave that to founder.
