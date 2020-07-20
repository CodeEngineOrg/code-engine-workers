import { parentPort, threadId } from "worker_threads";
import { Executor } from "./executor";

// eslint-disable-next-line no-new
new Executor(threadId, parentPort!);
