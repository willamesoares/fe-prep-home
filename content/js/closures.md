---
title: "What is a closure?"
tags: [js]
difficulty: easy
---

# Question

What is a closure, and what's the classic bug with closures inside a `for` loop?

# Answer

A **closure** is the pairing of a function with the lexical scope it was defined in. When the function executes, it still has access to variables from that scope — even if the outer function has already returned.

```js
function counter() {
  let n = 0;
  return () => ++n;
}
const inc = counter();
inc(); // 1
inc(); // 2  — n survives because the inner function closed over it
```

The classic `var` loop bug:

```js
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0);
}
// logs: 3, 3, 3
```

All three callbacks closed over the **same** binding `i`. By the time they run, the loop has finished and `i === 3`.

Fix with `let`, which creates a new binding per iteration:

```js
for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0); // 0, 1, 2
}
```

Closures are how every JS module, every event handler with private state, and every "memoize/once/debounce" utility is built. They're also the source of most "why does my variable have the old value?" bugs.
