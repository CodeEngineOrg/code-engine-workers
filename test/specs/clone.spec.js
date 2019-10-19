/* eslint-disable no-new-wrappers, no-new-object */
"use strict";

const WorkerPool = require("../utils/worker-pool");
const createModule = require("../utils/create-module");
const createContext = require("../utils/create-context");
const { createFile } = require("@code-engine/utils");
const { expect } = require("chai");
const sinon = require("sinon");
const ono = require("ono");

describe("Cloning data across the thread boundary", () => {

  it("should clone primitives", async () => {
    let originalData = {
      nil: null,
      notDefined: undefined,
      notANumber: NaN,
      bool: true,
      falseBool: false,
      string: "Hello, world",
      emptyString: "",
      integer: 42,
      float: 3.14159,
      negative: -42,
      zero: 0,
      infinity: Infinity,
    };

    let [cloned, mutated] = await testClone(originalData, mutate);

    expect(cloned).to.deep.equal({
      nil: null,
      notDefined: undefined,
      notANumber: NaN,
      bool: true,
      falseBool: false,
      string: "Hello, world",
      emptyString: "",
      integer: 42,
      float: 3.14159,
      negative: -42,
      zero: 0,
      infinity: Infinity,
    });

    // Mutate every property of the data object
    function mutate (data) {
      data.nil = NaN;
      data.notDefined = null;
      data.notANumber = undefined;
      data.bool = 1;
      data.falseBool = 0;
      data.string += "!!!";
      data.emptyString += " ";
      data.integer += 1;
      data.float -= 1;
      data.negative -= 1;
      data.zero += 1;
      data.infinity = -Infinity;
    }

    expect(mutated).to.deep.equal({
      nil: NaN,
      notDefined: null,
      notANumber: undefined,
      bool: 1,
      falseBool: 0,
      string: "Hello, world!!!",
      emptyString: " ",
      integer: 43,
      float: 2.14159,
      negative: -43,
      zero: 1,
      infinity: -Infinity,
    });
  });


  it("should clone cloneable types", async () => {
    let originalData = {
      bool: new Boolean(),
      string: new String(),
      obj: new Object(),
      date: new Date("2005-05-05T05:05:05.005Z"),
      regex: new RegExp(/foo/),
      array: new Array(5),
      intArray: new Int32Array([-5, -4, -3]),
      uintArray: new Uint16Array([1, 2, 3, 4, 5]),
      floatArray: new Float64Array([Math.PI, Math.E]),
      set: new Set([1, 2, 3, 4, 5]),
      map: new Map([["one", 1], ["two", 2], ["three", 3]]),
    };

    let [cloned, mutated] = await testClone(originalData, mutate);

    expect(cloned).to.deep.equal({
      bool: new Boolean(),
      string: new String(),
      obj: new Object(),
      date: new Date("2005-05-05T05:05:05.005Z"),
      regex: new RegExp(/foo/),
      array: new Array(5),
      intArray: new Int32Array([-5, -4, -3]),
      uintArray: new Uint16Array([1, 2, 3, 4, 5]),
      floatArray: new Float64Array([Math.PI, Math.E]),
      set: new Set([1, 2, 3, 4, 5]),
      map: new Map([["one", 1], ["two", 2], ["three", 3]]),
    });

    // Make sure these didn't get converted to primitives
    expect(cloned.bool).to.be.an.instanceOf(Boolean).and.not.false;
    expect(cloned.string).to.be.an.instanceOf(String).and.not.equal("");

    // Make sure the array has a length of 5, even though no values were ever set
    expect(cloned.array).to.be.an.instanceOf(Array).with.lengthOf(5);

    // Make sure the Map and Set have the correct keys/values
    expect(cloned.map.get("one")).to.equal(1);
    expect(cloned.map.get("two")).to.equal(2);
    expect(cloned.map.get("three")).to.equal(3);
    expect(cloned.set.has(1)).to.equal(true);
    expect(cloned.set.has(3)).to.equal(true);
    expect(cloned.set.has(6)).to.equal(false);

    // Mutate every property of the data object. Some properties are immutable (boolean, string, RegExp)
    // so they are replaced entirely. But all other properties are modified in-place.
    function mutate (data) {
      data.bool = new Boolean(true);
      data.string = new String("Hello, world");
      data.obj.foo = "bar";
      data.date.setUTCFullYear(1999);
      data.regex = new RegExp(/not foo/);
      data.array[3] = "value";
      data.intArray[1] = 100;
      data.uintArray[3] = 100;
      data.floatArray[1] = 4.2;
      data.set.add(4).add(5).add(6);
      data.map.set("two", 222).set("four", 444);
    }

    expect(mutated).to.deep.equal({
      bool: new Boolean(true),
      string: new String("Hello, world"),
      obj: new Object({ foo: "bar" }),
      date: new Date("1999-05-05T05:05:05.005Z"),
      regex: new RegExp(/not foo/),
      array: [,,, "value",, ],   // eslint-disable-line
      intArray: new Int32Array([-5, 100, -3]),
      uintArray: new Uint16Array([1, 2, 3, 100, 5]),
      floatArray: new Float64Array([Math.PI, 4.2]),
      set: new Set([1, 2, 3, 4, 5, 6]),
      map: new Map([["one", 1], ["two", 222], ["three", 3], ["four", 444]]),
    });
  });


  it("should clone non-cloneable objects as POJOs", async () => {
    class Foo {
      constructor () {
        this.instanceProperty = 1;
      }

      get getter () {
        return this.instanceProperty + 2;
      }
    }

    Foo.prototype.protoProperty = 3;

    Object.defineProperty(Foo.prototype, "protoField", { value: 4 });

    Object.defineProperty(Foo.prototype, "protoGetter", {
      get () { return this.instanceProperty + 5; }
    });

    let originalData = {
      foo: new Foo(),
      url: new URL("http://example.com/foo/bar?baz=true#hash"),
    };

    let [cloned, mutated] = await testClone(originalData, mutate);

    // The objects were cloned as POJOs, not class instances
    expect(cloned.foo).not.to.be.an.instanceof(Foo);
    expect(cloned.url).not.to.be.an.instanceof(URL);

    expect(cloned).to.deep.equal({
      foo: {
        instanceProperty: 1,
        getter: 3,
        protoProperty: 3,
        protoField: 4,
        protoGetter: 6,
      },
      url: {
        protocol: "http:",
        username: "",
        password: "",
        hostname: "example.com",
        host: "example.com",
        port: "",
        origin: "http://example.com",
        pathname: "/foo/bar",
        search: "?baz=true",
        searchParams: {},
        hash: "#hash",
        href: "http://example.com/foo/bar?baz=true#hash",
      }
    });

    // Mutate properties of the data object. Note that we're able to modify read-only properties
    // here because they're copied across the thread boundary as normal writable fields.
    function mutate (data) {
      data.foo.instanceProperty = 100;
      data.foo.getter = 200;
      data.foo.protoProperty = 300;
      data.foo.protoField = 400;
      data.foo.protoGetter = 500;
      data.url = new URL("ftp://admin:letmein@abc.org:2121/subdir/file.txt");
    }

    // The objects were cloned as POJOs, not class instances
    expect(mutated.foo).not.to.be.an.instanceof(Foo);
    expect(mutated.url).not.to.be.an.instanceof(URL);

    expect(mutated).to.deep.equal({
      foo: {
        instanceProperty: 100,
        getter: 200,
        protoProperty: 300,
        protoField: 400,
        protoGetter: 500,
      },
      url: {
        protocol: "ftp:",
        username: "admin",
        password: "letmein",
        hostname: "abc.org",
        host: "abc.org:2121",
        port: "2121",
        origin: "ftp://abc.org:2121",
        pathname: "/subdir/file.txt",
        search: "",
        searchParams: {},
        hash: "",
        href: "ftp://admin:letmein@abc.org:2121/subdir/file.txt",
      }
    });
  });


  it("should clone lists of non-cloneable objects", async () => {
    class Foo {
      constructor (value) {
        this.instanceProperty = value;
      }

      get getter () {
        return this.instanceProperty + 1;
      }
    }

    let originalData = {
      array: [new Foo(1), new Foo(2)],
      set: new Set([new Foo(3), new Foo(4)]),
      map: new Map([["five", new Foo(5)], ["six", new Foo(6)]]),
    };

    let [cloned, mutated] = await testClone(originalData, mutate);

    expect(cloned).to.deep.equal({
      array: [{ instanceProperty: 1, getter: 2 }, { instanceProperty: 2, getter: 3 }],
      set: new Set([{ instanceProperty: 3, getter: 4 }, { instanceProperty: 4, getter: 5 }]),
      map: new Map([["five", { instanceProperty: 5, getter: 6 }], ["six", { instanceProperty: 6, getter: 7 }]]),
    });

    function mutate (data) {
      data.array[0].instanceProperty = 2;
      data.array[1].instanceProperty = 3;
      data.set.forEach((obj) => obj.instanceProperty += 1);
      data.map.get("five").instanceProperty = 6;
      data.map.get("six").instanceProperty = 7;
    }

    expect(mutated).to.deep.equal({
      array: [{ instanceProperty: 2, getter: 2 }, { instanceProperty: 3, getter: 3 }],
      set: new Set([{ instanceProperty: 4, getter: 4 }, { instanceProperty: 5, getter: 5 }]),
      map: new Map([["five", { instanceProperty: 6, getter: 6 }], ["six", { instanceProperty: 7, getter: 7 }]]),
    });
  });


  it("should clone errors as POJOs", async () => {
    let originalData = {
      err: new Error("Boom!"),
      typeError: new TypeError("Bad Type!"),
      errWithProps: (() => {
        let e = new Error("Boom");
        e.foo = 42;
        e.bar = /regex/;
        e.baz = new URL("http://example.com/foo/bar?baz=true#hash");
        return e;
      })(),
      onoError: ono.syntax({ foo: false, bar: [1, 2, 3]}, "Bad Syntax!"),
    };

    let [cloned] = await testClone(originalData);

    // Errors cannot be cloned, so they are cloned as POJOs.
    expect(cloned.err).not.to.be.an.instanceof(Error);
    expect(cloned.typeError).not.to.be.an.instanceof(Error);
    expect(cloned.errWithProps).not.to.be.an.instanceof(Error);
    expect(cloned.onoError).not.to.be.an.instanceof(Error);

    expect(cloned.err).to.deep.equal({
      name: "Error",
      message: "Boom!",
      stack: originalData.err.stack,
    });
    expect(cloned.typeError).to.deep.equal({
      name: "TypeError",
      message: "Bad Type!",
      stack: originalData.typeError.stack,
    });
    expect(cloned.errWithProps).to.deep.equal({
      name: "Error",
      message: "Boom",
      stack: originalData.errWithProps.stack,
      foo: 42,
      bar: /regex/,
      baz: {
        protocol: "http:",
        username: "",
        password: "",
        hostname: "example.com",
        host: "example.com",
        port: "",
        origin: "http://example.com",
        pathname: "/foo/bar",
        search: "?baz=true",
        searchParams: {},
        hash: "#hash",
        href: "http://example.com/foo/bar?baz=true#hash",
      }
    });
    expect(cloned.onoError).to.deep.equal({
      name: "SyntaxError",
      message: "Bad Syntax!",
      stack: originalData.onoError.stack,
      foo: false,
      bar: [1, 2, 3],
    });
  });


  it("should maintain object references when cloning", async () => {
    let foo = { name: "foo" };
    let bar = { name: "bar" };

    let originalData = {
      foo,
      bar,
      array: [foo, bar],
      set: new Set([foo, bar]),
      map: new Map([["foo", foo], ["bar", bar]]),
    };

    let [cloned, mutated] = await testClone(originalData, mutate);

    // The same `foo` and `bar` instances should be in each list
    expect(cloned.foo).not.to.equal(foo);
    expect(cloned.foo).to.deep.equal(foo);
    expect(cloned.bar).not.to.equal(bar);
    expect(cloned.bar).to.deep.equal(bar);
    expect(cloned.array[0]).to.equal(cloned.foo);
    expect(cloned.array[1]).to.equal(cloned.bar);
    expect(cloned.set.has(cloned.foo)).to.equal(true);
    expect(cloned.set.has(cloned.bar)).to.equal(true);
    expect(cloned.map.get("foo")).to.equal(cloned.foo);
    expect(cloned.map.get("bar")).to.equal(cloned.bar);

    // Changing the names of the objects in the Map should also change them everywhere else
    function mutate (data) {
      data.map.get("foo").name = "fooooo";
      data.map.get("bar").name = "barrrrr";
    }

    // The same `foo` and `bar` instances should be in each list
    expect(mutated.foo).to.deep.equal({ name: "fooooo" });
    expect(mutated.bar).to.deep.equal({ name: "barrrrr" });
    expect(mutated.array[0]).to.equal(mutated.foo);
    expect(mutated.array[1]).to.equal(mutated.bar);
    expect(mutated.set.has(mutated.foo)).to.equal(true);
    expect(mutated.set.has(mutated.bar)).to.equal(true);
    expect(mutated.map.get("foo")).to.equal(mutated.foo);
    expect(mutated.map.get("bar")).to.equal(mutated.bar);
  });

});

/**
 * Sends the given data across the worker thread boundary, mutates it, and then updates the original
 * data with the mutated values.
 */
async function testClone (data, mutate = () => undefined) {
  let context = createContext();
  let pool = WorkerPool.create(1, context);

  let file = createFile({
    path: "file1.txt",
    metadata: data,                                           // <--- The original data
  });

  let processFile = await pool.loadFileProcessor(await createModule(
    // eslint-disable-next-line no-new-func
    new Function("file", "context", `
      context.logger.log("data", file.metadata);              // <--- Log the cloned data
      (${mutate.toString()})(file.metadata);                  // <--- Mutate the data
      return file;                                            // <--- Return the mutated data
    `)
  ));

  let generator = processFile(file, context);
  let result = await generator.next();

  // Get the un-mutated cloned data that was logged
  sinon.assert.calledOnce(context.logger.log);
  let cloned = context.logger.log.firstCall.args[1];

  // Get the mutated cloned data that was returned
  let mutated = result.value.metadata;

  return [cloned, mutated];
}
