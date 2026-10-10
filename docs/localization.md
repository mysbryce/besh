# Languages

Besh supports English, Thai, Mandarin Chinese, Russian, Japanese, Korean and Portuguese. On first use, it reads the primary browser language. Regional variants such as `th-TH` and `pt-BR` use their matching language. Unsupported languages use English.

Use **Language** beside **Appearance** to choose a language. The custom selector supports keyboard navigation. An explicit choice survives reload and overrides the device language. Besh stores only its language code, never a credential or form payload.

Translations currently cover setup, workspace sign-in, invitations, navigation, appearance, common Studio form labels and the categorized step picker. Some Studio helper text, advanced policy panels, technical editors and server errors still use English. This is language support for these workflows, not a claim that every existing message has been translated.

Authored API/member names, routes, field keys, data, response text, GraphQL schemas and generated client code are not translated. Changing the dashboard language never changes an API contract or grants access.

## Development

`web/i18n.ts` owns language selection. `web/locales/` keeps matching message keys for each language. English loads with the dashboard; other dictionaries load on demand before their first screen. Missing keys use English. A failed download or five-second loading deadline leaves English available with an error. Late responses never change the active language; an explicit retry can use the arrived dictionary.

Keep text lookups explicit at the rendering boundary. Do not translate arbitrary user data, rewrite the DOM, or derive permissions from translated labels. Reuse stable descriptor IDs for node categories and favorites. Preserve interpolation names in every dictionary.

Run `bun run test:e2e e2e/locales.spec.ts`. It uses real Thai and unsupported Spanish browser contexts, changes all seven languages, reloads an explicit choice and checks that authored data stays unchanged. Held real dictionary responses exercise timeout/late delivery and invitations arriving during startup. Invitation fragments are stripped immediately; the latest link reaches the public invitation page without restoring a signed-in workspace. The [preview walkthrough](preview.md) also captures desktop and native 390px language states.

Remaining work: translate remaining Studio guidance, management panels and technical errors, add reviewed locale-aware number/date formatting, and verify translations with native speakers.
