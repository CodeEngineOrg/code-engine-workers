"use strict";

const { WorkerPool: WorkerPoolClass } = require("../../");
const { createFile } = require("@code-engine/utils");
const { assert, expect } = require("chai");
const WorkerPool = require("../utils/worker-pool");
const createModule = require("../utils/create-module");
const createContext = require("../utils/create-context");
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

    expect(noArgs).to.throw(Error);
    expect(noArgs).to.throw("A CodeEngine context object is required.");
  });

  it("should throw an error if called without a context object", async () => {
    function noContext () {
      return new WorkerPoolClass(4);
    }

    expect(noContext).to.throw(Error);
    expect(noContext).to.throw("A CodeEngine context object is required.");
  });

  it("should emit an error event if a worker crashes", async () => {
    let pool = WorkerPool.create();
    let onError = sinon.spy(() => pool.dispose());
    pool.on("error", onError);

    let moduleId = await createModule(async () => {
      // Wait a sec
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Then crash the worker thread
      process.exit(27);
    });

    let processFile = await pool.loadFileProcessor(moduleId);
    let context = createContext();

    try {
      await processFile(createFile({ path: "file.txt" }), context).next();
      assert.fail("An error should have been thrown");
    }
    catch (error) {
      // The WorkerPool.on("error") event fired as soon as the worker crashed
      sinon.assert.calledOnce(onError);
      expect(onError.firstCall.args).to.have.lengthOf(1);
      expect(onError.firstCall.args[0]).to.be.an.instanceOf(Error);
      expect(onError.firstCall.args[0].message).to.match(/^CodeEngine worker \#-?\d unexpectedly exited with code 27\.$/);
      expect(onError.firstCall.args[0].workerId).to.be.a("number");

      // In our error handler (Sinon spy above) we called WokerPool.dispose(),
      // which rejects our pending processFile() operation with this error:
      expect(error).to.be.an.instanceOf(Error);
      expect(error.message).to.equal("CodeEngine is terminating.");
    }
  });

  describe("concurrency", () => {
    it("should create a worker per CPU by default", async () => {
      let pool = WorkerPool.create();
      expect(pool.size).to.equal(os.cpus().length);
    });

    it("should create one worker", async () => {
      let pool = WorkerPool.create(1);
      expect(pool.size).to.equal(1);
    });

    it("should create more workers than CPUs", async () => {
      let size = os.cpus().length * 3;
      let pool = WorkerPool.create(size);
      expect(pool.size).to.equal(size);
    });

    it("should throw an error if concurrency is zero", async () => {
      function zero () {
        WorkerPool.create(0);
      }

      expect(zero).to.throw(RangeError);
      expect(zero).to.throw("Invalid concurrency: 0. Expected a positive integer.");
    });

    it("should throw an error if concurrency is negative", async () => {
      function negative () {
        WorkerPool.create(-1);
      }

      expect(negative).to.throw(RangeError);
      expect(negative).to.throw("Invalid concurrency: -1. Expected a positive integer.");
    });

    it("should throw an error if concurrency is infinite", async () => {
      function infinite () {
        WorkerPool.create(Infinity);
      }

      expect(infinite).to.throw(TypeError);
      expect(infinite).to.throw("Invalid concurrency: Infinity. Expected an integer.");
    });

    it("should throw an error if concurrency is not a whole number", async () => {
      function infinite () {
        WorkerPool.create(5.7);
      }

      expect(infinite).to.throw(TypeError);
      expect(infinite).to.throw("Invalid concurrency: 5.7. Expected an integer.");
    });

    it("should throw an error if concurrency is invalid", async () => {
      function infinite () {
        WorkerPool.create("a bunch");
      }

      expect(infinite).to.throw(TypeError);
      expect(infinite).to.throw("Invalid concurrency: \"a bunch\". Expected a number.");
    });
  });

  describe("dispose", () => {
    it("should ignore multiple dispose() calls", async () => {
      let pool = WorkerPool.create();
      expect(pool.isDisposed).to.equal(false);

      await pool.dispose();
      expect(pool.isDisposed).to.equal(true);

      await pool.dispose();
      expect(pool.isDisposed).to.equal(true);
    });

    it("should throw an error if used after dispose()", async () => {
      let pool = WorkerPool.create();
      await pool.dispose();

      try {
        await pool.loadFileProcessor({ moduleId: "foobar" });
        assert.fail("WorkerPool should have thrown an error");
      }
      catch (error) {
        expect(error).to.be.an.instanceOf(Error);
        expect(error.message).to.equal("CodeEngine cannot be used after it has been disposed.");
      }
    });
  });
});
