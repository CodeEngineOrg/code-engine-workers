"use strict";

const WorkerPool = require("../utils/worker-pool");
const createModule = require("../utils/create-module");
const createContext = require("../utils/create-context");
const createEventEmitter = require("../utils/create-event-emitter");
const { createFile, createChangedFile } = require("@code-engine/utils");
const { assert, expect } = require("chai");

describe("Executor.processFile()", () => {
  let context, pool;

  beforeEach("create a new WorkerPool and Context", () => {
    let emitter = createEventEmitter();
    context = createContext();
    pool = WorkerPool.create(emitter, context);
  });

  it("should support FileProcessors that return nothing", async () => {
    let moduleId = await createModule(() => undefined);
    let processFile = await pool.importFileProcessor(moduleId);
    let generator = processFile(createFile({ path: "file.txt" }), context);
    let { done, value } = await generator.next();

    expect(done).to.equal(true);
    expect(value).to.equal(undefined);
  });

  it("should support FileProcessors that return a single file", async () => {
    let moduleId = await createModule(() => ({ path: "file1.txt" }));
    let processFile = await pool.importFileProcessor(moduleId);
    let generator = processFile(createFile({ path: "file.txt" }), context);
    let file1 = await generator.next();

    expect(file1.value).to.deep.equal({ path: "file1.txt" });
  });

  it("should support FileProcessors that return an array of files", async () => {
    let moduleId = await createModule(() => [{ path: "file1.txt" }, { path: "file2.txt" }]);
    let processFile = await pool.importFileProcessor(moduleId);
    let generator = processFile(createFile({ path: "file.txt" }), context);

    let file1 = await generator.next();
    expect(file1.value).to.deep.equal({ path: "file1.txt" });

    let file2 = await generator.next();
    expect(file2.value).to.deep.equal({ path: "file2.txt" });
  });

  it("should support FileProcessors that generate files", async () => {
    let moduleId = await createModule(function* () {
      yield { path: "file1.txt" };
      yield { path: "file2.txt" };
    });
    let processFile = await pool.importFileProcessor(moduleId);
    let generator = processFile(createFile({ path: "file.txt" }), context);

    let file1 = await generator.next();
    expect(file1.value).to.deep.equal({ path: "file1.txt" });

    let file2 = await generator.next();
    expect(file2.value).to.deep.equal({ path: "file2.txt" });
  });

  it("should support FileProcessors that generate files asynchronously", async () => {
    let moduleId = await createModule(async function* () {
      yield { path: "file1.txt" };
      await Promise.resolve();
      yield { path: "file2.txt" };
    });
    let processFile = await pool.importFileProcessor(moduleId);
    let generator = processFile(createFile({ path: "file.txt" }), context);

    let file1 = await generator.next();
    expect(file1.value).to.deep.equal({ path: "file1.txt" });

    let file2 = await generator.next();
    expect(file2.value).to.deep.equal({ path: "file2.txt" });
  });

  it("should invoke the FileProcessor without a `this` context", async () => {
    let moduleId = await createModule(function () {
      return {
        path: "file1.txt",
        text: Object.prototype.toString.call(this)
      };
    });
    let processFile = await pool.importFileProcessor(moduleId);
    let generator = processFile(createFile({ path: "file.txt" }), context);
    let { value } = await generator.next();
    let file1 = createFile(value);

    expect(file1.text).to.equal("[object Undefined]");
  });

  it("should send the build context across the thread boundary", async () => {
    let moduleId = await createModule((file, buildContext) => {
      return {
        path: "context-info.json",
        text: JSON.stringify({
          keys: Object.keys(buildContext),
          cwd: buildContext.cwd,
          dev: buildContext.dev,
          debug: buildContext.debug,
          fullBuild: buildContext.fullBuild,
          partialBuild: buildContext.partialBuild,
          changedFiles: buildContext.changedFiles,
        })
      };
    });

    let processFile = await pool.importFileProcessor(moduleId);
    let generator = processFile(createFile({ path: "file.txt" }), {
      cwd: "/users/jdoe/desktop",
      dev: true,
      debug: false,
      fullBuild: true,
      partialBuild: false,
      changedFiles: [],
    });

    let result = await generator.next();
    let json = JSON.parse(Buffer.from(result.value.contents).toString());

    expect(json).to.deep.equal({
      keys: ["cwd", "dev", "debug", "fullBuild", "partialBuild", "changedFiles", "log"],
      cwd: "/users/jdoe/desktop",
      dev: true,
      debug: false,
      fullBuild: true,
      partialBuild: false,
      changedFiles: [],
    });
  });

  it("should send the changed files across the thread boundary", async () => {
    let moduleId = await createModule((file, buildContext) => {
      return {
        path: "changed-files.json",
        text: JSON.stringify(buildContext.changedFiles)
      };
    });

    context.changedFiles = [
      createChangedFile({
        path: "new-file.txt",
        change: "created",
        createdAt: new Date("2005-05-05T05:05:05.005Z"),
        modifiedAt: new Date("2005-05-05T05:05:05.005Z"),
        metadata: { foo: "bar" },
        text: "Hello, world! ",
      }),
      createChangedFile({
        path: "deleted-file.txt",
        change: "deleted",
        createdAt: new Date("2009-09-09T09:09:09.009Z"),
        modifiedAt: new Date("2009-09-09T09:09:09.009Z"),
        metadata: { biz: "baz" },
        text: "Goodbye, cruel world! ".repeat(5000),
      }),
    ];

    let processFile = await pool.importFileProcessor(moduleId);
    let generator = processFile(createFile({ path: "file.txt" }), context);

    let result = await generator.next();
    let json = JSON.parse(Buffer.from(result.value.contents).toString());

    expect(json).to.deep.equal([
      {
        path: "new-file.txt",
        source: "code-engine://plugin/new-file.txt",
        change: "created",
        createdAt: "2005-05-05T05:05:05.005Z",
        modifiedAt: "2005-05-05T05:05:05.005Z",
        metadata: { foo: "bar" },
        contents: Buffer.alloc(0).toJSON(),
      },
      {
        path: "deleted-file.txt",
        source: "code-engine://plugin/deleted-file.txt",
        change: "deleted",
        createdAt: "2009-09-09T09:09:09.009Z",
        modifiedAt: "2009-09-09T09:09:09.009Z",
        metadata: { biz: "baz" },
        contents: Buffer.alloc(0).toJSON(),
      },
    ]);
  });

  it("should invoke the FileProcessor without a `this` context", async () => {
    let moduleId = await createModule(function () {
      return {
        path: "file1.txt",
        text: Object.prototype.toString.call(this)
      };
    });
    let processFile = await pool.importFileProcessor(moduleId);
    let generator = processFile(createFile({ path: "file.txt" }), context);
    let { value } = await generator.next();
    let file1 = createFile(value);

    expect(file1.text).to.equal("[object Undefined]");
  });

  it("should not copy shared ArrayBuffer data rather than transferring it", async () => {
    // Allocate 50 bytes of shared memory, and fill it with "X"
    let sharedMemory = new ArrayBuffer(50);
    Buffer.from(sharedMemory).write("X".repeat(50));

    // Use 10 bytes of the shared memory for the file contents
    let mainThreadFile = createFile({
      path: "file.txt",
      contents: Buffer.from(sharedMemory, 20, 12),
    });
    mainThreadFile.contents.write("Hello, world");

    // The worker thread modifies the file contents in-place
    let moduleId = await createModule(function (workerThreadFile) {
      workerThreadFile.contents.write("ABC", 5);
      return workerThreadFile;
    });

    let processFile = await pool.importFileProcessor(moduleId);
    let generator = processFile(mainThreadFile, context);

    let output = await generator.next();
    let outputFile = createFile(output.value);

    // The output file should have the modified contents
    expect(outputFile.text).to.equal("HelloABCorld");

    // But the original file's contents should remain unchanged
    expect(mainThreadFile.text).to.equal("Hello, world");

    // And the shared memory should remain unchanged
    expect(Buffer.from(sharedMemory).toString()).to.equal(
      "XXXXXXXXXXXXXXXXXXXXHello, worldXXXXXXXXXXXXXXXXXX"
    );
  });

  it("should transfer ArrayBuffer data rather than copying it", async () => {
    // Allocate 50 bytes of memory, and fill it with "X"
    let memory = new ArrayBuffer(50);
    Buffer.from(memory).write("X".repeat(50));

    // Use the entire memory buffer for the file contents
    let mainThreadFile = createFile({
      path: "file.txt",
      contents: Buffer.from(memory),
    });
    mainThreadFile.contents.write("Hello, world", 20);

    // The worker thread modifies the file contents in-place
    let moduleId = await createModule(function (workerThreadFile) {
      workerThreadFile.contents.write("ABC", 5);
      return workerThreadFile;
    });

    let processFile = await pool.importFileProcessor(moduleId);
    let generator = processFile(mainThreadFile, context);

    let output = await generator.next();
    let outputFile = createFile(output.value);

    // The output file should have the modified contents
    expect(outputFile.text).to.equal("XXXXXABCXXXXXXXXXXXXHello, worldXXXXXXXXXXXXXXXXXX");

    // The original file's contents should be empty now,
    // since the memory was transferred to the worker thread
    expect(mainThreadFile.text).to.equal("");
    expect(mainThreadFile.contents.byteLength).to.equal(0);

    // The original file's memory buffer is now empty
    expect(mainThreadFile.contents.buffer).to.equal(memory);
    expect(memory.byteLength).to.equal(0);

    try {
      // The memory buffer can no longer be used
      Buffer.from(memory);
      assert.fail("An error should have been thrown");
    }
    catch (error) {
      expect(error).to.be.an.instanceOf(TypeError);
      expect(error.message).to.match(/^Cannot perform Construct on a (neutered|detached) ArrayBuffer$/);
    }
  });

  it("should throw an error if the FileProcessor returns an invalid value", async () => {
    let moduleId = await createModule(() => false);
    let processFile = await pool.importFileProcessor(moduleId);
    let generator = processFile(createFile({ path: "file.txt" }), context);

    try {
      await generator.next();
      assert.fail("An error should have been thrown");
    }
    catch (error) {
      expect(error).to.be.an.instanceOf(TypeError);
      expect(error.message).to.equal("Invalid CodeEngine file: false. Expected an object with at least a \"path\" property.");
    }
  });

  it("should throw an error if the FileProcessor returns an invalid value asynchronously", async () => {
    let moduleId = await createModule(() => Promise.resolve(12345));
    let processFile = await pool.importFileProcessor(moduleId);
    let generator = processFile(createFile({ path: "file.txt" }), context);

    try {
      await generator.next();
      assert.fail("An error should have been thrown");
    }
    catch (error) {
      expect(error).to.be.an.instanceOf(TypeError);
      expect(error.message).to.equal("Invalid CodeEngine file: 12345. Expected an object with at least a \"path\" property.");
    }
  });

  it("should throw an error if the FileProcessor returns an iterable with an invalid value", async () => {
    let moduleId = await createModule(async function*() {
      yield { path: "file1.txt" };
      yield { foo: "file2.txt" };
    });
    let processFile = await pool.importFileProcessor(moduleId);
    let generator = processFile(createFile({ path: "file.txt" }), context);

    let file1 = await generator.next();
    expect(file1.value).to.deep.equal({ path: "file1.txt" });

    try {
      await generator.next();
      assert.fail("An error should have been thrown");
    }
    catch (error) {
      expect(error).to.be.an.instanceOf(TypeError);
      expect(error.message).to.equal("Invalid CodeEngine file: {foo}. Expected an object with at least a \"path\" property.");
    }
  });

});
