---
title: "How is `this` determined in JavaScript?"
tags: [js]
difficulty: medium
---

# Question

What determines the value of `this` in a function call?

# Answer

For a regular `function`, `this` is determined **at call time** by how the function is invoked. Four rules, in priority order:

1. **`new` call** → `this` is the freshly constructed object.
2. **Explicit binding** via `.call(obj, ...)`, `.apply(obj, ...)`, or `.bind(obj)` → `this` is `obj`.
3. **Method call** (`obj.fn()`) → `this` is `obj`.
4. **Plain call** (`fn()`) → `this` is `undefined` in strict mode, `globalThis` otherwise.

```js
const obj = { x: 1, get() { return this.x; } };
obj.get();              // 1   — method call
const g = obj.get;
g();                    // undefined (strict) — plain call, lost `this`
g.call({ x: 99 });      // 99  — explicit binding
```

**Arrow functions are different.** They don't have their own `this`; they capture `this` from the enclosing lexical scope at the time they're created. None of the four rules above apply. `.call(obj, ...)` on an arrow function does not change `this`.

```js
const obj = {
  x: 1,
  get: () => this.x, // `this` is whatever it was where the object literal lives
};
```

This is why class methods passed as callbacks (`<button onClick={this.handle}>`) lose their binding, but arrow methods (`handle = () => ...`) don't.
