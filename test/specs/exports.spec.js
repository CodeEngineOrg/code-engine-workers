"use strict";

const commonJSExport = require("../../");
const { default: defaultExport, WorkerPool } = require("../../");
const { expect } = require("chai");

describe("@code-engine/workers package exports", () => {

  it("should not have a default ESM export", () => {
    expect(defaultExport).to.be.equal(undefined);
  });

  it("should export the WorkerPool class as a named export", () => {
    expect(WorkerPool).to.be.a("function");
    expect(WorkerPool.name).to.equal("WorkerPool");
  });

  it("should not export anything else", () => {
    expect(commonJSExport).to.have.keys(
      "WorkerPool",
    );
  });

});
