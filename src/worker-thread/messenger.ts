import { MessagePort } from "worker_threads";
import { cloneError } from "../clone/clone-error";
import { IncomingMessage, LoadModuleMessage, Message, ProcessFileMessage } from "../messaging/messages";
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
   * Loads the specified JavaScript module.
   */
  public abstract async loadModule(message: IncomingMessage & LoadModuleMessage): Promise<void>;

  /**
   * Processes a file using the specified plugin.
   */
  public abstract async processFile(message: IncomingMessage & ProcessFileMessage): Promise<void>;

  /**
   * Replies to a message from the `Worker`.
   */
  public postReply(reply: Reply): void {
    this._port.postMessage(reply);
  }

  /**
   * Handles incoming messages from the `Worker`.
   */
  private async _handleMessage(message: IncomingMessage & Message) {
    try {
      // tslint:disable-next-line: switch-default
      switch (message.type) {
        case "loadModule":
          await this.loadModule(message);
          break;

        case "processFile":
          await this.processFile(message);
          break;
      }
    }
    catch (error) {
      // Something went wrong while handling the message, so reply with an error.
      this.postReply({ to: message.id, type: "error", error: cloneError(error as Error)});
    }
  }
}
