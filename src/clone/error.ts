import { Cloneable } from "@code-engine/types";
import { ErrorLike, Ono, ono } from "@jsdevtools/ono";

/**
 * The data necessary to clone an `Error` object across the thread boundary.
 * @internal
 */
export interface ErrorClone {
  name: string;
  message: string;
  stack?: string;
  [key: string]: Cloneable;
}


/**
 * Returns a cloneable copy of the given error.
 * @internal
 */
export function cloneError(error: unknown): ErrorClone {
  if (typeof error === "object") {
    return Ono.toJSON(error as ErrorLike) as ErrorClone;
  }
  else {
    return error as ErrorClone;
  }
}


/**
 * Creates an `Error` object from an `ErrorClone`.
 * @internal
 */
export function createError(error: ErrorClone): Error {
  if (!error || typeof error !== "object" || error instanceof Error) {
    // It's not an ErrorClone, so just return it as-is
    return error;
  }
  else {
    // Convert the ErrorClone to the corresponding Error type
    return ono(error);
  }
}
