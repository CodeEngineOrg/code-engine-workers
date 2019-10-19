import { ono } from "ono";
import * as resolveFrom from "resolve-from";
import * as resolveGlobal from "resolve-global";
import { threadId } from "worker_threads";


/**
 * CommonJS or ECMAScript module exports.
 * @internal
 */
export interface ModuleExports {
  __esModule?: true;
  default?: unknown;
  [name: string]: unknown;
}


/**
 * Imports the specified JavaScript module, either from the current path,
 * the local "node_modules" folder, or a globally-installed NPM package.
 *
 * @param moduleId - The name or path of the module to import
 * @param [cwd] - The local directory to start searching for the module
 * @internal
 */
export async function importModule(moduleId: string, cwd?: string): Promise<ModuleExports> {
  let filename = resolveFrom.silent(cwd || __dirname, moduleId) || resolveGlobal.silent(moduleId);

  if (!filename) {
    throw ono({ workerId: threadId, moduleId },
      `Cannot find module "${moduleId}" in the local path or as a globally-installed package.`);
  }

  return import(filename);
}
