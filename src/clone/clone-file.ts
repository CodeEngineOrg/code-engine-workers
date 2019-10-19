import { File, FileInfo } from "@code-engine/types";
import { clone } from "./clone";
import { CloneableObject } from "./clone-helpers";

/**
 * The data necessary to clone a `File` object across the thread boundary.
 * @internal
 */
export interface FileClone {
  path: string;
  source?: string;
  createdAt?: Date;
  modifiedAt?: Date;
  metadata?: CloneableObject;
  contents?: string | Buffer | Uint8Array | ArrayBuffer;
}


/**
 * Returns a cloneable copy of the given file.
 * @internal
 */
export function cloneFile(file: File | FileInfo): FileClone {
  return {
    path: file.path,
    source: String(file.source),
    createdAt: file.createdAt,
    modifiedAt: file.modifiedAt,
    metadata: clone(file.metadata) as CloneableObject,
    contents: file.contents,
  };
}
