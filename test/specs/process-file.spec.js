"use strict";

const WorkerPool = require("../utils/worker-pool");
const createModule = require("../utils/create-module");
const createContext = require("../utils/create-context");
const { createFile } = require("@code-engine/utils");
const { assert, expect } = require("chai");

describe("Executor.processFile()", () => {
  let context, pool;

  beforeEach("create a new WorkerPool and Context", () => {
    context = createContext();
    pool = WorkerPool.create(undefined, context);
  });

  it("should support FileProcessors that return nothing", async () => {
    let moduleId = await createModule(() => undefined);
    let processFile = await pool.loadFileProcessor(moduleId);
    let generator = processFile(createFile("file.txt"), context);
    let { done, value } = await generator.next();
    expect(done).to.equal(true);
    expect(value).to.equal(undefined);
  });

  it("should support FileProcessors that return a single file", async () => {
    let moduleId = await createModule(() => ({ path: "file1.txt" }));
    let processFile = await pool.loadFileProcessor(moduleId);
    let generator = processFile(createFile("file.txt"), context);
    let file1 = await generator.next();
    expect(file1.value.path).to.equal("file1.txt");
  });

  it("should support FileProcessors that return an array of files", async () => {
    let moduleId = await createModule(() => [{ path: "file1.txt" }, { path: "file2.txt" }]);
    let processFile = await pool.loadFileProcessor(moduleId);
    let generator = processFile(createFile("file.txt"), context);

    let file1 = await generator.next();
    expect(file1.value.path).to.equal("file1.txt");

    let file2 = await generator.next();
    expect(file2.value.path).to.equal("file2.txt");
  });

  it("should support FileProcessors that generate files", async () => {
    let moduleId = await createModule(function* () {
      yield { path: "file1.txt" };
      yield { path: "file2.txt" };
    });
    let processFile = await pool.loadFileProcessor(moduleId);
    let generator = processFile(createFile("file.txt"), context);

    let file1 = await generator.next();
    expect(file1.value.path).to.equal("file1.txt");

    let file2 = await generator.next();
    expect(file2.value.path).to.equal("file2.txt");
  });

  it("should support FileProcessors that generate files asynchronously", async () => {
    let moduleId = await createModule(async function* () {
      yield { path: "file1.txt" };
      await Promise.resolve();
      yield { path: "file2.txt" };
    });
    let processFile = await pool.loadFileProcessor(moduleId);
    let generator = processFile(createFile("file.txt"), context);

    let file1 = await generator.next();
    expect(file1.value.path).to.equal("file1.txt");

    let file2 = await generator.next();
    expect(file2.value.path).to.equal("file2.txt");
  });

  it("should invoke the FileProcessor without a `this` context", async () => {
    let moduleId = await createModule(function () {
      return {
        path: "file1.txt",
        text: Object.prototype.toString.call(this)
      };
    });
    let processFile = await pool.loadFileProcessor(moduleId);
    let generator = processFile(createFile("file.txt"), context);
    let { value } = await generator.next();
    let file1 = createFile(value);
    expect(file1.text).to.equal("[object Undefined]");
  });

  it("should throw an error if the FileProcessor returns an invalid value", async () => {
    let moduleId = await createModule(() => false);
    let processFile = await pool.loadFileProcessor(moduleId);
    let generator = processFile(createFile("file.txt"), context);

    try {
      await generator.next();
      assert.fail("An error should have been thrown");
    }
    catch (error) {
      expect(error).to.be.an.instanceOf(TypeError);
      expect(error.message).to.equal("[boolean] is not a valid CodeEngine file. Expected an object with at least a \"path\" property.");
    }
  });

  it("should throw an error if the FileProcessor returns an invalid value asynchronously", async () => {
    let moduleId = await createModule(() => Promise.resolve(12345));
    let processFile = await pool.loadFileProcessor(moduleId);
    let generator = processFile(createFile("file.txt"), context);

    try {
      await generator.next();
      assert.fail("An error should have been thrown");
    }
    catch (error) {
      expect(error).to.be.an.instanceOf(TypeError);
      expect(error.message).to.equal("[number] is not a valid CodeEngine file. Expected an object with at least a \"path\" property.");
    }
  });

  it("should throw an error if the FileProcessor returns an iterable with an invalid value", async () => {
    let moduleId = await createModule(async function*() {
      yield { path: "file1.txt" };
      yield { foo: "file2.txt" };
    });
    let processFile = await pool.loadFileProcessor(moduleId);
    let generator = processFile(createFile("file.txt"), context);

    let file1 = await generator.next();
    expect(file1.value.path).to.equal("file1.txt");

    try {
      await generator.next();
      assert.fail("An error should have been thrown");
    }
    catch (error) {
      expect(error).to.be.an.instanceOf(TypeError);
      expect(error.message).to.equal("[Object] is not a valid CodeEngine file. Expected an object with at least a \"path\" property.");
    }
  });

});
