import { CloneableObject, File, SourceMap } from "@code-engine/types";
import { NormalizedFileInfo } from "@code-engine/utils";

/**
 * The data necessary to clone a `File` object across the thread boundary.
 * @internal
 */
export interface FileClone {
  path: string;
  source?: string;
  sourceMap?: SourceMap;
  createdAt?: Date;
  modifiedAt?: Date;
  metadata?: CloneableObject;
  contents?: string | Buffer | Uint8Array | ArrayBuffer;
}


/**
 * Returns a cloneable copy of the given file.
 * @internal
 */
export function cloneFile(file: File | NormalizedFileInfo): [FileClone, [ArrayBuffer] | undefined] {
  let transferList: [ArrayBuffer] | undefined;
  let clone = { ...file };

  let { contents } = file;
  if (contents && contents.byteLength === contents.buffer.byteLength) {
    // The contents buffer has its own ArrayBuffer (as opposed to a slice of a shared ArrayBuffer).
    // So it's safe to transfer the entire ArrayBuffer across the thread boundary.
    transferList = [contents.buffer];
  }

  return [clone, transferList];
}
