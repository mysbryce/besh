# Third-party notices

Besh uses open-source dependencies. Their licenses remain in their installed packages and apply to their respective code.

The [product film](docs/product-video.md) was rendered locally with Remotion 4.0.534 under its [separate versioned license](https://github.com/remotion-dev/remotion/blob/v4.0.534/LICENSE.md). Renderer code and dependencies are not shipped with Besh. The film uses an original synthesized soundtrack and the same Google Sans Flex and Noto Sans Thai fonts whose notices appear below.

The bundled Google Sans Flex Latin and Latin Extended variable fonts are copyright 2022 The Google Sans Flex Project Authors and use the SIL Open Font License 1.1. See the original [font license](web/assets/google-sans-flex-OFL.txt) and [trademark notice](web/assets/google-sans-flex-TRADEMARKS.txt). Google Sans Flex and related Google names are trademarks of Google LLC; use of the font does not imply Google affiliation or sponsorship.

The bundled Noto Sans Thai variable font is copyright 2022 The Noto Project Authors and uses the SIL Open Font License 1.1. See its original [font license](web/assets/noto-sans-thai-OFL.txt).

All three font subsets are served locally, with no external font request at runtime. The [font manifest](web/assets/font-manifest.json) records official download URLs, byte counts, SHA-256 hashes, and immutable upstream commits for the license notices.

The button, badge, input, and textarea components in `web/components/ui/` were generated using [shadcn/ui](https://github.com/shadcn-ui/ui) and adapted for local utility imports and project formatting. The custom checkbox and select components use [Radix primitives](https://www.radix-ui.com/primitives). GraphQL execution uses [GraphQL.js](https://www.graphql-js.org/).

Excel parsing uses MIT-licensed [read-excel-file](https://github.com/catamphetamine/read-excel-file), copyright 2018 gitlab.com/catamphetamine. XML preflight checks use MIT-licensed [saxen](https://github.com/nikku/saxen), copyright 2012 Vopilovskii Konstantin and 2017-present Nico Rehwaldt. Their complete notices and dependency licenses ship in the installed packages. Spreadsheet fixtures under `test/fixtures/` are synthetic project test data.

shadcn/ui is MIT licensed:

Copyright (c) 2023 shadcn

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
