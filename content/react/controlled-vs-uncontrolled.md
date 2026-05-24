---
title: "Controlled vs uncontrolled form inputs in React"
tags: [react]
difficulty: medium
---

# Question

What's the difference between a controlled and an uncontrolled input in React, and when would you pick each?

# Answer

A **controlled** input has its value owned by React state. Every keystroke goes through `onChange` and re-renders the component:

```jsx
const [name, setName] = useState('');
<input value={name} onChange={(e) => setName(e.target.value)} />
```

An **uncontrolled** input keeps its value in the DOM. React only reads it when needed, usually via a ref:

```jsx
const ref = useRef<HTMLInputElement>(null);
<input ref={ref} defaultValue="" />
// later: ref.current?.value
```

Pick **controlled** when:
- You need to validate, transform, or react to keystrokes in real time
- The value drives other UI (e.g. live search, character counter)
- You're syncing the field with external state

Pick **uncontrolled** when:
- It's a write-once-then-submit form (e.g. plain login)
- You're integrating with non-React code that owns the DOM
- Re-rendering on every keystroke is measurably expensive

A common middle ground is `react-hook-form`, which is uncontrolled by default but feels controlled at the API level.
