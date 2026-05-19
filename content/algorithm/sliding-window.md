---
title: "The sliding window pattern"
tags: [algorithm]
difficulty: medium
---

# Question

When do you reach for a sliding window, and how does it work?

# Answer

Sliding window turns "look at every subarray/substring of size k" (O(n·k) or O(n²)) into a single pass (O(n)) by reusing work between adjacent windows.

Two flavors:

**Fixed size** — window of length k. Slide one step at a time; add the new element, remove the leaving one.

```js
// Max sum of any window of size k
function maxSum(nums, k) {
  let sum = 0;
  for (let i = 0; i < k; i++) sum += nums[i];
  let best = sum;
  for (let i = k; i < nums.length; i++) {
    sum += nums[i] - nums[i - k];   // add new, remove old
    best = Math.max(best, sum);
  }
  return best;
}
```

**Variable size** — grow and shrink the window based on a constraint. Two pointers `left` and `right`; advance `right` to grow, advance `left` to shrink when a condition is violated.

```js
// Longest substring without repeating characters
function lengthOfLongestSubstring(s) {
  const seen = new Map();
  let left = 0, best = 0;
  for (let right = 0; right < s.length; right++) {
    const ch = s[right];
    if (seen.has(ch) && seen.get(ch) >= left) {
      left = seen.get(ch) + 1;  // shrink past previous occurrence
    }
    seen.set(ch, right);
    best = Math.max(best, right - left + 1);
  }
  return best;
}
```

Spotting the pattern:

- The problem mentions "subarray", "substring", "window of size k", "longest/shortest contiguous …".
- A brute force would re-scan every subrange.
- The cost of moving the window by one element is O(1) (or amortized O(1) with a hash map / `Deque`).

Variations: sum-of-window, count-distinct-in-window (`Map<char, count>`), max-in-window (monotonic `Deque`), at-most-k-distinct (variable size).
