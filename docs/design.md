# Design system

Besh gives the flow editor most of the space. Navigation, setup, and workspace controls use the same visual language.

## Surfaces and type

- Light appearance uses a warm gray canvas, white surfaces, charcoal text, and dark primary actions. Dark appearance uses deep blue-gray surfaces, pale text, and light primary actions.
- Shared color tokens cover text, input borders, focus, graph connections, and status messages. Meaning must remain clear without relying on color alone.
- Rounded cards with thin borders and light shadows. Stronger emphasis belongs to the current action or selected node.
- Manrope is bundled locally. System fonts cover characters outside the bundled Latin font. Code and API responses use a monospace stack.
- Labels stay short. Explain permissions, errors, and destructive actions where the user needs to decide.

## Layout

- Desktop keeps navigation and saved APIs in the left rail. The editor groups route settings, canvas, configuration, and test output.
- Phones use compact navigation and a custom saved-API picker. Tables scroll inside their own containers; the document must not overflow horizontally.
- Setup uses example API cards as illustration. Examples are not workspace data or live execution results.
- The preview gallery shares the palette and typography. Its header uses the Besh icon and wordmark.
- Keep data previews inside scrollable tables. Show original spreadsheet headers and their API field names together.

## Interaction

- Checkboxes and dropdowns use styled accessible components. Do not expose native checkbox, radio, or select widgets.
- Keep visible focus, meaningful labels, keyboard selection, disabled states, and clear success/error feedback.
- Small entrance and hover transitions provide feedback. Respect `prefers-reduced-motion`; keep graph editing stable.
- Keys appear once in memory. Keep copy and acknowledgement actions close to the key, and mask credentials in previews.
- Appearance offers Light, Dark, and System. Save only the appearance preference in local storage; apply it before the dashboard paints and follow operating-system changes in System mode. Workspace sign-in uses an HttpOnly cookie; passwords and member keys are not stored in local storage.
- Common API tasks use labeled forms: response fields, conditions, test values, spreadsheet columns, and row limits. Put JSON and schema editors under Advanced. Preserve complex existing values when a form cannot represent them.
- Spreadsheet setup follows import, inspect rows, choose fields, and create a draft. Publishing and issuing a runtime key remain explicit actions.
- Product login follows connect GitHub, create a REST or GraphQL draft, review its graph, and publish. Use password fields for provider secrets and login proofs. Keep proof values out of visible test output and preview screenshots; explain the product server's role beside the template.
- API key replacement confirms immediate loss of access for the old key and preserves its API, permissions, and expiry. Reuse the one-time copy/save controls. Block navigation while a workspace task is pending so a successful credential response cannot disappear before it is shown.

## Review

Run the [browser checks](testing.md) and [preview walkthrough](preview.md) after interface changes. Inspect setup, studio, data sources, workspace controls, custom dropdowns, and phone layouts in both appearances. Preserve behavior when changing visual structure.
