"use strict";

const createLogger = require("./create-logger");

module.exports = createContext;

function createContext (props = {}) {
  return {
    cwd: props.cwd || process.cwd(),
    fullBuild: true,
    changedFiles: [],
    log: props.log || createLogger(),
  };
}
