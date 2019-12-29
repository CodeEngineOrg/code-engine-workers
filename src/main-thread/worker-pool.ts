import { BuildContext, CodeEngineEventEmitter, Context, EventName, File, FileProcessor, ModuleDefinition } from "@code-engine/types";
import { validate } from "@code-engine/validate";
import { ono } from "ono";
import { ImportFileProcessorMessage, ImportModuleMessage } from "../messaging/messages";
import { Worker } from "./worker";

/**
 * Runs CodeEngine plugins on worker threads.
 */
export class WorkerPool {
  /** @internal */
  private _workers: Worker[] = [];

  /** @internal */
  private _isDisposed = false;

  /** @internal */
  private _moduleCounter = 0;

  /** @internal */
  private _roundRobinCounter = 0;

  /** @internal */
  private _cwd: string;

  public constructor(emitter: CodeEngineEventEmitter, context: Context) {
    validate.value(emitter, "EventEmitter");
    validate.type.function(emitter.emit, "EventEmitter");
    validate.type.object(context, "CodeEngine context");

    this._cwd = validate.string.nonWhitespace(context.cwd, "cwd");
    let concurrency = validate.number.integer.positive(context.concurrency, "concurrency");

    let emitError = (error: Error) => emitter.emit(EventName.Error, error, context);

    for (let i = 0; i < concurrency; i++) {
      let worker = new Worker(context.log);
      worker.on("error", emitError);
      this._workers.push(worker);
    }
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
   * Imports the specified `FileProcessor` module in all worker threads.
   *
   * @returns - A proxy function that executes the processor in one of the threads.
   */
  public async importFileProcessor(module: string | ModuleDefinition<FileProcessor>): Promise<FileProcessor> {
    this._assertNotDisposed();
    let { moduleId, data } = normalizeModule(module);
    let cwd = this._cwd;
    let moduleUID = ++this._moduleCounter;
    let message: ImportFileProcessorMessage = { type: "importFileProcessor", cwd, moduleUID, moduleId, data };

    // Import the JavaScript module in all worker threads
    let [name] = await Promise.all(
      this._workers.map((worker) => worker.importFileProcessor(message))
    );

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
   * Imports the specified JavaScript module in all worker threads.
   */
  public async importModule(module: string | ModuleDefinition<void>): Promise<void> {
    this._assertNotDisposed();
    let { moduleId, data } = normalizeModule(module);
    let cwd = this._cwd;
    let message: ImportModuleMessage = { type: "importModule", cwd,  moduleId, data };

    // Import the JavaScript module in all worker threads
    await Promise.all(
      this._workers.map((worker) => worker.importModule(message))
    );
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


/**
 * Normalizes a module definition.
 */
function normalizeModule<T>(module: string | ModuleDefinition<T>): ModuleDefinition<T> {
  if (typeof module === "string") {
    return { moduleId: module };
  }
  else {
    return module;
  }
}
