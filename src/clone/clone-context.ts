import { CloneableObject, Context, LogLevel } from "@code-engine/types";
import { LogReply, Reply } from "../messaging/replies";
import { Messenger } from "../worker-thread/messenger";
import { cloneError } from "./clone-error";

/**
 * The data necessary to clone a `Context` object across the thread boundary.
 * @internal
 */
export interface ContextClone {
  cwd: string;
  dev: boolean;
  debug: boolean;
}


/**
 * Returns a cloneable copy of the given context object.
 * @internal
 */
export function cloneContext(context: Context): ContextClone {
  return {
    cwd: context.cwd,
    dev: context.dev,
    debug: context.debug,
  };
}

/**
 * Creates a `Context` object from a `ContextClone`.
 * @internal
 */
export function createContext(messenger: Messenger, messageId: number, context: ContextClone): Context {
  return {
    ...context,
    logger: {
      log(message: string, data: CloneableObject) {
        messenger.postReply(createLogReply("info", messageId, message, data));
      },
      debug(message: string, data: CloneableObject) {
        if (context.debug) {
          messenger.postReply(createLogReply("debug", messageId, message, data));
        }
      },
      warn(warning: string | Error, data: CloneableObject) {
        messenger.postReply(createLogReply("warning", messageId, warning, data));
      },
      error(error: string | Error, data: CloneableObject) {
        messenger.postReply(createLogReply("error", messageId, error, data));
      }
    }
  };
}

function createLogReply(level: LogLevel, to: number, msg: string | Error, data?: CloneableObject): Reply & LogReply {
  let message = cloneError(msg);
  return { type: "log", to, level, message, data };
}
