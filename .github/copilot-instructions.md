# Copilot Instructions — bennett

## Project context
This is a static HTML / CSS / JavaScript project with no build tools or bundler.

## Stack rules
- **HTML:** Use semantic elements (header, main, nav, section, article, footer)
- **CSS:** Use a separate style.css file with class-based selectors
  - No inline styles
  - Use CSS custom properties (variables) for colors and repeated values
  - Use Flexbox or Grid for layout — no floats
- **JavaScript:** Vanilla JS in a separate app.js file
  - No frameworks or libraries unless explicitly requested
  - Use modern ES6+ syntax (const/let, arrow functions, template literals)
  - Use addEventListener for event handling — no inline onclick attributes


## Accessibility standards (required)
- Target WCAG 2.2 Level AA. Treat accessibility as a completion requirement, not a later enhancement.
- Use semantic landmarks and elements before ARIA. Keep one `main` landmark, a logical heading outline without skipped levels, and a descriptive page `title`.
- Every interactive control must have an accessible name. Prefer visible text; use `aria-label` or `aria-labelledby` for icon-only controls.
- Every form control must have a programmatically associated visible label. Do not use placeholder text as the only label.
- Give meaningful images concise `alt` text and decorative images `alt=""`. Decorative icons must be hidden from assistive technology.
- All functionality must work with keyboard alone. Use the natural DOM tab order, never positive `tabindex` values, and support expected keys for composite widgets and overlays.
- Keep a clearly visible focus indicator on every focusable element. Do not remove outlines unless replacing them with an equally visible focus style.
- Use native controls such as `button`, `a`, `input`, `select`, and `textarea` instead of clickable `div` or `span` elements.
- Text contrast must be at least 4.5:1 (3:1 for large text); UI boundaries, icons, and focus indicators must be at least 3:1. Never communicate meaning through color alone.
- Associate validation and error messages with the affected control, set the appropriate invalid state, explain how to fix the problem, and preserve the user's input.
- Modal dialogs must trap focus, close with Escape, and return focus to their trigger. Menus, popovers, and dialogs must have keyboard-accessible dismissal.
- Respect `prefers-reduced-motion`, avoid flashing content, and do not require motion to understand state changes.
- Support reflow at 320px CSS width and 400% zoom without clipped content or two-dimensional scrolling, except where intrinsically necessary.
- Interactive targets must be at least 24x24 CSS pixels; prefer 44x44 for primary and touch-oriented controls.
- After every UI change, use the Vibe Studio accessibility checker and resolve all reported errors before considering the task complete. Fix the underlying markup or behavior; do not hide issues with `aria-hidden` or suppressions.

## Error-state standards (required)
- Design every async or destructive feature for loading, empty, success, validation, permission denied, not found, server failure, network failure, and timeout states where applicable. Never leave a blank screen or endless spinner.
- Preserve user input when an action fails, explain what happened in plain language, and provide a clear recovery action such as Retry, Edit, or Go back.
- Treat Vibe Studio error states as illustrative design conditions, not production request or network simulations.
- Read `window.__vibeErrorStateRuntime?.getActive()` and `getPending()` when the prototype initializes, then listen for the development event `vibe:error-state`. Match the state using `event.detail.id`; its phase is `pending`, `active`, or `inactive`.
- For Vibe-controlled delays, show loading during `pending` and the error during `active`; `event.detail.delayMs` describes the timing, so do not add a second timer. When `event.detail.timingMode` is `prototype`, Vibe Studio applies no delay and the prototype owns any requested loading-to-error timer.
- Keep custom error-state handling isolated from production behavior. Do not add visible test toggles, secret click targets, query parameters, or duplicate screens solely to expose an error state.
- Error-state UI must meet the accessibility standards above, including focus management, associated error text, live announcements when appropriate, and recovery that works with keyboard alone.

## HTML accessibility rules
- Set the document language with `<html lang="...">` and update it if the page content uses another language.
- Build custom behavior only when no native HTML element provides it. If a custom widget is unavoidable, implement its complete keyboard interaction and ARIA state model.
- Use `aria-live` or `role="status"` for important dynamic updates that must be announced, without moving focus unexpectedly.

## Code organization
- Keep HTML, CSS, and JS in separate files
- Keep functions small and focused
- Use descriptive variable and function names

## Preview
- Do NOT open the browser or run any command that launches a browser (e.g. `start`, `open`, `xdg-open`)
- The live preview is already visible in the embedded canvas to the left — no need to open anything externally


## What to avoid
- Do not add build tools (Webpack, Vite, etc.) unless explicitly requested
- Do not add npm or package.json unless explicitly requested

- Do not use jQuery or other utility libraries
- Do not generate test files unless explicitly asked
- Do not add comments explaining obvious code
