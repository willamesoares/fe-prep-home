---
title: "What's the difference between unknown and any in TypeScript?"
tags: [typescript]
difficulty: medium
---
# Question

What is the practical difference between TypeScript's `unknown` and `any`?
When should you reach for each, and why?

# Answer

Both `unknown` and `any` are top types — values of any type are assignable
to them. The difference is what you can do with the value _afterwards_.

**`any` disables type checking.** A value typed `any` can be assigned to
anything and used as anything, with no compile-time complaints. It's an
opt-out from TypeScript.

```ts
const value: any = JSON.parse('{"name":"will"}');
value.name.toUpperCase();   // OK at compile time, may crash at runtime
value.foo.bar.baz();        // OK at compile time, will crash at runtime
const n: number = value;    // OK at compile time
```

**`unknown` requires narrowing.** A value typed `unknown` cannot be
assigned to anything else, and you cannot call methods or access
properties on it, until you've proven what it is via a type guard.

```ts
const value: unknown = JSON.parse('{"name":"will"}');
value.name;  // Error: 'value' is of type 'unknown'

if (typeof value === 'object' && value !== null && 'name' in value) {
  // TypeScript now knows enough to let you access .name
  console.log((value as { name: string }).name);
}
```

**When to use which:**

- `unknown` for values coming from outside your type system:
  `JSON.parse`, third-party APIs without types, `catch` clauses (default
  since TS 4.4 with `useUnknownInCatchVariables`), or `postMessage`
  payloads. Forces you to validate before using.
- `any` only as a deliberate, temporary escape hatch when migrating JS to
  TS, or when interfacing with a library whose types are wrong. Treat
  every `any` as a TODO.

Mental model: `unknown` is "I don't know what this is yet" — TypeScript
holds you accountable. `any` is "stop bothering me" — TypeScript walks
away.
