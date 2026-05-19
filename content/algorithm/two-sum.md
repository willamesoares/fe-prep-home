---
title: "Two Sum — the hash map pattern"
tags: [algorithm]
difficulty: easy
---

# Question

Given an array of integers and a target, return the indices of the two numbers that add up to the target. Why is this a classic, and what's the optimal solution?

# Answer

The brute force is two nested loops — O(n²):

```js
for (let i = 0; i < nums.length; i++)
  for (let j = i + 1; j < nums.length; j++)
    if (nums[i] + nums[j] === target) return [i, j];
```

The trick: as you scan once, ask "have I seen `target - current`?" If yes, you found the pair. A hash map of value → index makes that lookup O(1):

```js
function twoSum(nums, target) {
  const seen = new Map();
  for (let i = 0; i < nums.length; i++) {
    const need = target - nums[i];
    if (seen.has(need)) return [seen.get(need), i];
    seen.set(nums[i], i);
  }
  return [];
}
```

Single pass. O(n) time, O(n) space.

Why this matters: it's the foundational example of the **"trade space for time with a hash map"** pattern. The same trick solves:

- **First duplicate**: track seen values; return when you see one again.
- **Group anagrams**: hash by sorted-letter signature.
- **Subarray sum equals k**: hash prefix sums.
- **Longest substring without repeating characters**: hash last-seen index, combined with sliding window.

When you see "for each element, find another element such that …", reach for a hash map before reaching for a nested loop.
