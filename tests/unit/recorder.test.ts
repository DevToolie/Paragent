import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { describe, expect, it } from "vitest";
import {
  assertNoLiteralSecrets,
  PACKAGE,
  TrajectoryRecorder,
  templatizeUrl,
} from "../../src/recorder/index.js";

const require = createRequire(import.meta.url);
const Ajv2020 = require("ajv/dist/2020.js");
const addFormats = require("ajv-formats");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("recorder package", () => {
  it("exports package id", () => {
    expect(PACKAGE).toBe("recorder");
  });

  it("templatizes host and port", () => {
    const { template, paramRefs } = templatizeUrl("http://127.0.0.1:3000/login", {
      host: "127.0.0.1",
      port: 3000,
    });
    expect(template).toBe("http://{host}:{port}/login");
    expect(paramRefs.sort()).toEqual(["host", "port"]);
  });

  it("records fixture gate task with schema-valid, value-free trajectory", async () => {
    const schema = JSON.parse(
      await readFile(path.join(ROOT, "contracts/trajectory.schema.json"), "utf8"),
    );
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    const validate = ajv.compile(schema);

    const fixturePath = path.join(ROOT, "src/recorder/fixtures/grafana-gate-login.html");
    const fixtureRoot = path.dirname(fixturePath).replace(/\\/g, "/");

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      const recorder = new TrajectoryRecorder(page, {
        trajectory_id: "traj-unit-fixture",
        site_key: "grafana-oss@fixture",
        task_key: "login-open-dashboards-list",
        base_url_template: "file://{fixture_root}/grafana-gate-login.html",
        provenance: { recorder: "test", agent_model: "human", testbed_version: "fixture-v1" },
        parameters: {
          fixture_root: "string",
          username: "string",
          password: "secret_ref",
        },
        bindings: { fixture_root: fixtureRoot },
      });

      await recorder.navigate(
        "file://{fixture_root}/grafana-gate-login.html",
        "Open the login page",
        ["fixture_root"],
      );
      await recorder.fill(
        page.getByLabel("Username"),
        "username",
        "canary-user-never-persist",
        "Fill username",
      );
      await recorder.fill(
        page.getByLabel("Password"),
        "password",
        "canary-secret-never-persist",
        "Fill password",
      );
      await recorder.click(page.getByRole("button", { name: "Log in" }), "Submit login");
      await recorder.click(page.getByTestId("nav-dashboards"), "Open dashboards list");

      const traj = recorder.toTrajectory();
      const text = JSON.stringify(traj);
      assertNoLiteralSecrets(text);
      expect(text).not.toContain("canary-user-never-persist");
      expect(text).not.toContain("canary-secret-never-persist");
      expect(traj.parameters.username).toBe("string");
      expect(traj.parameters.password).toBe("secret_ref");
      expect(traj.steps.length).toBeGreaterThanOrEqual(5);
      const fillStep = traj.steps.find((s) => s.action.type === "fill");
      expect(fillStep?.locator_candidates.length).toBeGreaterThanOrEqual(2);
      expect(fillStep?.locator_candidates[0]?.strategy).toBe("role_name");
      expect(validate(traj)).toBe(true);
    } finally {
      await browser.close();
    }
  }, 60_000);
});
