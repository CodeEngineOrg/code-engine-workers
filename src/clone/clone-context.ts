import { Context, LogLevel } from "@code-engine/types";
import { LogReply, Reply } from "../messaging/replies";
import { Messenger } from "../worker-thread/messenger";
import { clone } from "./clone";
import { cloneError } from "./clone-error";
import { CloneableObject } from "./clone-helpers";

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
      log(message, data) {
        messenger.postReply(createLogReply("info", messageId, message, data));
      },
      debug(message, data) {
        if (context.debug) {
          messenger.postReply(createLogReply("debug", messageId, message, data));
        }
      },
      warn(message, data) {
        messenger.postReply(createLogReply("warning", messageId, message, data));
      },
      error(message, data) {
        messenger.postReply(createLogReply("error", messageId, message, data));
      }
    }
  };
}

function createLogReply(level: LogLevel, to: number, msg: string | Error, obj?: object): Reply & LogReply {
  let message = typeof msg === "string" ? msg : cloneError(msg);
  let data = obj && clone(obj) as CloneableObject;
  return { type: "log", to, level, message, data };
}
