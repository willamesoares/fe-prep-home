---
title: "Building an accessible form"
tags: [html, a11y]
difficulty: medium
---

# Question

What does an accessible form input look like?

# Answer

The four things every input needs:

1. **A real `<label>` associated by `for`/`id`.** This is non-negotiable — screen readers announce the label when the input is focused, and clicking the label focuses the input.

   ```html
   <label for="email">Email</label>
   <input id="email" type="email" name="email" autocomplete="email" required>
   ```

   Wrapping the label around the input also works (`<label>Email <input></label>`) but the `for`/`id` pattern is more explicit.

2. **The right `type`.** `email`, `tel`, `url`, `number`, `date` give mobile users the correct keyboard, give browsers free validation, and give password managers / autofill better hints.

3. **`autocomplete` tokens.** This is the difference between a one-tap autofill and a manually-typed form. Use the named tokens: `name`, `email`, `tel`, `street-address`, `postal-code`, `current-password`, `new-password`, `one-time-code`, etc.

4. **Visible error messages, linked to the input.** Use `aria-invalid` and `aria-describedby`:

   ```html
   <label for="email">Email</label>
   <input id="email" type="email" aria-invalid="true" aria-describedby="email-err">
   <p id="email-err">Please enter a valid email address.</p>
   ```

Other things that come up:

- **Don't rely on `placeholder` as a label.** It disappears on focus, has poor contrast, and is invisible to many assistive technologies.
- **Group related fields** with `<fieldset>` and `<legend>` (e.g. address blocks, radio groups).
- **Submit buttons inside `<form>`** so Enter submits and screen readers find the action.
- **Required fields:** mark with `required` (real validation) and visually (e.g. an asterisk in the label). Screen readers announce `required` automatically.
