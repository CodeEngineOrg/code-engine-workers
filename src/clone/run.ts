import { CloneableObject, Logger, LogLevel, Run } from "@code-engine/types";
import { createChangedFile } from "@code-engine/utils";
import { LogReply, Reply } from "../messaging/replies";
import { Messenger } from "../worker-thread/messenger";
import { cloneError } from "./error";
import { ChangedFileClone, cloneChangedFile } from "./file";

/**
 * The data necessary to clone a `Run` object across the thread boundary.
 * @internal
 */
export interface RunClone {
  cwd: string;
  concurrency: number;
  dev: boolean;
  debug: boolean;
  full: boolean;
  partial: boolean;
  changedFiles: ChangedFileClone[];
}


/**
 * Returns a cloneable copy of the given run object.
 * @internal
 */
export function cloneRun(run: Run): RunClone {
  // tslint:disable-next-line: no-object-literal-type-assertion
  let clone = { ...run, log: undefined } as unknown as RunClone;
  clone.changedFiles = run.changedFiles.map(cloneChangedFile);
  return clone;
}


/**
 * Creates a `Run` object from a `RunClone`.
 * @internal
 */
export function createRun(messenger: Messenger, messageId: number, run: RunClone): Run {
  return {
    ...run,
    changedFiles: run.changedFiles.map((file) => createChangedFile(file)),
    log: createLogger(messenger, messageId, run),
  };
}


/**
 * Creates a `Logger` object from a `RunClone`.
 */
function createLogger(messenger: Messenger, messageId: number, run: RunClone): Logger {
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
    if (run.debug) {
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
