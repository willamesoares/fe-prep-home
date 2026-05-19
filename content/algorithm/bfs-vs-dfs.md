---
title: "BFS vs DFS — which to use when"
tags: [algorithm]
difficulty: medium
---

# Question

What's the difference between BFS and DFS for tree/graph traversal, and when do you pick each?

# Answer

Both visit every node; they differ in **order** and **data structure**.

**BFS — Breadth-First Search.** Uses a **queue**. Visits all nodes at depth d before any node at depth d+1.

```js
function bfs(start) {
  const queue = [start];
  const seen = new Set([start]);
  while (queue.length) {
    const node = queue.shift();   // FIFO
    for (const next of neighbors(node)) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
}
```

Pick BFS for:
- **Shortest path in an unweighted graph** — the first time you reach a node is along the shortest path.
- **"Closest" or "minimum number of steps"** problems (word ladder, min operations to transform).
- **Level-order traversal** of a tree.

**DFS — Depth-First Search.** Uses a **stack** (often the call stack via recursion). Goes deep along one branch before backtracking.

```js
function dfs(node, seen = new Set()) {
  if (!node || seen.has(node)) return;
  seen.add(node);
  for (const next of neighbors(node)) dfs(next, seen);
}
```

Pick DFS for:
- **Connectivity / reachability** ("is X connected to Y?").
- **Cycle detection.**
- **Topological sort** (post-order DFS).
- **All paths / backtracking** problems (sudoku, n-queens, permutations).
- **Tree problems where the recursion mirrors the structure** (max depth, lowest common ancestor).

Trade-offs:

- DFS recursion is shorter to write but risks stack overflow on deep graphs (~10K+ depth in JS). Convert to an iterative stack-based loop for safety.
- BFS uses O(width) extra memory; on a wide tree this can be larger than DFS's O(depth).
- `queue.shift()` is O(n) on a JS array — for performance, use a linked-list queue or two-pointer technique.
