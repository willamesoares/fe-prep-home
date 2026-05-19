---
title: "How does prototypal inheritance work?"
tags: [js]
difficulty: medium
---

# Question

Explain prototypal inheritance. What's the difference between an object's own property and an inherited one?

# Answer

Every object has an internal `[[Prototype]]` link to another object (or `null`). When you read a property, the engine looks at the object itself; if not found, it walks up the prototype chain.

```js
const animal = { eats: true };
const dog = Object.create(animal);
dog.barks = true;

dog.barks;                          // true   — own property
dog.eats;                           // true   — inherited via chain
Object.hasOwn(dog, 'eats');         // false
Object.getPrototypeOf(dog) === animal; // true
```

A `class` is sugar over this:

```js
class Animal { eats() {} }
class Dog extends Animal { barks() {} }

const d = new Dog();
// d -> Dog.prototype -> Animal.prototype -> Object.prototype -> null
```

Methods live on the prototype (shared across instances); fields declared with `=` in the class body live on the instance.

Writes don't walk the chain — assigning `dog.eats = false` creates an own property that shadows the inherited one, leaving `animal.eats` untouched. The exception is setters, which do invoke the prototype's setter.

Modern code rarely manipulates prototypes directly; `class` syntax covers 99% of cases. But knowing the chain explains things like:

- Why `for...in` includes inherited properties but `Object.keys` doesn't.
- Why `Object.create(null)` is useful for maps (no inherited `toString`, `__proto__`, etc.).
- Why monkey-patching `Array.prototype` breaks every array everywhere.
