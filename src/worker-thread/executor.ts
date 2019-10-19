import { FileProcessor, FileProcessorFactory } from "@code-engine/types";
import { createFile, iterate } from "@code-engine/utils";
import { ono } from "ono";
import { MessagePort } from "worker_threads";
import { createContext } from "../clone/clone-context";
import { cloneFile } from "../clone/clone-file";
import { IncomingMessage, LoadModuleMessage, ProcessFileMessage } from "../messaging/messages";
import { Messenger } from "../worker-thread/messenger";
import { importModule } from "./import-module";

/**
 * Executes commands in a worker thread that are sent by a corresponding `Worker` running on the main thread.
 * @internal
 */
export class Executor extends Messenger {
  public readonly threadId: number;
  private readonly _processors = new Map<number, FileProcessor>();

  public constructor(threadId: number, port: MessagePort) {
    super(port);
    this.threadId = threadId;
  }

  /**
   * Loads the specified JavaScript module.
   */
  public async loadModule(message: IncomingMessage & LoadModuleMessage): Promise<void> {
    let { moduleUID, moduleId, cwd } = message;
    let fileProcessor: FileProcessor;

    // Import the plugin module
    let exports = await importModule(moduleId, cwd);

    // Get the default export, which must be a function
    let fn = (exports && exports.default) || exports;

    if (typeof fn !== "function") {
      throw ono.type({ workerId: this.threadId, moduleId },
        `Error loading module "${moduleId}". CodeEngine plugin modules must export a function.`);
    }

    if (message.data === undefined) {
      // The exported function is the FileProcessor
      fileProcessor = fn as FileProcessor;
    }
    else {
      // The exported function is a factory that produces the FileProcessor function.
      // Call the factory with the given data.
      fileProcessor = await (fn as FileProcessorFactory)(message.data);

      if (typeof fileProcessor !== "function") {
        throw ono.type({ workerId: this.threadId, moduleId },
          `Error loading module "${moduleId}". The ${fn.name || "exported"} function should return a CodeEngine file processor.`);
      }
    }

    this._processors.set(moduleUID, fileProcessor);

    // Reply with information about the module
    this.postReply({ to: message.id, type: "moduleLoaded", name: fileProcessor.name });
  }

  /**
   * Processes a file using the specified plugin.
   */
  public async processFile(message: IncomingMessage & ProcessFileMessage): Promise<void> {
    // Create clones of the File and Context
    let file = createFile(message.file);
    let context = createContext(this, message.id, message.context);

    // Process the file using the specified plugin
    let fileProcessor = this._processors.get(message.moduleUID)!;
    let output = await fileProcessor.call(undefined, file, context);

    for await (let fileInfo of iterate(output)) {
      let outFile = createFile(fileInfo);

      this.postReply({
        to: message.id,
        type: "file",
        file: cloneFile(outFile),
      });
    }

    // Let the worker know that we're done yielding files
    this.postReply({ to: message.id, type: "finished" });
  }
}
