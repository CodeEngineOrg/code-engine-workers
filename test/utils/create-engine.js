"use strict";

const createLogger = require("./create-logger");
const sinon = require("sinon");
const os = require("os");

module.exports = createEngine;

/**
 * Creates a mock CodeEngine object
 */
function createEngine (props = {}) {
  return {
    emit: props.emit === undefined ? sinon.spy() : props.emit,
    cwd: props.cwd === undefined ? process.cwd() : props.cwd,
    concurrency: props.concurrency === undefined ? os.cpus().length : props.concurrency,
    dev: props.dev === undefined ? false : props.dev,
    debug: props.debug === undefined ? false : props.debug,
    log: props.log === undefined ? createLogger() : props.log,
  };
}
