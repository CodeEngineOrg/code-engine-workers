CodeEngine workers
======================================

[![Cross-Platform Compatibility](https://engine.codes/img/badges/os-badges.svg)](https://travis-ci.com/CodeEngineOrg/code-engine-workers)
[![Build Status](https://api.travis-ci.com/CodeEngineOrg/code-engine-workers.svg?branch=master)](https://travis-ci.com/CodeEngineOrg/code-engine-workers)

[![Coverage Status](https://coveralls.io/repos/github/CodeEngineOrg/code-engine-workers/badge.svg?branch=master)](https://coveralls.io/github/CodeEngineOrg/code-engine-workers)
[![Dependencies](https://david-dm.org/CodeEngineOrg/code-engine-workers.svg)](https://david-dm.org/CodeEngineOrg/code-engine-workers)

[![npm](https://img.shields.io/npm/v/@code-engine/workers.svg)](https://www.npmjs.com/package/@code-engine/workers)
[![License](https://img.shields.io/npm/l/@code-engine/workers.svg)](LICENSE)



This library is used inside [CodeEngine](https://engine.codes/) to provide multi-threaded concurrency. It exports a `WorkerPool` class, which manages worker threads and uses them to process files.

> **NOTE:** This is an **internal library** that is only intended to be used by CodeEngine. Using it outside of CodeEngine is discouraged.



`WorkerPool` class
-------------------------------
This class creates worker threads, manages their lifecycle, and transfers CodeEngine files back and forth between threads for processing.

```javascript
import WorkerPool from "@code-engine/workers";

// Create a new WorkerPool instance
let pool = new WorkerPool(emitter, context);

try {
  // Import a FileProcessor plugin in all workers
  let processFile = await pool.importFileProcessor("./my-file-processor.js");

  // Process a file on one of the workers
  await processFile(myFile, context);
}
finally {
  // Safely dispose the pool and threads
  await pool.dispose();
}
```


### `WorkerPool` constructor
The constructor accepts an [`EventEmitter`](https://nodejs.org/api/events.html#events_class_eventemitter) and a CodeEngine [`Context` object](https://github.com/CodeEngineOrg/code-engine-types/blob/master/src/context.d.ts). Both are required.

```javascript
import WorkerPool from "@code-engine/workers";
import { EventEmitter } from "events";

let emitter = new EventEmitter();

let context = {
  cwd: process.cwd(),
  concurrency: 4,
  debug: true,
  dev: false,
};

let pool = new WorkerPool(emitter, context);
```


### `WorkerPool.size`
Read-only property that returns the number of worker threads in the pool. After the [`dispose()` method](#workerpooldispose) is called, this property will always return zero.

```javascript
import WorkerPool from "@code-engine/workers";

let context = {
  concurrency: 4,
  ...
};

let pool = new WorkerPool(emitter, context);
console.log(pool.size);   // 4

await pool.dispose();
console.log(pool.size);   // 0
```


### `WorkerPool.isDisposed`
Indicates whether the [`dispose()` method](#workerpooldispose) has been called. Once disposed, the `WorkerPool` instance is no longer usable.

```javascript
import WorkerPool from "@code-engine/workers";

let pool = new WorkerPool(emitter, context);
console.log(engine.isDisposed);     // false

await engine.dispose();
console.log(engine.isDisposed);     // true
```


### `WorkerPool.importFileProcessor(module)`
Imports a CodeEngine [`FileProcessor` plugin](https://github.com/CodeEngineOrg/code-engine-types#types) in all worker threads.

- **module:** A module name, path, or [`ModuleDefinition` object](https://github.com/CodeEngineOrg/code-engine-types#types). The module must export a [`FileProcessor`](https://github.com/CodeEngineOrg/code-engine-types#types) function.

```javascript
import WorkerPool from "@code-engine/workers";
let pool = new WorkerPool(emitter, context);

// Import a FileProcessor plugin in all workers
let processFile = await pool.importFileProcessor("./my-file-processor.js");

// Process a file on one of the workers
await processFile(myFile, context);
```


### `WorkerPool.importModule(module)`
Imports a JavaScript module in all worker threads. The module export (if any) is ignored. This method is intended for loading polyfills, globals, hooks, and other modules with side-effects.

- **module:** A module name, path, or [`ModuleDefinition` object](https://github.com/CodeEngineOrg/code-engine-types#types).

```javascript
import WorkerPool from "@code-engine/workers";
let pool = new WorkerPool(emitter, context);

// Import a polyfill module in all worker threads
await pool.importModule("@babel/polyfill");
```


### `WorkerPool.dispose()`
Terminates the worker threads and releases all system resources that are held by a `WorkerPool` instance. Once `dispose()` is called, the WorkerPool instance is no longer usable.

```javascript
import WorkerPool from "@code-engine/workers";

let pool = new WorkerPool(emitter, context);
await pool.dispose();
```


### "error" event
This event is fired whenever an unhandled error occurs in any of the worker threads. If you don't handle this event, then Node.js will automatically terminate the process.

> **NOTE:** When an unhandled error occurs, the `WorkerPool` instance and/or its worker threads may be left in an invalid or unusable state. For this reason, we recommend that you [dispose the `WorkerPool` instance](#workerpooldispose) and stop using it.

```javascript
import WorkerPool from "@code-engine/workers";
let pool = new WorkerPool(emitter, context);

pool.on("error", (error) => {
  console.error("An unhandled error occurred:", error);
  pool.dispose();
});
```



Contributing
--------------------------
Contributions, enhancements, and bug-fixes are welcome!  [File an issue](https://github.com/CodeEngineOrg/code-engine-workers/issues) on GitHub and [submit a pull request](https://github.com/CodeEngineOrg/code-engine-workers/pulls).

#### Building
To build the project locally on your computer:

1. __Clone this repo__<br>
`git clone https://github.com/CodeEngineOrg/code-engine-workers.git`

2. __Install dependencies__<br>
`npm install`

3. __Build the code__<br>
`npm run build`

4. __Run the tests__<br>
`npm test`



License
--------------------------
@code-engine/workers is 100% free and open-source, under the [MIT license](LICENSE). Use it however you want.



Big Thanks To
--------------------------
Thanks to these awesome companies for their support of Open Source developers ❤

[![Travis CI](https://engine.codes/img/badges/travis-ci.svg)](https://travis-ci.com)
[![SauceLabs](https://engine.codes/img/badges/sauce-labs.svg)](https://saucelabs.com)
[![Coveralls](https://engine.codes/img/badges/coveralls.svg)](https://coveralls.io)
