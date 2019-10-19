const objectPrototype = Object.getPrototypeOf({});

const primitives = ["string", "number", "boolean", "bigint"];

const cloneable = [
  Boolean, String, Date, RegExp, ArrayBuffer, DataView, Int8Array, Int16Array, Int32Array,
  Uint8Array, Uint8ClampedArray, Uint16Array, Uint32Array, Float32Array, Float64Array
];


/**
 * All Cloneable types
 * @internal
 */
export type Cloneable =
  undefined | string | number | boolean | bigint | Date | RegExp | CloneableObject | CloneableArray |
  CloneableSet | CloneableMap | ArrayBuffer | DataView | Int8Array | Int16Array | Int32Array |
  Uint8Array | Uint8ClampedArray | Uint16Array | Uint32Array | Float32Array | Float64Array;

/**
 * A Cloneable Array
 * @internal
 */
export interface CloneableArray extends Array<Cloneable> {}

/**
 * A Cloneable Set
 * @internal
 */
export interface CloneableSet extends Set<Cloneable> {}

/**
 * A Cloneable Map
 * @internal
 */
export interface CloneableMap extends Map<Cloneable, Cloneable> {}

/**
 * A Cloneable Object
 * @internal
 */
export interface CloneableObject { [key: string]: Cloneable; }


/**
 * Determines whether the given value can be cloned natively, meaning that we don't have to
 * clone it ourselves.
 * @internal
 */
export function isCloneable(value: unknown, depth: number): value is Cloneable {
  if (!value
  || primitives.includes(typeof value)
  || cloneable.some((type) => value instanceof type)) {
    // This value is natively cloneable. So just return it as-is.
    return true;
  }

  if (Array.isArray(value)) {
    return value.every((item) => isCloneable(item, depth));
  }

  if (value instanceof Set) {
    return [...value].every((item) => isCloneable(item, depth));
  }

  if (value instanceof Map) {
    return [...value].every(([k, v]) => isCloneable(k, depth) && isCloneable(v, depth));
  }

  if (typeof value === "object") {
    let proto = Object.getPrototypeOf(value);
    if (proto !== null && proto !== objectPrototype) {
      // This isn't a POJO
      return false;
    }

    if (depth > 0) {
      for (let key of getPropertyNames(value)) {
        if (!isCloneable((value as CloneableObject)[key], depth - 1)) {
          return false;
        }
      }

      // All properties of this object are cloneable
      return true;
    }
  }

  return false;
}


/**
 * Returns the own and inherited property names of the given object.
 * @internal
 */
export function getPropertyNames(obj: object | null): string[] {
  let keys = [];
  let proto = obj;

  // Crawl the prototype chain to get all keys
  while (proto && proto !== objectPrototype) {
    for (let key of Object.getOwnPropertyNames(proto)) {
      // Ignore methods, since functions aren't cloneable
      if (typeof (obj as CloneableObject)[key] !== "function") {
        keys.push(key);
      }
    }

    proto = Object.getPrototypeOf(proto) as object | null;
  }

  return keys;
}
