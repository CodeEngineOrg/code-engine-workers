import { ono } from "ono";
import { Worker, WorkerOptions } from "worker_threads";
import { createError } from "../clone/clone-error";
import { Message } from "../messaging/messages";
import { FinishedReply, Reply } from "../messaging/replies";

let messageCounter = 0;

/**
 * Enhances the messaging capabilities of the `Worker` class, adding support for async reqeust/response
 * and generator semantics.
 * @internal
 */
export class Messenger extends Worker {
  private readonly _pending = new Map<number, PendingMessage>();
  private readonly _completed: number[] = [];

  public constructor(filename: string, options?: WorkerOptions) {
    super(filename, options);
    this.on("message", this._handleMessage.bind(this));
  }

  /**
   * Sends a message to the `Executor`.
   */
  public postMessage(message: Message, transferList?: ArrayBuffer[]): number {
    let id = ++messageCounter;
    super.postMessage({ ...message, id }, transferList);
    return id;
  }

  /**
   * Sends a message and returns a promise that resolves when the `Executor` replies to the message.
   * If an error occurs while processing the message, then the promise will reject.
   */
  public async postMessageAsync(message: Message, transferList?: ArrayBuffer[]): Promise<Reply> {
    let id = this.postMessage(message, transferList);
    return this._awaitReply(id);
  }

  /**
   * Sends a message to the `Executor` and yields all replies. If an error occurs while processing
   * the message then the generator will reject.
   */
  public async* postMessageWithReplies(message: Message, transferList?: ArrayBuffer[])
  : AsyncGenerator<Reply, FinishedReply> {
    // Send the message and await the first reply
    let reply = await this.postMessageAsync(message, transferList);

    while (reply.type !== "finished") {
      // Immediately start waiting for the next reply,
      // in case it arrives while this generator function is paused
      let nextReply = this._awaitReply(reply.to);

      yield reply;
      reply = await nextReply;
    }

    return reply;
  }

  /**
   * Rejects all pending messages between the `Worker` and the `Executor`.
   */
  public rejectAllPendingMessages(error: Error): void {
    let currentlyPending = [...this._pending.entries()];
    this._pending.clear();

    for (let [messageId, pending] of currentlyPending) {
      this._completed.push(messageId);
      pending.reject(error);
    }
  }

  /**
   * Returns a promise that resolves when the `Executor` replies to the specified message.
   * If an error occurs while processing the message, then the promise will reject.
   */
  private async _awaitReply(id: number): Promise<Reply> {
    return new Promise<Reply>((resolve, reject) => {
      this._pending.set(id, { resolve, reject });
    });
  }

  /**
   * Handles incoming messages from the `Executor`.
   */
  private _handleMessage(reply: Reply) {
    try {
      // Delete the pending message, now that it's done
      let message = this._pending.get(reply.to);
      this._pending.delete(reply.to);

      if (message) {
        this._completed.push(reply.to);

        if (reply.type === "error") {
          message.reject(createError(reply.error));
        }
        else {
          message.resolve(reply);
        }
      }
      else if (!this._completed.includes(reply.to)) {
        // The specified message ID is neither pending nor completed
        throw ono({ messageId: reply.to }, `Invalid message ID: ${reply.to}`);
      }
    }
    catch (error) {
      // Something went wrong while handling the reply,
      // so emit the error so it can be handled appropriately
      this.emit("error", error);
    }
  }
}


/**
 * A message that was sent from a `Worker` to an `Executor` and is still being processed.
 */
interface PendingMessage {
  /**
   * Resolves the pending Promise when the `Executor` replies.
   */
  resolve(reply: Reply): void;

  /**
   * Rejects the pending Promise when an error occurs or the thread is terminated.
   */
  reject(reason: Error): void;
}
