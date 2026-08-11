/**
 * #141 — the bundled `--fixture` recording could not replay its own URL
 * assertions.
 *
 * The recorder wrote `file://{fixture_root}/grafana-gate-login.html`, making
 * `fixture_root` a whole filesystem path. The compiler compiles a hole to
 * `[^/?#]+`, which cannot span `/`, so the synthesized regex admitted one path
 * segment where a real path has many:
 *
 * ```text
 * url "file:///Users/…/src/recorder/fixtures/grafana-gate-login.html#home"
 *   !~ /^file://[^/?#]+/grafana-gate-login\.html#home$/
 * ```
 *
 * The fix is the URL shape, not the hole pattern — loosening `[^/?#]+` would
 * weaken every `url-matches` assertion the product emits. These tests pin the
 * shape at the source, cheaply; `tests/integration/pipeline.test.ts` proves the
 * whole record → compile → replay round trip through the same module.
 */
import { describe, expect, it } from "vitest";
import { templateToRegex } from "../../src/compiler/index.js";
import {
  FIXTURE_PAGE,
  FIXTURE_URL_TEMPLATE,
  startFixtureServer,
} from "../../src/recorder/fixture.js";

describe("fixture URL template (#141)", () => {
  it("compiles to a regex that matches the URL the fixture is served at", () => {
    const re = new RegExp(templateToRegex(FIXTURE_URL_TEMPLATE));
    expect(re.test(`http://127.0.0.1:54321/${FIXTURE_PAGE}`)).toBe(true);
    // The fixture's login click lands on `#home`; a fragment is part of the URL
    // the assertion sees, and the recorded template carries it in that step.
    const withFragment = new RegExp(
      templateToRegex(`${FIXTURE_URL_TEMPLATE}#home`),
    );
    expect(withFragment.test(`http://127.0.0.1:54321/${FIXTURE_PAGE}#home`)).toBe(
      true,
    );
  });

  it("is not the file:// shape, which cannot match a real path", () => {
    // The counter-case, kept so the reason survives: this is what the recorder
    // used to emit, and it is unmatchable by construction.
    const old = new RegExp(templateToRegex(`file://{fixture_root}/${FIXTURE_PAGE}`));
    expect(old.test(`file:///Users/dev/paragent/src/recorder/fixtures/${FIXTURE_PAGE}`)).toBe(
      false,
    );
    expect(FIXTURE_URL_TEMPLATE).not.toContain("fixture_root");
    expect(FIXTURE_URL_TEMPLATE).not.toContain("file://");
  });

  it("serves the fixture over loopback and stops cleanly", async () => {
    const server = await startFixtureServer();
    try {
      expect(server.host).toBe("127.0.0.1");
      expect(server.port).toBeGreaterThan(0);
      const res = await fetch(`http://${server.host}:${server.port}/${FIXTURE_PAGE}`);
      expect(res.status).toBe(200);
      expect(await res.text()).toContain("Username");

      // Only the basename is honoured, so a traversal cannot leave the fixture
      // directory — this serves two static files to a local browser, nothing more.
      const escaped = await fetch(
        `http://${server.host}:${server.port}/../../../package.json`,
      );
      expect(escaped.status).toBe(404);
    } finally {
      await server.close();
    }
    // A closed server must actually be closed: the recorder exits after this.
    await expect(
      fetch(`http://${server.host}:${server.port}/${FIXTURE_PAGE}`),
    ).rejects.toThrow();
  });
});
