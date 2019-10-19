import { ErrorLike, ono } from "ono";
import { clone } from "./clone";
import { Cloneable } from "./clone-helpers";

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
export function cloneError(error: ErrorLike): ErrorClone {
  return clone(error) as ErrorClone;
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
  else if (error.name in builtInErrorTypes) {
    // Convert the ErrorClone to the corresponding Error type
    let errorType = builtInErrorTypes[error.name];
    return errorType(error);
  }
  else {
    // Convert the ErrorClone to an Error instance
    return ono(error);
  }
}

/**
 * Function that coerce an `ErrorClone` to one of the built-in JavaScript error types
 */
const builtInErrorTypes = {
  [EvalError.name]: ono.eval,
  [RangeError.name]: ono.range,
  [ReferenceError.name]: ono.reference,
  [SyntaxError.name]: ono.syntax,
  [TypeError.name]: ono.type,
  [URIError.name]: ono.uri,
};
