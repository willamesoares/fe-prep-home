---
title: "Explain the JavaScript event loop, including microtasks vs macrotasks"
tags: [js]
difficulty: medium
---

# Question

What's the order of execution in this snippet, and why?

```js
console.log('1');
setTimeout(() => console.log('2'), 0);
Promise.resolve().then(() => console.log('3'));
queueMicrotask(() => console.log('4'));
console.log('5');
```

# Answer

Output: **`1, 5, 3, 4, 2`**

The event loop processes the call stack first. When the stack is empty, it drains the entire **microtask queue**, then runs **one macrotask**, then drains microtasks again, and so on.

- `1` and `5` are synchronous — they run immediately on the stack.
- `setTimeout` schedules a macrotask.
- `Promise.then` and `queueMicrotask` both schedule microtasks (FIFO).
- After the synchronous code finishes, the loop drains microtasks → `3`, then `4`.
- Then it runs the next macrotask → `2`.

Macrotask sources: `setTimeout`, `setInterval`, `setImmediate` (Node), I/O callbacks, `MessageChannel`, `postMessage`.
Microtask sources: Promise `.then`/`.catch`/`.finally`, `queueMicrotask`, `MutationObserver`.

Why it matters in practice:

- **Microtasks can starve rendering.** A `Promise.then` chain that schedules more `.then`s never yields to the browser — the page freezes. Use `setTimeout(0)` or `scheduler.yield()` to break long work into macrotasks.
- **Render happens between macrotasks**, not between microtasks. So `await` doesn't give the browser a chance to paint.
