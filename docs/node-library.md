# Choose API steps

Open **Add step** in API Studio. A large dialog groups the supported steps into API, logic, data and product login. Search by name or description, or mark frequently used steps as favorites.

Choosing a step adds it to the editable draft and opens its settings. **Save draft**, **Test** and **Publish** remain explicit actions. Favorites store built-in descriptor IDs only and do not grant permissions or change an API.

The picker explains unavailable choices, including an existing starting request, read-only access, WebSocket restrictions and the graph limit. Keyboard focus stays inside the dialog; Escape closes it and returns focus to **Add step**. Mobile controls retain 44px touch targets while desktop controls use compact spacing.

Current steps are HTTP request, JSON response, condition, spreadsheet rows, SQLite rows and GitHub product login. WebSocket request/reply uses its matching labels and existing transport limits. Search accepts the current translated labels and English catalog terms.

Plugins remain planned. The [plugin proposal](plugins.md) defines a CommonJS module pattern, ZIP folder structure and an owner review/upload experience. No uploaded node code or ZIP installer runs in this release.

For verification, run `bun run test:e2e e2e/node-picker.spec.ts e2e/builder.spec.ts`. The stories cover search, favorites, reload, keyboard focus, pending saves, read-only members, native phone themes and the existing canvas editing journey.
