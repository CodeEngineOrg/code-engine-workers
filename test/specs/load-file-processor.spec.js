"use strict";

const WorkerPool = require("../utils/worker-pool");
const createModule = require("../utils/create-module");
const createContext = require("../utils/create-context");
const { createFile } = require("@code-engine/utils");
const { assert, expect } = require("chai");

describe("WorkerPool.loadFileProcessor()", () => {
  let context, pool;

  beforeEach("create a new WorkerPool and Context", () => {
    context = createContext();
    pool = WorkerPool.create(undefined, context);
  });

  it("should load a module from a moduleId (string)", async () => {
    let moduleId = await createModule((file) => file);
    let processFile = await pool.loadFileProcessor(moduleId);
    expect(moduleId).to.be.a("string");
    expect(processFile).to.be.a("function");
  });

  it("should load a module from a module definition (object)", async () => {
    let module = await createModule(() => (file) => file, { some: "data" });
    let processFile = await pool.loadFileProcessor(module);
    expect(module).to.be.an("object");
    expect(processFile).to.be.a("function");
  });

  it("should load a CommonJS module", async () => {
    let moduleId = await createModule((file) => {
      file.text = "Hi, from CommonJS!";
      return file;
    });

    let processFile = await pool.loadFileProcessor(moduleId);
    let generator = processFile(createFile({ path: "file.txt" }), context);
    let { value } = await generator.next();
    let file = createFile(value);

    expect(file.text).to.equal("Hi, from CommonJS!");
  });

  it("should load an ECMAScript module", async () => {
    let moduleId = await createModule(`{
      default: (file) => (file.text = "Hi, from ECMAScript!", file)
    }`);

    let processFile = await pool.loadFileProcessor(moduleId);
    let generator = processFile(createFile({ path: "file.txt" }), context);
    let { value } = await generator.next();
    let file = createFile(value);

    expect(file.text).to.equal("Hi, from ECMAScript!");
  });

  it("should load a CommonJS module with data", async () => {
    let moduleId = await createModule((data) => (file) => {
      file.text = data;
      return file;
    }, "CommonJS module with data");

    let processFile = await pool.loadFileProcessor(moduleId);
    let generator = processFile(createFile({ path: "file.txt" }), context);
    let { value } = await generator.next();
    let file = createFile(value);

    expect(file.text).to.equal("CommonJS module with data");
  });

  it("should load an ECMAScript module with data", async () => {
    let module = await createModule(`{
      default: (data) => (file) => (file.text = data, file)
    }`, "ECMAScript module with data");

    let processFile = await pool.loadFileProcessor(module);
    let generator = processFile(createFile({ path: "file.txt" }), context);
    let { value } = await generator.next();
    let file = createFile(value);

    expect(file.text).to.equal("ECMAScript module with data");
  });

  it("should load an asynchronous module", async () => {
    async function fileProcessor (file) {
      let before = Date.now();
      await new Promise((resolve) => setTimeout(resolve, 100));
      let after = Date.now();
      file.text = `${after - before}ms`;
      return file;
    }

    let moduleId = await createModule(fileProcessor);
    let processFile = await pool.loadFileProcessor(moduleId);
    let generator = processFile(createFile({ path: "file.txt" }), context);
    let { value } = await generator.next();
    let file = createFile(value);

    expect(file.text).to.match(/^1\d\dms$/);
  });

  it("should load an asynchronous module with data", async () => {
    async function factory (data) {
      let before = Date.now();
      await new Promise((resolve) => setTimeout(resolve, data));
      let after = Date.now();

      return (file) => {
        file.text = `${after - before}ms`;
        return file;
      };
    }

    let moduleId = await createModule(factory, 500);
    let processFile = await pool.loadFileProcessor(moduleId);
    let generator = processFile(createFile({ path: "file.txt" }), context);
    let { value } = await generator.next();
    let file = createFile(value);

    expect(file.text).to.match(/^5\d\dms$/);
  });

  it("should retain the FileProcessor name", async () => {
    let moduleId = await createModule(function myAwesomeFileProcessor () {});
    let processFile = await pool.loadFileProcessor(moduleId);
    expect(processFile.name).to.equal("myAwesomeFileProcessor");
  });

  it("should support unnamed FileProcessors", async () => {
    let moduleId = await createModule((file) => file);
    let processFile = await pool.loadFileProcessor(moduleId);
    expect(processFile.name).to.equal("");
  });

  it("should throw an error if the module doesn't export a function", async () => {
    let moduleId = await createModule("Math.PI");

    try {
      await pool.loadFileProcessor(moduleId);
      assert.fail("An error should have been thrown");
    }
    catch (error) {
      expect(error).to.be.an.instanceOf(TypeError);
      expect(error.message).to.equal(
        `Error loading module "${moduleId}". CodeEngine plugin modules must export a function.`);
    }
  });

  it("should throw an error if the module doesn't export anything", async () => {
    let moduleId = await createModule("undefined");

    try {
      await pool.loadFileProcessor(moduleId);
      assert.fail("An error should have been thrown");
    }
    catch (error) {
      expect(error).to.be.an.instanceOf(TypeError);
      expect(error.message).to.equal(
        `Error loading module "${moduleId}". CodeEngine plugin modules must export a function.`);
    }
  });

  it("should throw an error if the factory function doesn't export a function", async () => {
    let module = await createModule(
      function badFactory (data) { return data; },
      "Hello, World"
    );

    try {
      await pool.loadFileProcessor(module);
      assert.fail("An error should have been thrown");
    }
    catch (error) {
      expect(error).to.be.an.instanceOf(TypeError);
      expect(error.message).to.equal(
        `Error loading module "${module.moduleId}". The badFactory function should return a CodeEngine file processor.`);
    }
  });

  it("should throw an error if the factory function doesn't export anything", async () => {
    let module = await createModule(
      () => undefined,
      "Hello, World"
    );

    try {
      await pool.loadFileProcessor(module);
      assert.fail("An error should have been thrown");
    }
    catch (error) {
      expect(error).to.be.an.instanceOf(TypeError);
      expect(error.message).to.equal(
        `Error loading module "${module.moduleId}". The exported function should return a CodeEngine file processor.`);
    }
  });

});
