# Design system

Besh gives the flow editor most of the space. Navigation, setup, and workspace controls use the same visual language.

## Surfaces and type

- Light appearance uses a warm gray canvas, white surfaces, charcoal text, and dark primary actions. Dark appearance uses deep blue-gray surfaces, pale text, and light primary actions.
- Shared color tokens cover text, input borders, focus, graph connections, and status messages. Meaning must remain clear without relying on color alone.
- Rounded cards with thin borders and light shadows. Stronger emphasis belongs to the current action or selected node.
- Google Sans Flex Latin/Latin Extended and Noto Sans Thai are bundled locally. Explicit Unicode ranges select the matching subset without a network font service. System fonts cover other characters. Code and API responses keep a monospace stack.
- Body text uses weight 400, labels and controls use 500, section headings use 600, and main headings use 700. Primary form guidance uses 14 px regular text; compact field metadata may use 13 px. Status meaning remains visible through words, contrast, and emphasis.
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
- Empty Studio gives a clear spreadsheet or blank-API path according to current permissions. Opening either path saves no API. Keep saving, testing and publication explicit.
- Put exports and release history under **API tools**, below the canvas and test result. Primary actions, current endpoint, errors and response stay visible when tools close.
- Field settings show plain shared, tenant and member choices with current/refresh-needed/inactive status. Keep numeric review values under **Review details**; visible warnings and server version checks still apply. Phones remove redundant outer profile padding while retaining table and confirmation cards.
- Spreadsheet setup follows import, inspect rows, choose fields, and create a draft. Publishing and issuing a runtime key remain explicit actions.
- Product login follows connect GitHub, create a REST or GraphQL draft, review its graph, and publish. Use password fields for provider secrets and login proofs. Keep proof values out of visible test output and preview screenshots; explain the product server's role beside the template.
- API key replacement confirms immediate loss of access for the old key and preserves its API, permissions, and expiry. Reuse the one-time copy/save controls. Block navigation while a workspace task is pending so a successful credential response cannot disappear before it is shown.
- Load testing starts with a published API and small defaults. Hide load settings and request JSON until requested; show labeled request/variable forms. Confirm repeated live requests, allow leaving an active run, restore history after reload, and explain metrics without claiming production capacity. Mark temporary keys as managed and hide their replacement action.

## Review

Desktop layouts above 1100px use compact cards, form gaps and 32px actions. Phone controls retain their existing touch targets; do not apply desktop sizing to phone confirmations. The step picker uses a searchable modal with clear category and favorite states, contained keyboard focus and explicit selection. Appearance and language controls wrap within the phone header.

Keep translations readable at native phone widths. Korean welcome headings break at word boundaries rather than splitting their final syllable. Authored data stays untouched; see [language coverage](localization.md).

Run the [browser checks](testing.md) and [preview walkthrough](preview.md) after interface changes. Inspect setup, studio, data sources, workspace controls, custom dropdowns, and phone layouts in both appearances. Preserve behavior when changing visual structure.
