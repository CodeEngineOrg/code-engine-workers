import { Logger } from "@code-engine/types";
import { EventEmitter } from "events";

/**
 * `WorkerPool` configuration options
 */
export interface WorkerPoolConfig {
  /**
   * The directory used to resolve all relative paths.
   *
   * Defaults to `process.cwd()`.
   */
  cwd?: string;

  /**
   * The number of worker threads to create.
   *
   * Defaults to the number of CPU cores available.
   */
  concurrency?: number;

  /**
   * Indicates whether CodeEngine is running in debug mode, which enables additional logging
   * and error stack traces.
   *
   * Defaults to `false`.
   */
  debug?: boolean;

  /**
   * The `EventEmitter` that the `WorkerPool` should use to emit its events.
   *
   * Defaults to a new `EventEmitter` instance.
   */
  emitter?: EventEmitter;

  /**
   * The `Logger` object to log messages and errors from worker threads.
   *
   * Defaults to emitting "log" events via the `emitter`.
   */
  log?: Logger;
}
