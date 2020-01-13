import { MessagePort } from "worker_threads";
import { cloneError } from "../clone/error";
import { ImportFileProcessorMessage, ImportModuleMessage, IncomingMessage, Message, ProcessFileMessage } from "../messaging/messages";
import { Reply } from "../messaging/replies";


/**
 * Allows an `Executor` to handle and reply to messages from a `Worker`.
 * @internal
 */
export abstract class Messenger {
  private _port: MessagePort;

  public constructor(port: MessagePort) {
    this._port = port;
    port.on("message", this._handleMessage.bind(this));
  }

  /**
   * Imports the specified `FileProcessor` module.
   */
  public abstract async importFileProcessor(message: IncomingMessage & ImportFileProcessorMessage): Promise<void>;

  /**
   * Imports the specified JavaScript module.
   */
  public abstract async importModule(message: IncomingMessage & ImportModuleMessage): Promise<void>;

  /**
   * Processes a file using the specified plugin.
   */
  public abstract async processFile(message: IncomingMessage & ProcessFileMessage): Promise<void>;

  /**
   * Replies to a message from the `Worker`.
   */
  public postReply(reply: Reply, transferList?: ArrayBuffer[]): void {
    this._port.postMessage(reply, transferList);
  }

  /**
   * Handles incoming messages from the `Worker`.
   */
  private async _handleMessage(message: IncomingMessage & Message) {
    try {
      // tslint:disable-next-line: switch-default
      switch (message.type) {
        case "importFileProcessor":
          await this.importFileProcessor(message);
          break;

        case "importModule":
          await this.importModule(message);
          break;

        case "processFile":
          await this.processFile(message);
          break;
      }
    }
    catch (error) {
      // Something went wrong while handling the message, so reply with an error.
      this.postReply({ to: message.id, type: "error", error: cloneError(error)});
    }
  }
}
