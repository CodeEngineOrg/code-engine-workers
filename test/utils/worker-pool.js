"use strict";

const { WorkerPool } = require("../../");

// Keeps track of the WorkerPool instances that are created during a test.
// This allows us to dispose of them all after each test.
let instances = [];

module.exports = {
  /**
   * Creates a new WorkerPool instance
   */
  create (engine, run) {
    let pool = new WorkerPool(engine, run);
    instances.push(pool);
    return pool;
  },

  /**
   * Dispose all WorkerPool instances
   */
  async disposeAll () {
    await Promise.all(instances.map((pool) => pool.dispose()));
    instances = [];
  }
};
