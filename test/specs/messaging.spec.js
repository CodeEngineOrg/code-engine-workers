"use strict";

const WorkerPool = require("../utils/worker-pool");
const createModule = require("../utils/create-module");
const createRun = require("../utils/create-run");
const createEngine = require("../utils/create-engine");
const { createFile } = require("@code-engine/utils");
const { assert, expect } = require("chai");
const sinon = require("sinon");

describe("WorkerPool messaging between threads", () => {
  let run, pool;

  beforeEach("create a new WorkerPool and Run", () => {
    let engine = createEngine();
    run = createRun(engine);
    pool = WorkerPool.create(engine);
  });

  it("should send log messages from worker threads to the main thread", async () => {
    run.debug = true;

    let moduleId = await createModule((file, { log }) => {
      log("This is a log message", { foo: "bar" });
      log(new RangeError("This is an error"), { fizz: "buzz" });
      log.info("This is an info message", { up: "down" });
      log.warn("This is a warning message", { answer: 42 });
      log.error("This is an error message", { today: new Date("2005-05-05T05:05:05.005Z") });
      log.debug("This is a debug message", { biz: "baz" });
    });

    let processFile = await pool.importFileProcessor(moduleId);
    await processFile(createFile({ path: "file.txt" }), run).next();

    sinon.assert.calledTwice(run.log.info);
    expect(run.log.info.firstCall.args[0]).to.equal("This is a log message");
    expect(run.log.info.firstCall.args[1]).to.deep.equal({ foo: "bar" });

    expect(run.log.info.secondCall.args[0]).to.equal("This is an info message");
    expect(run.log.info.secondCall.args[1]).to.deep.equal({ up: "down" });

    sinon.assert.calledOnce(run.log.warn);
    expect(run.log.warn.firstCall.args[0]).to.equal("This is a warning message");
    expect(run.log.warn.firstCall.args[1]).to.deep.equal({ answer: 42 });

    sinon.assert.calledTwice(run.log.error);
    expect(run.log.error.firstCall.args[0]).to.be.an.instanceOf(RangeError);
    expect(run.log.error.firstCall.args[0]).to.have.property("message", "This is an error");
    expect(run.log.error.firstCall.args[1]).to.deep.equal({ fizz: "buzz" });

    expect(run.log.error.secondCall.args[0]).to.equal("This is an error message");
    expect(run.log.error.secondCall.args[1]).to.deep.equal({ today: new Date("2005-05-05T05:05:05.005Z") });

    // Lots of debug messages get logged for various things, so we have to filter the calls
    let debugLogs = run.log.debug.getCalls().filter((call) => call.args[1].biz === "baz");
    expect(debugLogs).to.have.lengthOf(1);
    expect(debugLogs[0].args[0]).to.equal("This is a debug message");
    expect(debugLogs[0].args[1]).to.deep.equal({ biz: "baz" });
  });

  it("should not send debug log messages from worker threads to the main thread if run.debug is false", async () => {
    run.debug = false;

    let moduleId = await createModule((file, { log }) => {
      log.debug("This is a debug message", { biz: "baz" });
    });

    let processFile = await pool.importFileProcessor(moduleId);
    await processFile(createFile({ path: "file.txt" }), run).next();

    // Lots of debug messages get logged for various things.
    // But for the purposes of this test, we only care that the log message above was NOT logged.
    let debugLogs = run.log.debug.getCalls().filter((call) => call.args[1].biz === "baz");
    expect(debugLogs).to.have.lengthOf(0);
  });

  it("should send errors from worker threads to the main thread while importing a module", async () => {
    let moduleId = await createModule(
      (data) => {
        let error = new URIError("Boom!");
        Object.assign(error, data);
        throw error;
      }
    );

    try {
      await pool.importFileProcessor(moduleId, {
        foo: "bar",
        answer: 42,
        when: new Date("2005-05-05T05:05:05.005Z")
      });
      assert.fail("An error should have been thrown");
    }
    catch (error) {
      expect(error).to.be.an.instanceOf(URIError);
      expect(error.message).to.equal(`Error importing module: ${moduleId} \nBoom!`);
      expect(error.toJSON()).to.deep.equal({
        name: "URIError",
        message: `Error importing module: ${moduleId} \nBoom!`,
        stack: error.stack,
        moduleId,
        workerId: error.workerId,
        foo: "bar",
        answer: 42,
        when: new Date("2005-05-05T05:05:05.005Z")
      });
    }
  });

  it("should send errors from worker threads to the main thread while processing a file", async () => {
    let moduleId = await createModule(() => { throw new RangeError("It's out of range!"); });
    let processFile = await pool.importFileProcessor(moduleId);

    try {
      await processFile(createFile({ path: "file.txt" }), run).next();
      assert.fail("An error should have been thrown");
    }
    catch (error) {
      expect(error).to.be.an.instanceOf(RangeError);
      expect(error.message).to.equal("It's out of range!");
      expect(error.toJSON()).to.deep.equal({
        name: "RangeError",
        message: "It's out of range!",
        stack: error.stack,
      });
    }
  });

  it("should convert custom Error classes to normal Errors", async () => {
    let moduleId = await createModule(() => {
      class MyCustomError extends RangeError {
        constructor () {
          super("A custom error has occurred.");
          this.name = "MyCustomError";
          this.foo = "bar";
          this.answer = 42;
          this.when = new Date("2005-05-05T05:05:05.005Z");
        }
      }

      throw new MyCustomError();
    });

    let processFile = await pool.importFileProcessor(moduleId);

    try {
      await processFile(createFile({ path: "file.txt" }), run).next();
      assert.fail("An error should have been thrown");
    }
    catch (error) {
      expect(error).to.be.an.instanceOf(Error);
      expect(error).not.to.be.an.instanceOf(RangeError);
      expect(error.message).to.equal("A custom error has occurred.");
      expect(error.toJSON()).to.deep.equal({
        name: "Error",
        message: "A custom error has occurred.",
        stack: error.stack,
        foo: "bar",
        answer: 42,
        when: new Date("2005-05-05T05:05:05.005Z")
      });
    }
  });

  it("should send non-Error objects thrown in worker threads to the main thread", async () => {
    let moduleId = await createModule(
      () => { throw "This is not an error"; },  // eslint-disable-line no-throw-literal
    );

    let processFile = await pool.importFileProcessor(moduleId);

    try {
      await processFile(createFile({ path: "file.txt" }), run).next();
      assert.fail("An error should have been thrown");
    }
    catch (error) {
      expect(error).to.equal("This is not an error");
    }
  });

  it("should emit an error event", async () => {
    let moduleId = await createModule(
      () => { throw "This is not an error"; },  // eslint-disable-line no-throw-literal
    );

    let processFile = await pool.importFileProcessor(moduleId);

    try {
      await processFile(createFile({ path: "file.txt" }), run).next();
      assert.fail("An error should have been thrown");
    }
    catch (error) {
      expect(error).to.equal("This is not an error");
    }
  });

});
