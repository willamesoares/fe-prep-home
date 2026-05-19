---
title: "ESM vs CommonJS — what's actually different at runtime?"
tags: [js, tooling]
difficulty: medium
---

# Question

What are the runtime differences between ES Modules (`import`) and CommonJS (`require`)?

# Answer

**Resolution timing**

- CJS `require()` is synchronous and runs at the point where it appears. You can `require` inside `if` blocks.
- ESM `import` is statically parsed before any code runs. All imports are resolved up-front; you can't conditionally import (use `import()` dynamic for that).

**Bindings**

- CJS exports a **value snapshot**. `module.exports = { x }` exports a reference to the object; mutating `x` later doesn't propagate to importers who destructured.
- ESM exports **live bindings**. Importers always see the current value of an exported variable.

```js
// counter.js (ESM)
export let n = 0;
export function inc() { n++; }

// main.js
import { n, inc } from './counter.js';
console.log(n); // 0
inc();
console.log(n); // 1  — live binding
```

In CJS, the equivalent would log `0, 0` if `n` was destructured.

**`this` and globals**

- Top-level `this` in CJS is `module.exports`; in ESM it's `undefined`.
- ESM has no `__dirname`, `__filename`, `require`, `module`, `exports`. Use `import.meta.url` + `fileURLToPath` instead.

**Async**

- ESM supports top-level `await`. CJS doesn't.

**Interop**

- ESM can import CJS, but only the default export (the whole `module.exports`) — not named exports, unless the bundler synthesizes them.
- CJS can't `require()` an ESM file directly (sync vs async). Use dynamic `import()`.
