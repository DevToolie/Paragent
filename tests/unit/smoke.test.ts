import { describe, it, expect } from "vitest";
import { PACKAGE as testbed } from "../../src/testbed/index.js";
import { PACKAGE as recorder } from "../../src/recorder/index.js";

describe("wave0 smoke", () => {
  it("exposes package stubs for parallel agents", () => {
    expect(testbed).toBe("testbed");
    expect(recorder).toBe("recorder");
  });
});
