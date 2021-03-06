import { FileProcessor, ModuleDefinition } from "@code-engine/types";
import { FileClone } from "../clone/file";
import { RunClone } from "../clone/run";


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
export type Message = ImportFileProcessorMessage | ImportModuleMessage | ProcessFileMessage;


/**
 * A message that instructs a `Worker` or `Executor` to import a `FileProcessor` module.
 * @internal
 */
export interface ImportFileProcessorMessage extends ModuleDefinition<FileProcessor> {
  type: "importFileProcessor";

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
 * A message that instructs a `Worker` or `Executor` to import a module.
 * @internal
 */
export interface ImportModuleMessage extends ModuleDefinition<void> {
  type: "importModule";

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
   * Information about the current run.
   */
  run: RunClone;
}
