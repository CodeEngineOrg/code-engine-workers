"use strict";

const { WorkerPool: WorkerPoolClass } = require("../../");
const { createFile } = require("@code-engine/utils");
const { assert, expect } = require("chai");
const WorkerPool = require("../utils/worker-pool");
const createModule = require("../utils/create-module");
const createRun = require("../utils/create-run");
const createEngine = require("../utils/create-engine");
const sinon = require("sinon");
const os = require("os");

describe("WorkerPool class", () => {

  it('should not work without the "new" keyword', () => {
    function withoutNew () {
      // eslint-disable-next-line new-cap
      return WorkerPoolClass();
    }

    expect(withoutNew).to.throw(TypeError);
    expect(withoutNew).to.throw("Class constructor WorkerPool cannot be invoked without 'new'");
  });

  it("should throw an error if called without any arguments", async () => {
    function noArgs () {
      return new WorkerPoolClass();
    }

    expect(noArgs).to.throw(TypeError);
    expect(noArgs).to.throw("Invalid CodeEngine instance: undefined. A value is required.");
  });

  it("should throw an error if called with an invalid CWD", async () => {
    function badCWD () {
      let engine = createEngine({ cwd: "\n" });
      WorkerPool.create(engine);
    }

    expect(badCWD).to.throw(Error);
    expect(badCWD).to.throw('Invalid cwd: "\n". It cannot be all whitespace.');
  });

  describe("engine", () => {
    it("should emit an error event if a worker crashes", async () => {
      let engine = createEngine();
      let pool = WorkerPool.create(engine);

      let moduleId = await createModule(() => {
        // Crash the worker thread after half a second
        setTimeout(() => { throw new SyntaxError("Boom!"); }, 500);
      });

      // Import the module into all worker threads.
      // It will import successfully, and then crash the threads a half second later.
      await pool.importModule(moduleId);

      // Wait for the crash to occur
      await new Promise((resolve) => setTimeout(resolve, 800));

      // An "error" event should have beeen emitted
      sinon.assert.called(engine.emit);
      sinon.assert.calledWithExactly(engine.emit,
        "error",
        sinon.match({
          name: "SyntaxError",
          message: "Boom!"
        })
      );
    });

    it("should emit an error event if a worker exits unexpectedly", async () => {
      let engine = createEngine();
      let run = createRun(engine);
      let pool = WorkerPool.create(engine);

      let moduleId = await createModule(async () => {
        // Wait a sec
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Exit the worker thread
        process.exit(0);
      });

      let processFile = await pool.importFileProcessor(moduleId);

      try {
        await processFile(createFile({ path: "file.txt" }), run).next();
        assert.fail("An error should have been thrown");
      }
      catch (error) {
        expect(error).to.be.an.instanceOf(Error);
        expect(error.message).to.match(/^CodeEngine worker \#-?\d unexpectedly exited with code 0\.$/);

        // The WorkerPool also emitted the original error
        sinon.assert.calledOnce(engine.emit);
        sinon.assert.calledWithExactly(engine.emit, "error", error);
      }
    });
  });

  describe("log", () => {
    it("should log to the specified Logger", async () => {
      let engine = createEngine();
      let run = createRun(engine);
      let pool = WorkerPool.create(engine);

      let moduleId = await createModule((file, { log }) => {
        log("This is a log message");
        return file;
      });

      let processFile = await pool.importFileProcessor(moduleId);
      await processFile(createFile({ path: "file.txt" }), run).next();

      sinon.assert.callCount(run.log.info, 1);
      sinon.assert.calledWithExactly(run.log.info, "This is a log message", undefined);
    });
  });

  describe("concurrency", () => {
    it("should create one worker", async () => {
      let engine = createEngine({ concurrency: 1 });
      let pool = WorkerPool.create(engine);
      expect(pool.size).to.equal(1);
    });

    it("should create more workers than CPUs", async () => {
      let size = os.cpus().length * 3;
      let engine = createEngine({ concurrency: size });
      let pool = WorkerPool.create(engine);
      expect(pool.size).to.equal(size);
    });

    it("should throw an error if concurrency is zero", async () => {
      function zero () {
        let engine = createEngine({ concurrency: 0 });
        return WorkerPool.create(engine);
      }

      expect(zero).to.throw(RangeError);
      expect(zero).to.throw("Invalid concurrency: 0. Expected a positive integer.");
    });

    it("should throw an error if concurrency is negative", async () => {
      function negative () {
        let engine = createEngine({ concurrency: -1 });
        return WorkerPool.create(engine);
      }

      expect(negative).to.throw(RangeError);
      expect(negative).to.throw("Invalid concurrency: -1. Expected a positive integer.");
    });

    it("should throw an error if concurrency is infinite", async () => {
      function infinite () {
        let engine = createEngine({ concurrency: Infinity });
        return WorkerPool.create(engine);
      }

      expect(infinite).to.throw(TypeError);
      expect(infinite).to.throw("Invalid concurrency: Infinity. Expected an integer.");
    });

    it("should throw an error if concurrency is not a whole number", async () => {
      function infinite () {
        let engine = createEngine({ concurrency: 5.7 });
        return WorkerPool.create(engine);
      }

      expect(infinite).to.throw(TypeError);
      expect(infinite).to.throw("Invalid concurrency: 5.7. Expected an integer.");
    });

    it("should throw an error if concurrency is invalid", async () => {
      function infinite () {
        let engine = createEngine({ concurrency: "a bunch" });
        return WorkerPool.create(engine);
      }

      expect(infinite).to.throw(TypeError);
      expect(infinite).to.throw("Invalid concurrency: \"a bunch\". Expected a number.");
    });
  });

  describe("dispose", () => {
    it("should ignore multiple dispose() calls", async () => {
      let engine = createEngine();
      let pool = WorkerPool.create(engine);
      expect(pool.isDisposed).to.equal(false);

      await pool.dispose();
      expect(pool.isDisposed).to.equal(true);

      await pool.dispose();
      expect(pool.isDisposed).to.equal(true);
    });

    it("should throw an error if used after dispose()", async () => {
      let engine = createEngine();
      let pool = WorkerPool.create(engine);
      await pool.dispose();

      try {
        await pool.importFileProcessor({ moduleId: "foobar" });
        assert.fail("WorkerPool should have thrown an error");
      }
      catch (error) {
        expect(error).to.be.an.instanceOf(Error);
        expect(error.message).to.equal("CodeEngine cannot be used after it has been disposed.");
      }
    });
  });
});
