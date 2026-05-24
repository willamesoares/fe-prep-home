---
title: "== vs === — and the edge cases"
tags: [js]
difficulty: easy
---

# Question

When does `==` give a different result than `===`? Are there cases where `===` itself is surprising?

# Answer

`===` compares without type conversion. `==` first coerces operands toward a common type via a (notoriously complex) algorithm, then compares.

Cases where `==` surprises:

```js
0 == '';        // true
0 == '0';       // true
'' == '0';      // false   — not transitive
null == undefined; // true
null == 0;      // false
[] == false;    // true    — [] -> "" -> 0; false -> 0
[1] == 1;       // true
```

Rule of thumb: **always use `===`**, except one idiom — `x == null` is a common shorthand to check for both `null` and `undefined`.

`===` also has two famous surprises, but they're inherited from IEEE 754, not coercion:

```js
NaN === NaN;        // false  — use Number.isNaN(x)
0 === -0;           // true   — use Object.is(0, -0) to distinguish
```

`Object.is` is like `===` except `Object.is(NaN, NaN) === true` and `Object.is(0, -0) === false`. It's what React uses for prop/state equality checks.
