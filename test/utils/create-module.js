"use strict";

const tmp = require("tmp");
const { promises: fs } = require("fs");

// Gracefully cleanup temp files
tmp.setGracefulCleanup();

module.exports = createModule;

/**
 * Creates a worker module that exports the given plugin method, optionally accepting the given data.
 *
 * @param code {function|string} - The function or code to export in the module
 * @param [data] {object} - The data (if any) to make available to the plugin method
 * @returns {string|object} - A CodeEngine worker module
 */
async function createModule (code, data) {
  // Create a temp file
  let moduleId = await new Promise((resolve, reject) =>
    tmp.file({ prefix: "code-engine-", postfix: ".js" }, (e, p) => e ? reject(e) : resolve(p)));

  await fs.writeFile(moduleId, `module.exports = ${code};`);

  if (data === undefined) {
    return moduleId;
  }
  else {
    return { moduleId, data };
  }
}
