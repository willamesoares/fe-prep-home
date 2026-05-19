---
title: "How does React decide whether to update a component or replace it?"
tags: [react]
difficulty: hard
---

# Question

Walk through React's reconciliation rules. Why does swapping `<Foo />` for `<Bar />` at the same position throw away all state, but swapping props on `<Foo />` doesn't?

# Answer

React's reconciler compares the old tree to the new tree position by position. At each position it asks:

1. **Same element type?** (same component function, same tag name)
   - **Yes** → reuse the existing fiber. Props are updated. State, refs, and effects are preserved.
   - **No** → unmount the old subtree (running cleanups, losing state) and mount the new one from scratch.

2. **Same `key` among siblings?** Keys override position-based matching. Two `<Foo />`s with different keys are treated as different components even if they're at the same position.

So:

```jsx
// State preserved — same type at same position
{showAdmin ? <Profile role="admin" /> : <Profile role="user" />}

// State destroyed — different types at same position
{showAdmin ? <AdminProfile /> : <UserProfile />}

// State destroyed — same type but different key
<Profile key={userId} />
```

The "remount on key change" pattern is the idiomatic way to **reset** a component's state — e.g. resetting a form when the editing target changes:

```jsx
<EditForm key={editingItem.id} item={editingItem} />
```

Reconciliation does not look inside components. It can't tell that `<Profile role="admin" />` and `<AdminProfile />` render similar trees.
