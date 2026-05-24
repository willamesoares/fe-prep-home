---
title: "Big O notation in practice"
tags: [algorithm]
difficulty: easy
---

# Question

What does Big O measure, and what's the practical hierarchy from fastest to slowest?

# Answer

Big O describes how an algorithm's running time (or space) grows as the input size `n` grows. It ignores constants and lower-order terms because for large `n`, only the dominant term matters.

Practical hierarchy, fastest to slowest:

- **O(1)** — constant. Hash map lookup, array index, `Set.has`. Doesn't depend on size.
- **O(log n)** — logarithmic. Binary search in a sorted array, balanced tree lookup. Doubling `n` adds one step.
- **O(n)** — linear. Single pass over an array (`map`, `filter`, `reduce`, `Array.includes`).
- **O(n log n)** — linearithmic. Comparison-based sorts (`Array.sort`, merge sort, heap sort). The practical ceiling for "reasonable on millions of items."
- **O(n²)** — quadratic. Nested loops over the same array. Find duplicates by double-loop, bubble sort, naive substring search. Painful past ~10K items.
- **O(2ⁿ)** — exponential. Recursive enumeration of subsets without memoization (naive Fibonacci). Painful past ~30 items.
- **O(n!)** — factorial. Permutations. Painful past ~12 items.

The thing to actually internalize:

- **O(n²) is the most common interview trap.** Look for nested loops over the same data, or `array.includes` inside another loop (turns linear into quadratic). Replace with a `Set` or `Map`.

  ```js
  // O(n²) — includes is O(n), inside a loop
  for (const x of a) if (b.includes(x)) ...
  // O(n) — Set lookup is O(1)
  const bs = new Set(b);
  for (const x of a) if (bs.has(x)) ...
  ```

- **Sort + scan** is often the trick to turn an O(n²) problem into O(n log n).

- **Space matters too.** "O(n) extra space" usually means you're allocating an array/map; "O(1) extra" means you're modifying in place.
