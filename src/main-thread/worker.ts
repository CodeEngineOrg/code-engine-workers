import { EventName, File, FileInfo, Logger, Run } from "@code-engine/types";
import { log } from "@code-engine/utils";
import { ono } from "@jsdevtools/ono";
import * as path from "path";
import { createError } from "../clone/error";
import { cloneFile } from "../clone/file";
import { cloneRun } from "../clone/run";
import { ImportFileProcessorMessage, ImportModuleMessage } from "../messaging/messages";
import { ImportFileProcessorReply } from "../messaging/replies";
import { awaitOnline } from "./await-online";
import { Messenger } from "./messenger";

const workerScript = path.join(__dirname, "../worker-thread/index.js");

/**
 * Controls an `Executor` instance running on a worker thread.
 * @internal
 */
export class Worker extends Messenger {
  private _logger: Logger;
  private _isTerminated: boolean;
  private _waitUntilOnline: Promise<void>;

  public constructor(logger: Logger) {
    super(workerScript);

    this._logger = logger;
    this._isTerminated = false;
    this._waitUntilOnline = awaitOnline(this);

    this.on("online", this._handleOnline);
    this.on("exit", this._handleExit);
  }

  /**
   * Imports the specified `FileProcessor` module in the worker thread.
   */
  public async importFileProcessor(module: ImportFileProcessorMessage): Promise<string> {
    await this._waitUntilOnline;
    this._debug(`CodeEngine worker #${this.threadId} is loading ${module.moduleId}`, { moduleId: module.moduleId });

    let reply = await this.postMessageAsync(module) as ImportFileProcessorReply;
    return reply.name;
  }

  /**
   * Imports the specified JavaScript module in the worker thread.
   */
  public async importModule(module: ImportModuleMessage): Promise<void> {
    await this._waitUntilOnline;
    this._debug(`CodeEngine worker #${this.threadId} is importing ${module.moduleId}`, { moduleId: module.moduleId });
    await this.postMessageAsync(module);
  }

  /**
   * Processes the given files in the worker thread.
   */
  public async* processFile(moduleUID: number, file: File, run: Run): AsyncGenerator<FileInfo> {
    await this._waitUntilOnline;
    this._debug(`CodeEngine worker #${this.threadId} is processing ${file}`, { path: file.path });

    let [fileClone, transferList] = cloneFile(file);
    let runClone = cloneRun(run);

    let replies = this.postMessageWithReplies(
      { type: "processFile", moduleUID, file: fileClone, run: runClone },
      transferList
    );

    for await (let reply of replies) {
      switch (reply.type) {
        case "log":
          let message = typeof reply.message === "string" ? reply.message : createError(reply.message);
          log(run.log, reply.level, message, reply.data);
          break;

        case "file":
          yield reply.file;
          break;
      }
    }
  }

  /**
   * Terminates the worker thread and cancels all pending operations.
   */
  public async terminate(): Promise<number> {
    if (this._isTerminated) {
      return 0;
    }

    this._isTerminated = true;
    let exitCode = await super.terminate();
    return exitCode;
  }

  /**
   * Logs a debug message when the worker thread comes online.
   */
  private _handleOnline() {
    this._debug(`CodeEngine worker #${this.threadId} is online`);
  }

  /**
   * Handles the worker thread exiting, either because we told it to terminate, or because it crashed.
   */
  private _handleExit(exitCode: number) {
    let error;

    if (this._isTerminated) {
      // The worker was intentionally terminated
      error = ono({ workerId: this.threadId }, "CodeEngine is terminating.");
    }
    else {
      // The worker crashed or exited unexpectedly
      this._isTerminated = true;
      error = ono({ workerId: this.threadId }, `CodeEngine worker #${this.threadId} unexpectedly exited with code ${exitCode}.`);
      this.emit(EventName.Error, error);
    }

    this.rejectAllPendingMessages(error);
    this._debug(`CodeEngine worker #${this.threadId} has terminated`, { exitCode });
  }

  /**
   * Logs a debug message for this worker.
   */
  private _debug(message: string, data?: object) {
    this._logger.debug(message, { ...data, workerId: this.threadId });
  }
}
