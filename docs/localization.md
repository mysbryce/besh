# Languages

Besh supports English, Thai, Mandarin Chinese, Russian, Japanese, Korean and Portuguese. On first use, it reads the primary browser language. Regional variants such as `th-TH` and `pt-BR` use their matching language. Unsupported languages use English.

Use **Language** beside **Appearance** to choose a language. The custom selector supports keyboard navigation. An explicit choice survives reload and overrides the device language. Besh stores only its language code, never a credential or form payload.

Translations cover setup, workspace sign-in, invitations, navigation, appearance, common Studio form labels, the categorized step picker, account/session management and update settings. Some Studio helper text, other management and advanced policy panels, technical editors and server errors still use English. This is language support for these workflows, not a claim that every existing message has been translated.

Authored API/member names, routes, field keys, data, response text, GraphQL schemas and generated client code are not translated. Changing the dashboard language never changes an API contract or grants access.

Account and update screens keep unsaved fields when you switch languages. Saving credentials, revoking a session, saving update settings and checking releases remain explicit actions. Their confirmations and guidance follow the current language; raw server errors remain unchanged.

Session and release-check times use the selected language, the browser's current timezone and the Gregorian calendar. Dates show a medium date and time to the minute; the server still enforces exact expiration timestamps. This does not change stored values, deadlines or timezone settings. Other screens retain their existing date/number formatting.

## Development

`web/i18n.ts` owns language selection and the memoized `useDateTime` formatter used by account/update screens. `web/locales/` keeps matching message keys for each language. English loads with the dashboard; other dictionaries load on demand before their first screen. Missing keys use English. A failed download or five-second loading deadline leaves English available with an error. Late responses never change the active language; an explicit retry can use the arrived dictionary.

Keep text lookups explicit at the rendering boundary. Do not translate arbitrary user data, rewrite the DOM, or derive permissions from translated labels. Reuse stable descriptor IDs for node categories and favorites. Preserve interpolation names in every dictionary.

Run `bun run test:e2e e2e/locales.spec.ts`. It uses real Thai and unsupported Spanish browser contexts, changes all seven languages, reloads an explicit choice and checks that authored data stays unchanged. Held real dictionary responses exercise timeout/late delivery and invitations arriving during startup. Invitation fragments are stripped immediately; the latest link reaches the public invitation page without restoring a signed-in workspace. The [preview walkthrough](preview.md) also captures desktop and native 390px language states.

The language stories also exercise all seven account/update screens, preserve unsaved form values, perform real account save/current-session revocation and owner settings writes, and deny private update reads for a viewer. The provider-boundary update story keeps an authored release title unchanged while translating its status and check time. These controlled provider replies do not prove a live GitHub release check. See [testing](testing.md) and [page previews](preview.md).

Remaining work: translate remaining Studio guidance, other management panels and technical errors, extend reviewed number/date formatting, and verify translations with native speakers. Native-speaker review is still pending.
