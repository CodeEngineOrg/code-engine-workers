import { Cloneable, CloneableObject } from "@code-engine/types";
import { Ono } from "ono";
import { getPropertyNames, isCloneable } from "./clone-helpers";

const defaultDepth = 5;

/**
 * Returns a cloneable version of the given value. If the value is already cloneable, then it is
 * returned as-is. Otherwise, it is coerced into a cloneable value, which may be lossy.
 * @internal
 */
export function clone(value: unknown, depth = defaultDepth): Cloneable {
  if (isCloneable(value, depth)) {
    // This value is natively cloneable. So just return it as-is.
    return value;
  }

  if (value instanceof Error) {
    return clone(Ono.toJSON(value));
  }

  if (Array.isArray(value)) {
    // tslint:disable-next-line: no-null-undefined-union
    return value.map((item) => clone(item, depth));
  }

  if (value instanceof Map) {
    let copy = new Map<Cloneable, Cloneable>();
    for (let [k, v] of value.entries()) {
      copy.set(clone(k, depth), clone(v, depth));
    }
    return copy;
  }

  if (value instanceof Set) {
    let copy = new Set<Cloneable>();
    for (let v of value.values()) {
      copy.add(clone(v, depth));
    }
    return copy;
  }

  if (typeof value === "object") {
    let copy: CloneableObject = {};

    for (let key of getPropertyNames(value)) {
      let prop = (value as CloneableObject)[key];
      copy[key] = depth > 0 ? clone(prop, depth - 1) : undefined;
    }

    return copy;
  }
}
