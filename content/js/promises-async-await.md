---
title: "Promise chains vs async/await — what's actually different?"
tags: [js]
difficulty: medium
---

# Question

Is `async/await` just syntax sugar over `.then()`, or are there real semantic differences?

# Answer

Mostly sugar, with a few real differences worth knowing:

**Equivalent:**

```js
async function f() {
  const a = await getA();
  const b = await getB(a);
  return b;
}

// roughly:
function f() {
  return getA().then((a) => getB(a)).then((b) => b);
}
```

**Real differences:**

1. **Control flow** — `try/catch`, `if/else`, loops all work naturally with `await`. Replicating early-return-from-loop in a `.then` chain is painful.

2. **Stack traces** — `async/await` preserves cleaner stacks across awaits in modern engines. `.then` chains often lose context.

3. **Parallelism trap** — `await` is sequential by default. This is slow:
   ```js
   const a = await getA(); // waits for A...
   const b = await getB(); // ...then starts B
   ```
   For parallel fetches, start them first, then await:
   ```js
   const [a, b] = await Promise.all([getA(), getB()]);
   ```

4. **Error propagation** — a rejected promise inside an async function becomes a thrown error. An unhandled error in a `.then` chain without a final `.catch` becomes an unhandled rejection.

5. **Synchronous prefix** — code before the first `await` in an async function runs synchronously when the function is called. After the first `await`, everything is on the microtask queue.
