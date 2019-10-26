import { ModuleDefinition } from "@code-engine/types";
import { ContextClone } from "../clone/clone-context";
import { FileClone } from "../clone/clone-file";


/**
 * A function that handles incoming messages
 * @internal
 */
export type MessageHandler = (message: IncomingMessage & Message) => Promise<void>;


/**
 * An incoming message from a `Worker`, received by an `Executor`.
 * @internal
 */
export interface IncomingMessage {
  /**
   * The message's unique ID. This is used to reply to the message.
   */
  id: number;
}


/**
 * The messages that can be sent from a `Worker` to an `Executor`.
 * @internal
 */
export type Message = LoadModuleMessage | ProcessFileMessage;


/**
 * A message that instructs a `Worker` or `Executor` to load a module.
 * @internal
 */
export interface LoadModuleMessage extends ModuleDefinition {
  type: "loadModule";

  /**
   * A unique ID that is assigned to each module so they can be referenced across thread boundaries.
   */
  moduleUID: number;

  /**
   * The directory to resolve relative module IDs.
   */
  cwd: string;
}


/**
 * A message from a `Worker` to an `Executor` to call a plugin's `processFile()` function.
 * @internal
 */
export interface ProcessFileMessage {
  type: "processFile";

  /**
   * The unique ID of the module whose `FileProcessor` function is called.
   */
  moduleUID: number;

  /**
   * The file to be processed.
   */
  file: FileClone;

  /**
   * Contextual information about the current build.
   */
  context: ContextClone;
}
