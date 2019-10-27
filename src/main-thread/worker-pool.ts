import { BuildContext, Context, EventName, File, FileProcessor, ModuleDefinition } from "@code-engine/types";
import { validate } from "@code-engine/utils";
import { EventEmitter } from "events";
import { ono } from "ono";
import * as os from "os";
import { Worker } from "./worker";


/**
 * Runs CodeEngine plugins on worker threads.
 */
export class WorkerPool extends EventEmitter {
  /** @internal */
  private _workers: Worker[] = [];

  /** @internal */
  private _isDisposed = false;

  /** @internal */
  private _moduleCounter = 0;

  /** @internal */
  private _roundRobinCounter = 0;

  public constructor(concurrency: number, context: Context) {
    super();
    concurrency = validate.positiveInteger("concurrency", concurrency, os.cpus().length);

    if (!context || typeof context.cwd !== "string") {
      throw ono(`A CodeEngine context object is required.`);
    }

    this._createWorkers(concurrency, context);
  }

  /**
   * Indicates the number of worker threads in the pool.
   */
  public get size(): number {
    return this._workers.length;
  }

  /**
   * Indicates whether the `dispose()` method has been called.
   * Once disposed, the `WorkerPool` instance is no longer usable.
   */
  public get isDisposed(): boolean {
    return this._isDisposed;
  }


  /**
   * Loads the specified JavaScript module in all worker threads and returns a `FileProcessor` wrapper
   * that executes the module in one of the threads.
   */
  public async loadFileProcessor(module: string | ModuleDefinition): Promise<FileProcessor> {
    this._assertNotDisposed();

    // Load the JavaScript module in all worker threads
    let [moduleUID, name] = await this._loadModule(module);

    // Create a CodeEngine FileProcessor function that executes the module on a worker thread
    let plugin = {
      [name]: (file: File, context: BuildContext) => {
        // Select a worker from the pool to process the files
        let worker = this._select();

        // Process the file on the worker thread
        return worker.processFile(moduleUID, file, context);
      }
    };

    // Return the FileProcessor function with the same name as the one in the module
    return plugin[name];
  }


  /**
   * Terminates all worker threads.
   */
  public async dispose(): Promise <void> {
    this._isDisposed = true;
    let workers = this._workers;
    this._workers = [];
    await Promise.all(workers.map((worker) => worker.terminate()));
  }


  /**
   * Creates the specified number of worker threads.
   * @internal
   */
  private _createWorkers(concurrency: number, context: Context) {
    // Re-emit all errros from workers
    let emitError = (error: Error) => this.emit(EventName.Error, error);

    for (let i = 0; i < concurrency; i++) {
      let worker = new Worker(context);
      worker.on("error", emitError);
      this._workers.push(worker);
    }
  }


  /**
   * Loads the specified JavaScript module into all worker threads.
   * @internal
   */
  private async _loadModule(module: ModuleDefinition | string): Promise<[number, string]> {
    if (typeof module === "string") {
      module = { moduleId: module };
    }

    // Create a unique ID that will be used to reference this module from now on.
    let moduleUID = ++this._moduleCounter;

    let [name] = await Promise.all(
        this._workers.map((worker) => worker.loadModule(module as ModuleDefinition, moduleUID))
      );

    return [moduleUID, name];
  }


  /**
   * Selects a `Worker` from the pool to perform a task.
   * @internal
   */
  private _select(): Worker {
    // For now, we just use a simple round-robin strategy,
    // but we may employ a more advanced selection strategy later
    return this._workers[this._roundRobinCounter++ % this._workers.length];
  }


  /**
   * Throws an error if the `WorkerPool` has been disposed.
   * @internal
   */
  private _assertNotDisposed() {
    if (this.isDisposed) {
      throw ono(`CodeEngine cannot be used after it has been disposed.`);
    }
  }
}
