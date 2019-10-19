"use strict";

const WorkerPool = require("../utils/worker-pool");

/**
 * Dispose all WorkerPool instances after each test.
 * Otherwise, the process never exits because the worker threads are still running.
 */
afterEach("Dispose all WorkerPool instances", async () => {
  await WorkerPool.disposeAll();
});
