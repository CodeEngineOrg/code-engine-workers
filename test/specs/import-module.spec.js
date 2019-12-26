"use strict";

const WorkerPool = require("../utils/worker-pool");
const createModule = require("../utils/create-module");
const createLogger = require("../utils/create-logger");
const createContext = require("../utils/create-context");
const { createFile } = require("@code-engine/utils");
const { assert, expect } = require("chai");

describe("WorkerPool.importModule()", () => {
  let context, pool;

  beforeEach("create a new WorkerPool and Context", () => {
    let log = createLogger();
    context = createContext({ log });
    pool = WorkerPool.create({ log });
  });

  it("should import a module that doesn't export anything", async () => {
    let moduleId = await createModule("global.text = 'This text came from the module';");
    let processorId = await createModule((file) => {
      file.text = global.text;
      return file;
    });

    await pool.importModule(moduleId);
    let processFile = await pool.importFileProcessor(processorId);

    let generator = processFile(createFile({ path: "file.txt" }), context);
    let { value } = await generator.next();
    let file = createFile(value);

    expect(file.text).to.equal("This text came from the module");
  });

  it("should call the module's factory function, even with no data", async () => {
    let module = await createModule(
      () => global.text = "This text came from the factory function"
    );

    let processorId = await createModule((file) => {
      file.text = global.text;
      return file;
    });

    await pool.importModule(module);
    let processFile = await pool.importFileProcessor(processorId);

    let generator = processFile(createFile({ path: "file.txt" }), context);
    let { value } = await generator.next();
    let file = createFile(value);

    expect(file.text).to.equal("This text came from the factory function");
  });

  it("should call the module's factory function with data", async () => {
    let module = await createModule(
      (data) => global.text = data.text,
      { text: "This text came from the data object" }
    );

    let processorId = await createModule((file) => {
      file.text = global.text;
      return file;
    });

    await pool.importModule(module);
    let processFile = await pool.importFileProcessor(processorId);

    let generator = processFile(createFile({ path: "file.txt" }), context);
    let { value } = await generator.next();
    let file = createFile(value);

    expect(file.text).to.equal("This text came from the data object");
  });

  it("should wait for an async factory function to complete", async () => {
    let module = await createModule(
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 300));
        global.text = "This text was set asynchronously";
      }
    );

    let processorId = await createModule((file) => {
      file.text = global.text;
      return file;
    });

    await pool.importModule(module);
    let processFile = await pool.importFileProcessor(processorId);

    let generator = processFile(createFile({ path: "file.txt" }), context);
    let { value } = await generator.next();
    let file = createFile(value);

    expect(file.text).to.equal("This text was set asynchronously");
  });

  it("should throw an error if the module contains syntax errors", async () => {
    let moduleId = await createModule("global.text = hello world");

    try {
      await pool.importModule(moduleId);
      assert.fail("An error should have been thrown");
    }
    catch (error) {
      expect(error).to.be.an.instanceOf(SyntaxError);
      expect(error.message).to.equal(`Error importing module: ${moduleId} \nUnexpected identifier`);
    }
  });

  it("should re-throw an error from the factory function", async () => {
    let moduleId = await createModule(
      function badFactory () {
        throw new RangeError("Boom!");
      }
    );

    try {
      await pool.importModule(moduleId);
      assert.fail("An error should have been thrown");
    }
    catch (error) {
      expect(error).to.be.an.instanceOf(RangeError);
      expect(error.message).to.equal(`Error importing module: ${moduleId} \nBoom!`);
    }
  });

  it("should re-throw an error from an async factory function", async () => {
    let moduleId = await createModule(
      async function badFactory () {
        await new Promise((resolve) => setTimeout(resolve, 100));
        throw new RangeError("Boom!");
      }
    );

    try {
      await pool.importModule(moduleId);
      assert.fail("An error should have been thrown");
    }
    catch (error) {
      expect(error).to.be.an.instanceOf(RangeError);
      expect(error.message).to.equal(`Error importing module: ${moduleId} \nBoom!`);
    }
  });

});
