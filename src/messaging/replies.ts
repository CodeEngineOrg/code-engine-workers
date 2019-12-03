import { CloneableObject, LogLevel } from "@code-engine/types";
import { ErrorClone } from "../clone/clone-error";
import { FileClone } from "../clone/clone-file";


/**
 * The replies that can be sent from an `Executor` to a `Worker` in response to a message.
 * @internal
 */
export type Reply = { to: number } & (FinishedReply | ErrorReply | ImportFileProcessorReply | LogReply | OutputFileReply);


/**
 * A reply from an `Executor` to a `Worker` to let it know that it has finished processing
 * a message.
 * @internal
 */
export interface FinishedReply {
  type: "finished";
}


/**
 * A reply from an `Executor` to a `Worker` that alerts the worker that an unhandled
 * error has occurred in the `Executor`.
 * @internal
 */
export interface ErrorReply {
  type: "error";

  /**
   * The serialized error
   */
  error: ErrorClone;
}


/**
 * A reply from an `Executor` to a `Worker` confirming that a `FileProcessor` module has been imported successfully.
 * @internal
 */
export interface ImportFileProcessorReply {
  type: "fileProcessorImported";

  /**
   * The name of the `FileProcessor` function.
   */
  name: string;
}


/**
 * A log message from an `Exectutor`, which is logged on the main thread by a `Worker`.
 * @internal
 */
export interface LogReply {
  type: "log";

  /**
   * The type of log ("error", "warning", "debug", etc.)
   */
  level: LogLevel;

  /**
   * The log message.
   */
  message: string | ErrorClone;

  /**
   * Additional data to be logged.
   */
  data?: CloneableObject;
}


/**
 * A reply from an `Executor` to a `Worker` containing an output file from a plugin's
 * `processFile()` function.
 * @internal
 */
export interface OutputFileReply {
  type: "file";

  /**
   * The output file.
   */
  file: FileClone;
}
