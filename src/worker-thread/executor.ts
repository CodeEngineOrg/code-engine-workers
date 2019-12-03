import { stringify } from "@code-engine/stringify";
import { FactoryFunction, FileProcessor } from "@code-engine/types";
import { createFile, importModule, iterate, normalizeFileInfo } from "@code-engine/utils";
import { ono } from "ono";
import { MessagePort } from "worker_threads";
import { createContext } from "../clone/clone-context";
import { cloneFile } from "../clone/clone-file";
import { ImportFileProcessorMessage, ImportModuleMessage, IncomingMessage, ProcessFileMessage } from "../messaging/messages";
import { Messenger } from "../worker-thread/messenger";

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
   * Imports the specified `FileProcessor` module.
   */
  public async importFileProcessor(message: IncomingMessage & ImportFileProcessorMessage): Promise<void> {
    let { moduleUID, moduleId, cwd } = message;
    let fileProcessor: FileProcessor;
    let defaultExport: unknown;

    try {
      // Import the plugin module
      let exports = await importModule(moduleId, cwd);
      defaultExport = exports.default;
    }
    catch (error) {
      throw ono(error, { workerId: this.threadId, moduleId }, `Error importing module: ${moduleId}`);
    }

    if (defaultExport === undefined || defaultExport === null) {
      throw ono.type({ workerId: this.threadId, moduleId },
        `Error importing module: ${moduleId} \n` +
        `CodeEngine plugin modules must export a function.`);
    }
    else if (typeof defaultExport !== "function") {
      throw ono.type({ workerId: this.threadId, moduleId },
        `Error importing module: ${moduleId} \n` +
        `The module exported ${stringify(defaultExport, { article: true })}. ` +
        `CodeEngine plugin modules must export a function.`);
    }

    // This could be a FileProcessor or a FactoryFunction
    if (message.data === undefined) {
      // The exported function is a FileProcessor
      fileProcessor = defaultExport as FileProcessor;
    }
    else {
      // The exported function is a FactoryFunction, so call the factory with the given data.
      let factory = defaultExport as FactoryFunction<FileProcessor | void>;
      let product = await factory(message.data);

      if (product === undefined || product === null) {
        throw ono.type({ workerId: this.threadId, moduleId },
          `Error importing module: ${moduleId} \n` +
          `The ${factory.name || "exported"} function must return a CodeEngine file processor.`);
      }
      else if (typeof product !== "function") {
        throw ono.type({ workerId: this.threadId, moduleId },
          `Error importing module: ${moduleId} \n` +
          `The ${factory.name || "exported"} function returned ${stringify(product, { article: true })}. ` +
          "Expected a CodeEngine file processor.");
      }

      // The factory produced a FileProcessor
      fileProcessor = product;
    }

    // Store the FileProcessor so we can call it later
    this._processors.set(moduleUID, fileProcessor);

    // Reply with information about the module
    this.postReply({ to: message.id, type: "fileProcessorImported", name: fileProcessor.name });
  }

  /**
   * Imports the specified JavaScript module.
   */
  public async importModule(message: IncomingMessage & ImportModuleMessage): Promise<void> {
    let { moduleId, cwd } = message;
    let defaultExport: unknown;

    try {
      // Import the plugin module
      let exports = await importModule(moduleId, cwd);
      defaultExport = exports.default || exports;
    }
    catch (error) {
      throw ono(error, { workerId: this.threadId, moduleId }, `Error importing module: ${moduleId}`);
    }

    if (typeof defaultExport === "function") {
      // Call the exported function with the given data
      let factory = defaultExport as FactoryFunction;
      await Promise.resolve(factory(message.data));
    }

    // Reply that we're done importing the module
    this.postReply({ to: message.id, type: "finished" });
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
      let outFile = normalizeFileInfo(fileInfo);
      let [outFileClone, transferList] = cloneFile(outFile);
      this.postReply({ to: message.id, type: "file", file: outFileClone }, transferList);
    }

    // Let the worker know that we're done yielding files
    this.postReply({ to: message.id, type: "finished" });
  }
}
