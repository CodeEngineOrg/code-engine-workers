import { BuildContext, CloneableObject, Logger, LogLevel } from "@code-engine/types";
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
  let clone = { ...context, log: undefined } as unknown as ContextClone;
  clone.changedFiles = context.changedFiles.map(cloneChangedFile);
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
    log: createLogger(messenger, messageId, context),
  };
}


/**
 * Creates a `Logger` object from a `ContextClone`.
 */
function createLogger(messenger: Messenger, messageId: number, context: ContextClone): Logger {
  function log(message: string | Error, data?: CloneableObject): void {
    if (typeof message === "string") {
      log.info(message, data);
    }
    else {
      log.error(message, data);
    }
  }

  log.info = (message: string, data?: CloneableObject) => {
    messenger.postReply(createLogReply(LogLevel.Info, messageId, message, data));
  };

  log.debug = (message: string, data?: CloneableObject) => {
    if (context.debug) {
      messenger.postReply(createLogReply(LogLevel.Debug, messageId, message, data));
    }
  };

  log.warn = (warning: string | Error, data?: CloneableObject) => {
    messenger.postReply(createLogReply(LogLevel.Warning, messageId, warning, data));
  };

  log.error = (error: string | Error, data?: CloneableObject) => {
    messenger.postReply(createLogReply(LogLevel.Error, messageId, error, data));
  };

  return log;
}

function createLogReply(level: LogLevel, to: number, msg: string | Error, data?: CloneableObject): Reply & LogReply {
  let message = cloneError(msg);
  return { type: "log", to, level, message, data };
}
