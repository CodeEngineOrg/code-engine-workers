"use strict";

const WorkerPool = require("../utils/worker-pool");
const createModule = require("../utils/create-module");
const createLogger = require("../utils/create-logger");
const createContext = require("../utils/create-context");
const { createFile } = require("@code-engine/utils");
const { assert, expect } = require("chai");

describe("WorkerPool.importFileProcessor()", () => {
  let context, pool;

  beforeEach("create a new WorkerPool and Context", () => {
    let log = createLogger();
    context = createContext({ log });
    pool = WorkerPool.create({ log });
  });

  it("should import a module from a moduleId (string)", async () => {
    let moduleId = await createModule((file) => file);
    let processFile = await pool.importFileProcessor(moduleId);
    expect(moduleId).to.be.a("string");
    expect(processFile).to.be.a("function");
  });

  it("should import a module from a module definition (object)", async () => {
    let module = await createModule(() => (file) => file, { some: "data" });
    let processFile = await pool.importFileProcessor(module);
    expect(module).to.be.an("object");
    expect(processFile).to.be.a("function");
  });

  it("should import a CommonJS module", async () => {
    let moduleId = await createModule((file) => {
      file.text = "Hi, from CommonJS!";
      return file;
    });

    let processFile = await pool.importFileProcessor(moduleId);
    let generator = processFile(createFile({ path: "file.txt" }), context);
    let { value } = await generator.next();
    let file = createFile(value);

    expect(file.text).to.equal("Hi, from CommonJS!");
  });

  it("should import an ECMAScript module", async () => {
    let moduleId = await createModule(
      'exports.default = (file) => (file.text = "Hi, from ECMAScript!", file)');

    let processFile = await pool.importFileProcessor(moduleId);
    let generator = processFile(createFile({ path: "file.txt" }), context);
    let { value } = await generator.next();
    let file = createFile(value);

    expect(file.text).to.equal("Hi, from ECMAScript!");
  });

  it("should import a CommonJS module with data", async () => {
    let moduleId = await createModule((data) => (file) => {
      file.text = data;
      return file;
    }, "CommonJS module with data");

    let processFile = await pool.importFileProcessor(moduleId);
    let generator = processFile(createFile({ path: "file.txt" }), context);
    let { value } = await generator.next();
    let file = createFile(value);

    expect(file.text).to.equal("CommonJS module with data");
  });

  it("should import an ECMAScript module with data", async () => {
    let module = await createModule(
      "exports.default = (data) => (file) => (file.text = data, file)",
      "ECMAScript module with data");

    let processFile = await pool.importFileProcessor(module);
    let generator = processFile(createFile({ path: "file.txt" }), context);
    let { value } = await generator.next();
    let file = createFile(value);

    expect(file.text).to.equal("ECMAScript module with data");
  });

  it("should import an asynchronous module", async () => {
    async function fileProcessor (file) {
      let before = Date.now();
      await new Promise((resolve) => setTimeout(resolve, 100));
      let after = Date.now();
      file.text = `${after - before}ms`;
      return file;
    }

    let moduleId = await createModule(fileProcessor);
    let processFile = await pool.importFileProcessor(moduleId);
    let generator = processFile(createFile({ path: "file.txt" }), context);
    let { value } = await generator.next();
    let file = createFile(value);

    expect(file.text).to.match(/^1\d\dms$/);
  });

  it("should import an asynchronous module with data", async () => {
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
    let processFile = await pool.importFileProcessor(moduleId);
    let generator = processFile(createFile({ path: "file.txt" }), context);
    let { value } = await generator.next();
    let file = createFile(value);

    expect(file.text).to.match(/^5\d\dms$/);
  });

  it("should retain the FileProcessor name", async () => {
    let moduleId = await createModule(function myAwesomeFileProcessor () {});
    let processFile = await pool.importFileProcessor(moduleId);
    expect(processFile.name).to.equal("myAwesomeFileProcessor");
  });

  it("should support unnamed FileProcessors", async () => {
    let moduleId = await createModule((file) => file);
    let processFile = await pool.importFileProcessor(moduleId);
    expect(processFile.name).to.equal("");
  });

  it("should throw an error if the module doesn't exist", async () => {
    try {
      await pool.importFileProcessor("foo-bar");
      assert.fail("An error should have been thrown");
    }
    catch (error) {
      expect(error).to.be.an.instanceOf(Error);
      expect(error.message).to.equal("Error importing module: foo-bar \nCannot find module: foo-bar");
    }
  });

  it("should throw an error if the module contains syntax errors", async () => {
    let moduleId = await createModule("module.exports = hello world");

    try {
      await pool.importFileProcessor(moduleId);
      assert.fail("An error should have been thrown");
    }
    catch (error) {
      expect(error).to.be.an.instanceOf(SyntaxError);
      expect(error.message).to.equal(`Error importing module: ${moduleId} \nUnexpected identifier`);
    }
  });

  it("should throw an error if the module doesn't export a function", async () => {
    let moduleId = await createModule("module.exports = Math.PI");

    try {
      await pool.importFileProcessor(moduleId);
      assert.fail("An error should have been thrown");
    }
    catch (error) {
      expect(error).to.be.an.instanceOf(TypeError);
      expect(error.message).to.equal(
        `Error importing module: ${moduleId} \n` +
        "The module exported 3.141592653589793. CodeEngine plugin modules must export a function.");
    }
  });

  it("should throw an error if the module doesn't export anything", async () => {
    let moduleId = await createModule("module.exports = undefined");

    try {
      await pool.importFileProcessor(moduleId);
      assert.fail("An error should have been thrown");
    }
    catch (error) {
      expect(error).to.be.an.instanceOf(TypeError);
      expect(error.message).to.equal(
        `Error importing module: ${moduleId} \n` +
        "CodeEngine plugin modules must export a function.");
    }
  });

  it("should re-throw an error from the factory function", async () => {
    let module = await createModule(
      async function badFactory (data) {
        throw new RangeError(data);
      },
      "Boom!"
    );

    try {
      await pool.importFileProcessor(module);
      assert.fail("An error should have been thrown");
    }
    catch (error) {
      expect(error).to.be.an.instanceOf(RangeError);
      expect(error.message).to.equal(
        `Error importing module: ${module.moduleId} \n` +
        "Boom!");
    }
  });

  it("should throw an error if the factory function doesn't export a function", async () => {
    let module = await createModule(
      function badFactory (data) { return data; },
      "Hello, World"
    );

    try {
      await pool.importFileProcessor(module);
      assert.fail("An error should have been thrown");
    }
    catch (error) {
      expect(error).to.be.an.instanceOf(TypeError);
      expect(error.message).to.equal(
        `Error importing module: ${module.moduleId} \n` +
        'The badFactory function returned "Hello, World". Expected a CodeEngine file processor.');
    }
  });

  it("should throw an error if the factory function doesn't export anything", async () => {
    let module = await createModule(
      () => undefined,
      "Hello, World"
    );

    try {
      await pool.importFileProcessor(module);
      assert.fail("An error should have been thrown");
    }
    catch (error) {
      expect(error).to.be.an.instanceOf(TypeError);
      expect(error.message).to.equal(
        `Error importing module: ${module.moduleId} \n` +
        "The exported function must return a CodeEngine file processor.");
    }
  });

});
