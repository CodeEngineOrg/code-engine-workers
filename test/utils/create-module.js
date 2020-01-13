"use strict";

const tmp = require("tmp");
const { promises: fs } = require("fs");
const { join } = require("path");

// Gracefully cleanup temp files
tmp.setGracefulCleanup();

module.exports = createModule;

/**
 * Creates a worker module that exports the given plugin method
 *
 * @param code {function|string} - The function or code to export in the module
 * @returns {string} - The path to the worker module
 */
async function createModule (code) {
  // Create a temp file
  let moduleId = await new Promise((resolve, reject) =>
    tmp.dir({ prefix: "code-engine-" }, (e, p) => e ? reject(e) : resolve(p)));

  if (typeof code !== "string") {
    code = `"use strict";\nmodule.exports = ${code};`;
  }

  await fs.writeFile(join(moduleId, "index.js"), code);

  return moduleId;
}
