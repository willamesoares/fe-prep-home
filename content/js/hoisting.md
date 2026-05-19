---
title: "What is hoisting? Are `let`/`const` hoisted?"
tags: [js]
difficulty: easy
---

# Question

What does "hoisting" mean for `var`, `let`/`const`, and function declarations?

# Answer

"Hoisting" means the engine processes declarations before executing any code in the scope. **All declarations are hoisted** — but how they behave before their source line differs.

```js
console.log(a); // undefined  — var is initialized to undefined
console.log(b); // ReferenceError — TDZ
console.log(c); // [Function: c]
var a = 1;
let b = 2;
function c() {}
```

- **`var`** is hoisted and initialized to `undefined` at the top of the function (not block) scope. Reading it before the assignment gives `undefined`.

- **`let` / `const`** are hoisted, but uninitialized — they live in the **Temporal Dead Zone (TDZ)** from the start of the block until their declaration. Touching them throws `ReferenceError`.

- **Function declarations** are hoisted **with their value**, so you can call them above their declaration.

- **Function expressions and class declarations** behave like `let`/`const` — the binding exists but is in TDZ.

The practical takeaway: write declarations before use anyway. TDZ exists specifically to surface "you used this before it was ready" bugs that `var` hides.
