/**
 * Pinned-version product-vocabulary snapshot (issue #126).
 *
 * `UI_CHROME_NAMES` in allowlist.ts is a ~50-word hand-maintained list of
 * *generic* chrome ("Save", "Cancel"). It cannot know a specific vendor's own
 * UI vocabulary ("Add new panel", "toggle-viz-picker") because that
 * vocabulary is not generic across products — it is specific to one
 * self-hosted, open-source artifact at one pinned tag.
 *
 * This module is a second, narrower allowlist: strings independently
 * verified to be rendered by the pinned open-source software itself
 * (`scripts/testbed/matrix.json`), not by any tenant. It is additive to
 * `UI_CHROME_NAMES`, never a replacement — see `taint.ts`.
 *
 * ## Why a committed snapshot and not a live lookup
 *
 * The privacy boundary cannot depend on network reachability. A rule that
 * consulted GitHub at write time (or at CI time) would make the fail-closed
 * guarantee flaky on the one axis it must never be flaky on: whether a row
 * is safe to share. So this is a point-in-time snapshot, committed to the
 * repo, the same way `scripts/testbed/matrix.json` pins image tags instead
 * of resolving `latest`.
 *
 * ## Sourcing discipline (CONTRIBUTING rule 3)
 *
 * Every entry below carries the exact public source file (at the pinned
 * git tag) and the date it was fetched and read. An entry with no citation
 * is not shipped — see docs/gate/pool-vocabulary.md for the strings that
 * were *candidates* but could not be verified this way, and were left out
 * rather than guessed.
 *
 * ## Honest scope
 *
 * `scripts/testbed/matrix.json` pins 8 Grafana OSS versions. This snapshot
 * covers exactly **one**: 9.5.21, the only version with a compiled
 * trajectory in this repo
 * (`artifacts/compiled/traj-gate-live-create-stat-dashboard-from-testdata-9.5.21.bundle.json`).
 * Extending to the rest of the matrix means running the same live-recording
 * + verification process per version, which needs the Docker testbed this
 * environment does not have (see docs/gate/pool-vocabulary.md).
 */

export type VocabularyKind = "accessible_name" | "testid";

export interface VocabularySource {
  /** Public URL of the exact file, at the pinned tag, that renders this string. */
  readonly url: string;
  /** ISO date this source was fetched and read to confirm the string appears there. */
  readonly access_date: string;
  /** One line: where in the file, and how it reaches the DOM (aria-label, data-testid, ...). */
  readonly note: string;
}

export interface VocabularyEntry {
  readonly value: string;
  readonly kind: VocabularyKind;
  /** Arbitrary stable id for the product, matching scripts/testbed/matrix.json's `target`. */
  readonly software_id: string;
  /** Matches an `id` in scripts/testbed/matrix.json `versions[]`. */
  readonly pinned_version: string;
  readonly source: VocabularySource;
}

/**
 * grafana-oss @ 9.5.21 — five entries, each independently verified against
 * the public `grafana/grafana` GitHub repository at tag `v9.5.21` on
 * 2026-08-12. Four of the five are the exact locator names #126 named as
 * rejected on the live bundle; the fifth (`applyButton`'s testid) was found
 * while verifying the others and is included because it is equally sourced.
 *
 * "Apply" (the step-7 role_name/button text on the same bundle) is
 * deliberately NOT in this snapshot: it was not independently verified
 * against a public source in the time available, and the recorder already
 * marked that specific locator `tenant_scoped: true` — which this snapshot
 * could not have overridden anyway (see taint.ts `caller_marked_tenant`).
 */
export const VOCABULARY_SNAPSHOT: readonly VocabularyEntry[] = [
  {
    value: "Add new panel",
    kind: "accessible_name",
    software_id: "grafana-oss",
    pinned_version: "9.5.21",
    source: {
      url: "https://raw.githubusercontent.com/grafana/grafana/v9.5.21/public/app/features/dashboard/dashgrid/DashboardEmpty.tsx",
      access_date: "2026-08-12",
      note: "Line 42: aria-label=\"Add new panel\" on the empty-dashboard add-panel button.",
    },
  },
  {
    value: "toggle-viz-picker",
    kind: "accessible_name",
    software_id: "grafana-oss",
    pinned_version: "9.5.21",
    source: {
      url: "https://raw.githubusercontent.com/grafana/grafana/v9.5.21/public/app/features/dashboard/components/PanelEditor/VisualizationButton.tsx",
      access_date: "2026-08-12",
      note: "Line 45: aria-label={selectors.components.PanelEditor.toggleVizPicker}; selector value 'toggle-viz-picker' defined in packages/grafana-e2e-selectors/src/selectors/components.ts:139.",
    },
  },
  {
    value: "Plugin visualization item Stat",
    kind: "accessible_name",
    software_id: "grafana-oss",
    pinned_version: "9.5.21",
    source: {
      url: "https://raw.githubusercontent.com/grafana/grafana/v9.5.21/public/app/features/panel/components/VizTypePicker/PanelTypeCard.tsx",
      access_date: "2026-08-12",
      note: "Line 42: aria-label={selectors.components.PluginVisualization.item(plugin.name)}; template in components.ts:273 ('Plugin visualization item ${title}'); plugin.name is literally \"Stat\" per public/app/plugins/panel/stat/plugin.json.",
    },
  },
  {
    value: "Alias",
    kind: "accessible_name",
    software_id: "grafana-oss",
    pinned_version: "9.5.21",
    source: {
      url: "https://raw.githubusercontent.com/grafana/grafana/v9.5.21/public/app/plugins/datasource/testdata/QueryEditor.tsx",
      access_date: "2026-08-12",
      note: "Line 204: <InlineField label=\"Alias\" ...> in the TestData datasource query editor.",
    },
  },
  {
    value: "data-testid Apply changes and go back to dashboard",
    kind: "testid",
    software_id: "grafana-oss",
    pinned_version: "9.5.21",
    source: {
      url: "https://raw.githubusercontent.com/grafana/grafana/v9.5.21/public/app/features/dashboard/components/PanelEditor/PanelEditor.tsx",
      access_date: "2026-08-12",
      note: "Line 362: data-testid={selectors.components.PanelEditor.applyButton}; selector value in components.ts:138.",
    },
  },
];

function findEntry(
  value: string,
  kind: VocabularyKind,
): VocabularyEntry | undefined {
  return VOCABULARY_SNAPSHOT.find((e) => e.kind === kind && e.value === value);
}

/**
 * Is `value` a known accessible name (role_name `name`, or `label`) of the
 * pinned open-source software at ANY version in the snapshot?
 *
 * Version-blind on purpose, and the tradeoff is written down rather than
 * hidden: `CacheRowCandidate` / `CompiledLocator` carry no field today for
 * which pinned version produced a given row (the trajectory's
 * `provenance.testbed_version` is not threaded through the compiler — see
 * docs/gate/pool-vocabulary.md open questions). A version-blind match can
 * only ever ADD a real vendor string to the positive allowlist; it can
 * never admit tenant content, because membership still requires an exact
 * match against a source-cited, independently-verified string. The
 * imprecision this trades away is *attribution* (which version a match
 * came from), not the fail-closed guarantee itself.
 */
export function isKnownVendorAccessibleName(value: string): boolean {
  return findEntry(value, "accessible_name") !== undefined;
}

/** Same trade-off as {@link isKnownVendorAccessibleName}, for `data-testid` values. */
export function isKnownVendorTestId(value: string): boolean {
  return findEntry(value, "testid") !== undefined;
}

/** Snapshot entries for one pinned version — for reporting / docs, not the write path. */
export function vocabularyForVersion(
  softwareId: string,
  pinnedVersion: string,
): readonly VocabularyEntry[] {
  return VOCABULARY_SNAPSHOT.filter(
    (e) => e.software_id === softwareId && e.pinned_version === pinnedVersion,
  );
}
