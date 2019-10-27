"use strict";

const sinon = require("sinon");

module.exports = createContext;

function createContext (props = {}) {
  return {
    cwd: props.cwd || process.cwd(),
    fullBuild: true,
    changedFiles: [],
    logger: props.logger || {
      log: sinon.spy(),
      debug: sinon.spy(),
      warn: sinon.spy(),
      error: sinon.spy(),
    }
  };
}
