"use strict";

const sinon = require("sinon");

module.exports = createContext;

function createContext (props = {}) {
  return {
    cwd: props.cwd || process.cwd(),
    fullBuild: true,
    changedFiles: [],
    log: props.log || createLogger(),
  };
}

function createLogger () {
  function log (msg, data) {
    if (typeof msg === "string") {
      log.info(msg, data);
    }
    else {
      log.error(msg, data);
    }
  }

  log.info = sinon.spy();
  log.debug = sinon.spy();
  log.warn = sinon.spy();
  log.error = sinon.spy();

  return log;
}
