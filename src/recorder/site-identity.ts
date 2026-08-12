/**
 * `site_key` for a live recording (issue #124, ADR-0015).
 *
 * `site_key` names a product **version**, never an address.
 * `contracts/trajectory.schema.json`'s own field description has read
 * `"Logical site identity, e.g. grafana-oss@10.2.0"` since the schema was
 * written; the live recorder path baked `@{host}:{port}` in instead
 * (`grafana-oss@127.0.0.1:3000` on the one committed live bundle), which
 * disagreed with the schema's own example and — the part that actually
 * breaks something — duplicated data that is *already* parameterized on every
 * live trajectory: `base_url_template` is `http://{host}:{port}`, and
 * `parameters.host` / `parameters.port` carry the bindings. An identity field
 * and a parameter both encoding the same fact is how `site_key` ends up
 * "inconsistent" (#124's word) with the very fields it parameterizes.
 *
 * The consequence was concrete, not cosmetic: the same product at the same
 * version, recorded once against `127.0.0.1:3000` and again against
 * `10.0.0.4:3000`, produced two different `site_key`s and therefore two
 * unrelated cache entries for what is — by every field the schema actually
 * checks — the identical program. That is the gap #124 names: cross-instance
 * reuse was impossible by construction, not by policy.
 *
 * `buildLiveSiteKey` is deliberately shaped so that gap cannot come back:
 * it takes a product and a version and **nothing else**. There is no host or
 * port parameter to thread through by mistake, so two different addresses
 * cannot produce two different site_keys — the guarantee is in the function's
 * signature, not in a caller remembering to omit something.
 */

/**
 * `<product>@<version>`. `version` should be an observed fact (e.g. read off
 * `/api/health`, as `src/recorder/cli.ts` already does for
 * `provenance.testbed_version`), not a hand-typed guess — the same reasoning
 * `grafanaVersion()` already applies one field over.
 */
export function buildLiveSiteKey(product: string, version: string): string {
  return `${product}@${version}`;
}
