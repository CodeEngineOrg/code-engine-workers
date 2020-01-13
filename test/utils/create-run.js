"use strict";

const os = require("os");
const createLogger = require("./create-logger");

module.exports = createRun;

/**
 * Creates a mock Run object
 */
function createRun (props = {}) {
  return {
    cwd: props.cwd === undefined ? process.cwd() : props.cwd,
    concurrency: props.concurrency === undefined ? os.cpus().length : props.concurrency,
    dev: props.dev === undefined ? false : props.dev,
    debug: props.debug === undefined ? false : props.debug,
    full: props.full === undefined ? true : props.full,
    partial: props.partial === undefined ? false : props.partial,
    changedFiles: props.changedFiles === undefined ? [] : props.changedFiles,
    log: props.log === undefined ? createLogger() : props.log,
  };
}
