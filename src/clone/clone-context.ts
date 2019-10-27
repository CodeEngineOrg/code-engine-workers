import { BuildContext, CloneableObject, LogLevel } from "@code-engine/types";
import { createChangedFile } from "@code-engine/utils";
import { LogReply, Reply } from "../messaging/replies";
import { Messenger } from "../worker-thread/messenger";
import { cloneError } from "./clone-error";
import { ChangedFileClone, cloneChangedFile } from "./clone-file";

/**
 * The data necessary to clone a `BuildContext` object across the thread boundary.
 * @internal
 */
export interface ContextClone {
  cwd: string;
  concurrency: number;
  dev: boolean;
  debug: boolean;
  fullBuild: boolean;
  partialBuild: boolean;
  changedFiles: ChangedFileClone[];
}


/**
 * Returns a cloneable copy of the given context object.
 * @internal
 */
export function cloneContext(context: BuildContext): ContextClone {
  // tslint:disable-next-line: no-object-literal-type-assertion
  let clone = { ...context, logger: undefined } as ContextClone;
  clone.changedFiles = clone.changedFiles.map(cloneChangedFile);
  return clone;
}


/**
 * Creates a `BuildContext` object from a `ContextClone`.
 * @internal
 */
export function createContext(messenger: Messenger, messageId: number, context: ContextClone): BuildContext {
  return {
    ...context,
    changedFiles: context.changedFiles.map((file) => createChangedFile(file)),
    logger: {
      log(message: string, data: CloneableObject) {
        messenger.postReply(createLogReply(LogLevel.Info, messageId, message, data));
      },
      debug(message: string, data: CloneableObject) {
        if (context.debug) {
          messenger.postReply(createLogReply(LogLevel.Debug, messageId, message, data));
        }
      },
      warn(warning: string | Error, data: CloneableObject) {
        messenger.postReply(createLogReply(LogLevel.Warning, messageId, warning, data));
      },
      error(error: string | Error, data: CloneableObject) {
        messenger.postReply(createLogReply(LogLevel.Error, messageId, error, data));
      }
    }
  };
}

function createLogReply(level: LogLevel, to: number, msg: string | Error, data?: CloneableObject): Reply & LogReply {
  let message = cloneError(msg);
  return { type: "log", to, level, message, data };
}
