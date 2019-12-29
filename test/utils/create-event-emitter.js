"use strict";

const sinon = require("sinon");

module.exports = createEventEmitter;

/**
 * Creates a mock EventEmitter object
 */
function createEventEmitter () {
  return {
    emit: sinon.spy()
  };
}
