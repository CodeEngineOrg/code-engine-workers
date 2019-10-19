import { parentPort, threadId } from "worker_threads";
import { Executor } from "./executor";

let executor = new Executor(threadId, parentPort!);
