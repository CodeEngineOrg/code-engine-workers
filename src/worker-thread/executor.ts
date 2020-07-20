import { FactoryFunction, FileProcessor } from "@code-engine/types";
import { createFile, importModule, iterate, normalizeFileInfo } from "@code-engine/utils";
import { humanize } from "@jsdevtools/humanize-anything";
import { ono } from "@jsdevtools/ono";
import { MessagePort } from "worker_threads";
import { cloneFile } from "../clone/file";
import { createRun } from "../clone/run";
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

    try {
      // Import the plugin module
      let exports = await importModule(moduleId, cwd);
      let defaultExport = exports.default;

      if (defaultExport === undefined || defaultExport === null) {
        throw ono.type("CodeEngine plugin modules must export a function.");
      }
      else if (typeof defaultExport !== "function") {
        throw ono.type(
          `The module exported ${humanize(defaultExport, { article: true })}. ` +
          "CodeEngine plugin modules must export a function.");
      }

      // This could be a FileProcessor or a FactoryFunction
      if (message.data === undefined) {
        // The exported function is a FileProcessor
        fileProcessor = defaultExport as FileProcessor;
      }
      else {
        // The exported function is a FactoryFunction, so call the factory with the given data.
        let factory = defaultExport as FactoryFunction;
        let product = await Promise.resolve(factory(message.data));

        if (product === undefined || product === null) {
          throw ono.type(`The ${factory.name || "exported"} function must return a CodeEngine file processor.`);
        }
        else if (typeof product !== "function") {
          throw ono.type(
            `The ${factory.name || "exported"} function returned ${humanize(product, { article: true })}. ` +
            "Expected a CodeEngine file processor.");
        }

        // The factory produced a FileProcessor
        fileProcessor = product as FileProcessor;
      }

      // Store the FileProcessor so we can call it later
      this._processors.set(moduleUID, fileProcessor);

      // Reply with information about the module
      this.postReply({ to: message.id, type: "fileProcessorImported", name: fileProcessor.name });
    }
    catch (error) {
      throw ono(error, { workerId: this.threadId, moduleId }, `Error importing module: ${moduleId}`);
    }
  }

  /**
   * Imports the specified JavaScript module.
   */
  public async importModule(message: IncomingMessage & ImportModuleMessage): Promise<void> {
    let { moduleId, cwd } = message;

    try {
      // Import the plugin module
      let exports = await importModule(moduleId, cwd);
      let defaultExport = exports.default || exports;

      if (typeof defaultExport === "function") {
        // Call the exported function with the given data
        let factory = defaultExport as FactoryFunction;
        await Promise.resolve(factory(message.data));
      }

      // Reply that we're done importing the module
      this.postReply({ to: message.id, type: "finished" });
    }
    catch (error) {
      throw ono(error, { workerId: this.threadId, moduleId }, `Error importing module: ${moduleId}`);
    }
  }

  /**
   * Processes a file using the specified plugin.
   */
  public async processFile(message: IncomingMessage & ProcessFileMessage): Promise<void> {
    // Create clones of the File and Run
    let file = createFile(message.file);
    let run = createRun(this, message.id, message.run);

    // Process the file using the specified plugin
    let fileProcessor = this._processors.get(message.moduleUID)!;
    let output = await fileProcessor.call(undefined, file, run);  // eslint-disable-line no-useless-call

    for await (let fileInfo of iterate(output)) {
      let outFile = normalizeFileInfo(fileInfo);
      let [outFileClone, transferList] = cloneFile(outFile);
      this.postReply({ to: message.id, type: "file", file: outFileClone }, transferList);
    }

    // Let the worker know that we're done yielding files
    this.postReply({ to: message.id, type: "finished" });
  }
}
