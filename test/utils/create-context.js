"use strict";

const os = require("os");
const createLogger = require("./create-logger");

module.exports = createContext;

/**
 * Creates a CodeEngine context object
 */
function createContext (props = {}) {
  return {
    cwd: process.cwd(),
    concurrency: os.cpus().length,
    dev: false,
    debug: false,
    fullBuild: true,
    partialBuild: false,
    changedFiles: [],
    log: createLogger(),
    ...props,
  };
}
