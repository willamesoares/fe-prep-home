---
title: "What is memoization? When does it actually help?"
tags: [algorithm]
difficulty: easy
---

# Question

What is memoization, and why does it turn naive Fibonacci from O(2ⁿ) into O(n)?

# Answer

Memoization caches the result of a function call, keyed by its arguments. The next call with the same arguments returns the cached value instead of recomputing.

Naive recursive Fibonacci recomputes the same subproblems exponentially many times:

```js
function fib(n) {
  if (n < 2) return n;
  return fib(n - 1) + fib(n - 2);
}
// fib(40) takes ~1 second; fib(50) is hopeless
```

`fib(40)` calls `fib(38)` twice, `fib(37)` three times, `fib(36)` five times — the count itself follows Fibonacci. The work is O(2ⁿ).

Memoize and each subproblem runs once:

```js
const cache = new Map();
function fib(n) {
  if (n < 2) return n;
  if (cache.has(n)) return cache.get(n);
  const result = fib(n - 1) + fib(n - 2);
  cache.set(n, result);
  return result;
}
// fib(1000) is instant
```

Now there are n distinct subproblems, each computed once. O(n) time, O(n) space.

When memoization helps:

- **Pure function** — same input → same output, no side effects.
- **Overlapping subproblems** — the same arguments come up many times.
- **Cheap to hash the arguments** — primitives or short strings work great; large objects don't.

When it doesn't:

- **No overlap** — caching wastes memory. Sorting doesn't benefit from memoization.
- **Output is huge** — you trade time for memory, but if the memory cost dominates, you've made it worse.
- **Inputs are objects without a stable identity** — `cache.get({x: 1})` won't hit, because each object literal is a new reference.

Memoization is also the bridge from top-down recursion to bottom-up dynamic programming. The DP table is essentially the memoization cache, filled iteratively.
