# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- Added `translateDocumentUpload()`, `translateDocumentGetStatus()` and
  `translateDocumentDownload()`, which replace `uploadDocument()`,
  `getDocumentStatus()` and `downloadDocument()` and behave the same.
- Added `documentId` to `DocumentStatus`, parsed from the response field
  `document_id`; `undefined` when absent or not a string.
- Added the `timeoutMs` option to `DocumentTranslateOptions`: the maximum time
  `translateDocument()` waits for the translation between upload and download.
  When it expires, `translateDocument()` rejects with a `DocumentTranslationError`.
- Added the `WaitOptions` type with `timeoutMs`.
- Added `tagHandlingVersion` to `TextResult`: the tag handling version used, parsed
  from the response; `undefined` when the API does not return it.
- `SentenceSplittingMode` accepts `'1'` and `'0'`, the API values, which are sent
  unchanged.
- Added the `extraBodyParameters` option to `BaseRequestOptions`, and so to
  `TranslateTextOptions`, `DocumentTranslateOptions` and `RephraseTextOptions`.
  It replaces `extraRequestParameters` and behaves the same. Passing both
  throws `ArgumentError`.
- Added `NotFoundError`, thrown when the API answers HTTP 404 on any endpoint.
  `GlossaryNotFoundError` now extends it.
- Added `httpStatusCode` to `DeepLError`: the HTTP status code of the failed
  response, or `undefined` if there was no HTTP response.
- Added `shouldRetry` to `DeepLError` (previously only on `ConnectionError`):
  true for HTTP 429, 5xx and transient network failures. For
  `DeepLAdminClient.createDeveloperKey()` it is true only when the request was
  not processed (HTTP 429, DNS failures and refused connections).
- The `proxy` option also accepts a proxy URL string, for example
  `'http://user:pass@proxy.example.com:3128'`.
- `isFreeAccountAuthKey()` is exported from the package root.
- Added the `styleProfile` option to `TranslateTextOptions` and
  `DocumentTranslateOptions` to translate text and documents with a style
  profile, given as its ID or a `StyleProfile` object. It is sent as
  `style_profile_id`.
- Added style profiles (`/v3/style_profiles`) to `DeepLClient`:
  `listStyleProfiles()`, `createStyleProfile()`, `getStyleProfile()`,
  `updateStyleProfile()` and `deleteStyleProfile()`. Added the `StyleProfile`,
  `StyleProfileOptions` and `StyleProfileUpdateOptions` types.
- Added spoken terms collections (`/v3/spoken-terms`) to `DeepLClient`:
  `createSpokenTerms()`, `listSpokenTerms()`, `getSpokenTerms()`,
  `updateSpokenTerms()`, `getSpokenTermsEntries()`, `replaceSpokenTermsList()`,
  `deleteSpokenTerms()` and `deleteSpokenTermsList()`. Added the `SpokenTerms`,
  `SpokenTermsList` and `SpokenTermsEntries` types, and the
  `CreateSpokenTermsOptions`, `UpdateSpokenTermsOptions` and
  `ReplaceSpokenTermsListOptions` types, which accept `extraBodyParameters`.
  The options of `updateSpokenTerms()` are optional; without them an empty body
  is sent.
- Added the API Pro fields of `GET /v2/usage` to `Usage`: `apiKeyCharacter`,
  `speechToTextMinutes` and `speechToSpeechMinutes` (`UsageDetail`), `products`
  (array of the new `UsageProduct` type), and `startTime` and `endTime`
  (`Date`). They are `undefined` when the response does not contain them.
  `anyLimitReached()` still checks only the character, document and team
  document usage.
- Added the `DeepLAdminClient` class for the Admin API. It must be created with
  an admin API key and supports managing developer keys
  (`createDeveloperKey()`, `getDeveloperKeys()`, `deactivateDeveloperKey()`,
  `renameDeveloperKey()`, `setDeveloperKeyUsageLimits()`) and retrieving usage
  analytics (`getUsageAnalytics()`, `getCustomTagUsageAnalytics()`). Added the
  `HttpClientOptions`, `DeepLAdminClientOptions`, `DeveloperKey`,
  `DeveloperKeyUsageLimits`, `DeveloperKeyUsageLimitsUpdate`, `AdminUsageReport`,
  `AdminUsageBreakdown`, `KeyUsage`, `AdminUsageGroupBy`, `CustomTagUsageReport`,
  `CustomTagUsage`, `CustomTagUsageBreakdown`, `CustomTagUsageAggregateBy`,
  `CustomTagUsageAnalyticsOptions` and `AdminUsageAnalyticsOptions` types.
  `AdminUsageBreakdown` includes `speechToSpeechMinutes`.
- Added `getLanguageResources()` to `DeepLClient`, which retrieves the resources
  supported by the DeepL API and, for each feature, whether the source and/or
  target language must support it. Added the `LanguageResource` and
  `ResourceFeature` types.
- Added `getLanguagesForResource()` to `DeepLClient`, which retrieves the languages supported
  by a DeepL API resource (`GET /v3/languages`), whether each is usable as source
  and/or target language, and the features it supports. The optional `include`
  option adds beta languages and features, or features relying on third-party
  providers. Added the `LanguageSupport`, `LanguageFeature`,
  `LanguageResourceName`, `LanguageInclude` and `GetLanguagesForResourceOptions` types.
- Added `de-CH`, `de-DE`, `es-ES`, `fr-CA`, and `fr-FR` to `TargetLanguageCode`.
- Added `correctText()` to `DeepLClient`, which corrects grammar, spelling and punctuation
  of a string or an array of strings via `POST /v2/write/correct`. Takes an optional
  target language and returns `WriteResult` objects, like `rephraseText()`.
- Added the `outputFormat` option to `DocumentTranslateOptions`, which requests the file
  format of the translated document, for example `'docx'`. By default the translated
  document has the same format as the input document.
- Added the `enableWatermark` option to `DocumentTranslateOptions`, which adds a
  "Translated by DeepL" watermark to the translated document. Only supported for
  `docx` and `pdf` output.
- Added `translateDocumentWaitUntilDone()`, which polls a document translation
  until it is done and resolves with the final `DocumentStatus`, or rejects with
  a `DeepLError` if the translation fails. Its optional second argument
  (`WaitOptions`) takes `timeoutMs`, after which it rejects with a `DeepLError`.
- Added the `RephraseTextOptions` type with `writingStyle` and `tone`. It
  extends `BaseRequestOptions`, so it also accepts `extraRequestParameters`,
  which are added to the request body and override parameters of the same
  name. `rephraseText()` accepts it as its third argument.
- `createStyleRule()` accepts the name, language, configured rules and custom
  instructions as separate arguments:
  `createStyleRule(name, language, configuredRules?, customInstructions?)`.
  They use the API's names and are sent as given: `configuredRules` as
  `configured_rules` (e.g. `{ dates_and_times: { calendar_era: 'use_bc_and_ad' } }`,
  like `updateStyleRuleConfiguredRules()`), and `customInstructions` as
  `custom_instructions` (`CustomInstructionRequestBody` objects with `label`,
  `prompt` and `source_language`).
- `createStyleRuleCustomInstruction()` and `updateStyleRuleCustomInstruction()`
  accept the label, prompt and optional source language as separate arguments:
  `createStyleRuleCustomInstruction(styleId, label, prompt, sourceLanguage?)` and
  `updateStyleRuleCustomInstruction(styleId, instructionId, label, prompt, sourceLanguage?)`.

### Changed
- `Formality`, `SentenceSplittingMode`, `TagHandlingMode`, `TagHandlingVersion`
  and `ModelType` accept any string in addition to their listed values, so values
  the API adds later can be passed without a type cast.
- Every HTTP 404 response now throws `NotFoundError`; before, only glossary
  requests threw an error class of their own (`GlossaryNotFoundError`, which
  is still thrown there) and other requests threw a plain `DeepLError`.
- The default per-attempt timeout (`minTimeout`) is now 10 seconds instead of
  5 seconds.
- Refused connections (`ECONNREFUSED`) and DNS lookup failures (`ENOTFOUND`)
  are now retried like other transient network failures.
- `getSourceLanguages()`, `getTargetLanguages()`, and `getGlossaryLanguagePairs()` now call the
  `GET /v3/languages` endpoint instead of the deprecated `GET /v2/languages` and
  `GET /v2/glossary-language-pairs` endpoints. The returned language lists may contain
  additional languages.
- Target languages `en` and `pt` are no longer rejected client-side as deprecated;
  the DeepL API translates them as `en-US` and `pt-PT`. `TargetLanguageCode` now
  includes `en` and `pt`.
- The language parameters of `translateText()`, `translateDocument()`,
  `uploadDocument()`, `createGlossary()` and `createGlossaryWithCsv()` accept
  any language code string, so languages the API adds can be used without a new
  release of this package. They use the new `SourceLanguageCodeInput`,
  `TargetLanguageCodeInput` and `LanguageCodeInput` types, which keep editor
  autocompletion for the listed codes. Result types are unchanged.
- README: the document minification section no longer states a 30 MB upload
  limit and links to the DeepL API usage limits instead.

### Deprecated
- `uploadDocument()`, `getDocumentStatus()` and `downloadDocument()` are
  deprecated; use `translateDocumentUpload()`, `translateDocumentGetStatus()`
  and `translateDocumentDownload()` instead. They will be removed in the next
  major version.
- `SentenceSplittingMode` values `'on'` and `'default'` are deprecated. Use `'1'`
  instead.
- `extraRequestParameters` is deprecated; use `extraBodyParameters` instead.
  It will be removed in the next major version.
- `Translator` and `TranslatorOptions` are deprecated; use `DeepLClient` and
  `DeepLClientOptions` instead, which support every method of `Translator`.
  They will be removed in the next major version.
- `GlossaryNotFoundError` is deprecated; catch `NotFoundError` instead. It will
  be removed in the next major version.
- `TranslateTextOptions.__path` is deprecated. It is for internal use only
  and will be removed in the next major version.
- `isDocumentTranslationComplete()` is deprecated; use
  `translateDocumentWaitUntilDone()` instead. It will be removed in the next
  major version.
- Passing the writing style and tone of `rephraseText()` as positional
  arguments is deprecated; pass a `RephraseTextOptions` object as the third
  argument instead. The positional form will be removed in the next major
  version.
- Passing a single `CreateStyleRuleRequestBody` object to `createStyleRule()`
  is deprecated, as is the `CreateStyleRuleRequestBody` type; pass separate
  arguments instead. Passing a `CustomInstructionRequestBody` object to
  `createStyleRuleCustomInstruction()` or `updateStyleRuleCustomInstruction()`
  is deprecated; pass the label, prompt and source language as separate
  arguments instead. These object forms and `CreateStyleRuleRequestBody` will be
  removed in the next major version.
- Document minification is deprecated: the `enableDocumentMinification` option
  of `DocumentTranslateOptions`, the `DocumentMinifier` class, and the
  `DocumentMinificationError` and `DocumentDeminificationError` errors. The
  DeepL API accepts larger documents; see the
  [usage limits](https://developers.deepl.com/docs/resources/usage-limits).
  Minification keeps working and will be removed in the next major version.
- `checkStatusCode()` and the internal `*ApiResponse` types used to parse API
  responses (`MultilingualGlossaryDictionaryEntriesApiResponse`,
  `MultilingualGlossaryDictionaryApiResponse`,
  `ListMultilingualGlossaryApiResponse`, `StyleRuleInfoApiResponse`,
  `ListStyleRuleApiResponse`, `TranslationMemoryInfoApiResponse`,
  `ListTranslationMemoryApiResponse`, `TranslationMemorySegmentsApiResponse`,
  `TranslationMemoryImportApiResponse`, `TranslationMemoryExportApiResponse`,
  `TranslationMemoryJobApiResponse` and `LanguageResourceApiResponse`) are
  deprecated. They are internal and will no longer be exported in the next
  major version.

### Fixed
- `DocumentStatus.ok()` is now true for every status except `'error'`. Before,
  a status the library did not know made `translateDocument()` and
  `translateDocumentWaitUntilDone()` stop polling and reject with
  `unknown error`.
- An HTTP 503 response to `translateDocumentGetStatus()` and `getDocumentStatus()`
  now throws `DeepLError`; before it threw `DocumentNotReadyError`, which is meant
  for document downloads only.
- The document ID is now URL-encoded in the request paths of the document
  status and download methods.
- `extraBodyParameters` (and `extraRequestParameters`) of `translateText()` and
  `uploadDocument()`/`translateDocument()` now replace every parameter of the same
  name set by the library. Before, parameters appended after the languages and
  glossaries, such as `text`, `split_sentences`, `style_id` or `output_format`, were
  sent twice.
- `translateText()` no longer writes the lower-cased `splitSentences` value back into
  the caller's options object.
- `maxRetries` now counts retries after the first attempt, as documented:
  before, `maxRetries: N` made only N - 1 retries, so the default of 5 made 5
  attempts instead of 6 and `maxRetries: 1` made no retry.
- HTTP 401 responses now throw `AuthorizationError`, like 403; before they
  threw a `DeepLError` with "Unexpected status code".
- The authentication key is trimmed before it is checked, used for the free
  account (`:fx`) detection and sent; a whitespace-only key is rejected.
- Malformed or non-object API responses now throw `DeepLError`; before, some
  methods (`getSourceLanguages()`, `getTargetLanguages()`, the multilingual
  glossary, style rule, custom instruction, spoken terms and style profile
  methods) let a raw `SyntaxError` or `TypeError` escape.
- `downloadTranslationMemoryExport()` no longer hangs on Node 16 and 17 when the output file
  already exists. It now rejects with `EEXIST` before downloading anything, on every Node
  version, and leaves the existing file unchanged.

## [1.28.1] - 2026-10-09
### Security
- Bumped `axios` to `^1.20.0` and `adm-zip` to `^0.6.1` to resolve
  high-severity npm audit advisories in production dependencies.

## [1.28.0] - 2026-08-11
### Added
- Added support for using multiple glossaries in text and document translation
  via the `glossaryIds` option (up to 5 glossary IDs) in `TranslateTextOptions`
  and `DocumentTranslateOptions`.
- Added support for style rules in document translation via the `styleRule`
  option in `DocumentTranslateOptions`.
- Added support for translation memories in document translation via the
  `translationMemory` and `translationMemoryThreshold` options in
  `DocumentTranslateOptions`.
- Added support for the translation memory management APIs:
  `getTranslationMemory()`, `listTranslationMemorySegments()`,
  `deleteTranslationMemory()`, `createTranslationMemoryImport()`,
  `uploadTranslationMemoryFile()`, `createTranslationMemoryExport()`,
  `getTranslationMemoryJob()`, `isTranslationMemoryJobComplete()`, and
  `downloadTranslationMemoryExport()`, along with the
  `importTranslationMemoryFromFilepath()` and
  `exportTranslationMemoryToFilepath()` convenience functions that create the
  job, transfer the TMX file, and wait for the job to finish. Because the API
  detects the file upload asynchronously, an import job keeps reporting
  `awaiting_input` for a while after the upload; the wait loop polls through
  that status and accepts an optional `timeoutMs` to bound the wait.
- Added the `TranslationMemorySegments`, `TranslationMemorySegment`,
  `TranslationMemoryTargetSegment`, `TranslationMemorySegmentsOptions`,
  `TranslationMemoryImport`, `TranslationMemoryExport`, `TranslationMemoryJob`,
  `TranslationMemoryJobResult`, and `TranslationMemoryJobStatus` types.
- Added optional `creationTime` and `updatedTime` fields to
  `TranslationMemoryInfo`.

### Changed
- Requests to the pre-signed storage URLs used for translation memory import and export now
  go through a separate HTTP client that is constructed without the DeepL `Authorization`
  header, instead of stripping it per request. Headers supplied via `TranslatorOptions.headers`
  are no longer sent to those URLs either — only the `User-Agent` and the per-request
  `Content-Type`. Proxy settings are unaffected.

### Fixed
- The debug log helper no longer crashes when axios error fields return a non-primitive from `toString` or `Symbol.toPrimitive`.

### Security
- Bumped `axios` to `^1.19.0`, `form-data` to `^3.0.5`, and `adm-zip` to
  `^0.6.0` to resolve high-severity npm audit advisories in production
  dependencies.

## [1.27.0] - 2026-04-27
### Changed
- Replaced the `uuid` dependency with Node's built-in `crypto.randomUUID()`.
  Resolves GHSA-w5hq-g745-h8pq (`uuid <14.0.0`) and removes a runtime
  dependency.
- Bumped minimum Node version from `>=12.0` to `>=14.17`. Node 12 reached
  end of life in April 2022, and `crypto.randomUUID()` is available from
  Node 14.17 onward.

### Fixed
- HTTP requests that fail with `ECONNRESET`, `EPIPE`, or `EAI_AGAIN` are now
  retried. Previously these were classified as non-retryable, surfacing
  transient transport failures (e.g. stale keep-alive sockets) as hard errors
  on the first attempt. Behavior now aligns with deepl-python.

### Security
- Bump follow-redirects to 1.16.0 due to GHSA-r4q5-vmmm-2653.

## [1.26.0] - 2026-04-09
### Added
- Added support for translation memories in text translation via
  `translationMemory` and `translationMemoryThreshold` options in
  `translateText()`.
- Added `listTranslationMemories()` method to the `DeepLClient` class for
  listing available translation memories.

### Changed
- Bumped `axios` dependency due to CVE-2025-62718

### Fixed
- Fix write tests that broke from language expansion

## [1.25.0] - 2026-03-26
### Added
- Added new language constants from January 2026 API release of 81 new languages.
- Added `jsonBody` option to `SendRequestOptions`, enabling JSON-encoded API calls.
- Added support for style rules CRUD endpoints in the `DeepLClient` class:
  `createStyleRule()`, `getStyleRule()`, `updateStyleRuleName()`,
  `updateStyleRuleConfiguredRules()`, and `deleteStyleRule()`.
- Added support for style rule custom instruction CRUD endpoints in the
  `DeepLClient` class: `createStyleRuleCustomInstruction()`,
  `getStyleRuleCustomInstruction()`, `updateStyleRuleCustomInstruction()`,
  and `deleteStyleRuleCustomInstruction()`.
  Please refer to the README for usage instructions.

### Changed
- Updated formality tests to accept either formal or informal output when using default formality,
  since default formality is now automatic.
- Removed Node 12 from the CI as it broke and is end-of-life.
- Updated our model type tests to expect the `model_type_used` to be populated when the `model_type` is specified in the request
- Updated a tag handling test to add a missing `</p>` tag
- Improved `NotFoundException` error message by removing the misleading "check server_url" suggestion.
- Bumped `axios` dependency due to CVE-2026-25639

## [1.24.0] - 2025-12-10
### Added
- Added `tagHandlingVersion` parameter to `translateText()` to specify which version of the tag handling algorithm to use. Options are `v1` and `v2`.

## [1.23.0] - 2025-12-03
### Added
- Added `customInstructions` parameter to `translateText()` to customize translation
  behavior with up to 10 instructions (max 300 characters each). Only supported for
  target languages: `de`, `en`, `es`, `fr`, `it`, `ja`, `ko`, `zh` and their variants.
  Note: using the `customInstructions` parameter will use `quality_optimized` model type
  as the default. Requests combining `customInstructions` and the `latency_optimized`
  model type will be rejected.

## [1.22.0] - 2025-11-12
### Added
- Added support for the `GET /v3/style_rules` endpoint in the client library, the
  implementation can be found in the `DeepLClient` class. Please refer to the
  README for usage instructions
- Added `styleId` option to `translateText()` and `translateDocument()` which allows text and document translation with
  style rules.

## [1.21.0] - 2025-11-03
### Added
- Added `extraRequestParameters` option to text and document translation methods to pass arbitrary parameters in the request body. This can be used to access beta features or override built-in parameters (such as `target_lang`, `source_lang`, etc.).

## [1.20.0] - 2025-10-08
### Added
- Official support for Node.js versions 20, 22 and 24

### Fixed
- Fixed document minification/deminification to preserve translated content. Previously, when document minification was enabled, the deminify process would use the original minified file instead of the translated version, causing translations to be lost.
- Fixed handling of documents without media files during translation. The library now correctly processes documents that don't contain embedded media.

## [1.19.1] - 2025-09-16
### Changed
- Update form-data lib due to https://github.com/advisories/GHSA-fjxv-7rqg-78g4
- Fixed `targetLang` parameter in `DeepLClient::rephraseText` to be an optional `string` parameter.
- Update brace-expansion lib due to https://github.com/advisories/GHSA-v6h2-p8h4-qcjw
- Update axios lib due to https://github.com/advisories/GHSA-4hjh-wcwx-xvwj

## [1.19.0] - 2025-06-26
### Added
- Add new supported language codes to the translation and glossary language types.

## [1.18.0] - 2025-05-07
### Added
- Include `x-trace-id` response headers in debug logs
- Added support for the /v3 Glossary APIs in the client library while providing backwards
  compatibility for the previous /v2 Glossary endpoints. Please refer to the README for
  usage instructions.

### Fixed
- Upgrade Babel library

## [1.17.3] - 2025-03-11
### Changed
- Upgrade axios lib due to https://github.com/advisories/GHSA-jr5f-v2jv-69x6

## [1.17.2] - 2025-03-06
### Added
- Added option to override translate path

## [1.17.1] - 2025-03-04
### Added
- Update list of supported target languages

### Changed
- Adjust environment variable handling to avoid side effects in the published library

## [1.17.0] - 2025-02-25
### Added
- Added document minification as a feature before document translation, to
  allow translation of large docx or pptx files. For more info check the README.
- Added .env.example file with `dotenv` library for environment variables management
- Improve unit tests

### Changed
- Upgrade cross-spawn library (see https://github.com/advisories/GHSA-3xgq-45jj-v275)

## [1.16.0] - 2025-01-22
### Added
- Added support for the Write API in the client library, the implementation
  can be found in the `DeepLClient` class. Please refer to the README for usage
  instructions.

### Changed
- The main functionality of the library is now also exposed via the `DeepLClient`
  class. Please change your code to use this over the `Translator` class whenever
  convenient.

## [1.15.0] - 2024-11-15
### Added
- Added `modelType` option to `translateText()` to use models with higher
  translation quality (available for some language pairs), or better latency.
  Options are `'quality_optimized'`, `'latency_optimized'`, and  `'prefer_quality_optimized'`
- Added the `modelTypeUsed` field to `translateText()` response, that
  indicates the translation model used when the `modelType` option is
  specified.

## [1.14.0] - 2024-09-17
### Added
- Added `billedCharacters` field to text translation response.

## [1.13.1] - 2024-08-14
### Added
- Added supported glossary languages: Danish (`'da'`), Norwegian (bokmål)
  (`'nb'`), and Swedish (`'sv'`). The corresponding glossary language code
  TypeScript types are extended.

  Note: older library versions also support the new glossary language pairs,
  this update only adds new types.

### Security
- Increase `axios` locked-version due to security
  [vulnerability in axios <1.7.3](https://github.com/advisories/GHSA-8hc4-vh64-cxmj)

## [1.13.0] - 2024-04-12
### Added
- Add possibility to add extra parameters to a translation request (both text and document).
  DeepL engineers use this to test features in the API before they are released. Library users
  who cannot update their DeepL library dependency could use these extra parameters to access
  features in the API that are released in the future.

### Security
- Increase `follow-redirects` locked-version due to security
  [vulnerability in follow-redirects <1.15.5](https://github.com/advisories/GHSA-cxjh-pqwp-8mfp)

## [1.12.0] - 2024-02-27
### Added
- New language available: Arabic (`'ar'`). Add language code constants and tests.
  Arabic is currently supported only for text translation; document translation
  support for Arabic is coming soon.

  Note: older library versions also support the new language, this update only adds new code constants.

## [1.11.1] - 2024-01-26
### Fixed
- Dependencies: Update `follow-redirects` due to security vulnerability

### Security
- Increase `axios` requirement to `^1.6.4` to avoid
  [vulnerability in follow-redirects <1.15.4](https://github.com/advisories/GHSA-jchw-25xp-jwwc)

## [1.11.0] - 2023-11-03
### Added
- Add optional `context` parameter for text translation, that specifies
  additional context to influence translations, that is not translated itself.

### Changed
- Added notice in Readme that starting in 2024 the library will drop support for
  Node versions that are officially end-of-life.
- Keep-Alive is now used by HTTP(S) agent, to reduce latency for subsequent API requests.

### Fixed
- CI: silence npm audit warnings in non-production dependencies due to
  currently-unresolvable [vulnerability in semver <7.5.2](https://github.com/npm/node-semver/pull/564).
- Increase axios dependency to >=1.2.2, due to [bug in axios v1.2.1](https://github.com/axios/axios/issues/5346).
- Added supported glossary languages: Italian (it), Dutch (nl), Polish (pl),
  Portuguese (pt), Russian (ru) and Chinese (zh). The corresponding glossary
  language code TypeScript types are extended.

  Note: older library versions also support the new glossary language pairs,
  this update only adds new types.
- Fixed typo in readme: `createGlossaryWithCsv` not `createGlossaryFromCsv`
  * Issue [#36](https://github.com/DeepLcom/deepl-node/issues/36) thanks to
    [phenomen](https://github.com/phenomen).

## [1.10.2] - 2023-06-02
### Fixed
- Fixed erroneous version bump

## [1.10.1] - 2023-06-02
### Fixed
- Limit example typescript version to 5.0 due to Node 12 incompatibility

## [1.10.0] - 2023-06-01
### Fixed
- Changed document translation to poll the server every 5 seconds. This should greatly reduce observed document translation processing time.
- Fix getUsage request to be a HTTP GET request, not POST.

## [1.9.0] - 2023-03-22
### Added
- Added platform and node version information to the user-agent string that is sent with API calls, along with an opt-out.
- Added method for applications that use this library to identify themselves in API requests they make.

### Fixed
- Fixed proxy example code in README

## [1.8.0] - 2023-01-26
### Added
- New languages available: Korean (`'ko'`) and Norwegian (bokmål) (`'nb'`). Add
  language code constants and tests.

  Note: older library versions also support the new languages, this update only
  adds new code constants.

## [1.7.5] - 2023-01-25
### Fixed
- Also send options in API requests even if they are default values.

## [1.7.4] - 2023-01-09
### Fixed
- Omit undefined `supportsFormality` field for source languages.

## [1.7.3] - 2023-01-04
### Changed
- CI: suppress `npm audit` warnings for dev dependencies, due to CVE in
  `eslint-plugin-import > tsconfig-paths > json5`.

### Fixed
- Support `axios` v1.2.1, that resolves the issue in v1.2.0.

## [1.7.2] - 2022-11-24
### Fixed
- Limit `axios` to v1.1.3 or lower due to an issue in v1.2.0.
  * This is a temporary workaround until the issue is resolved.

## [1.7.1] - 2022-10-12
### Fixed
- Prefer `for .. of` loops to `for .. in` loops, to handle cases where array
  prototype has been modified.
  * Issue [#10](https://github.com/DeepLcom/deepl-node/issues/10) thanks to
    [LorenzoJokhan](https://github.com/LorenzoJokhan)
- Node 18 is supported, this is now explicitly documented.

## [1.7.0] - 2022-09-30
### Added
- Add formality options `'prefer_less'` and `'prefer_more'`.

### Changed
- Requests resulting in `503 Service Unavailable` errors are now retried.
  Attempting to download a document before translation is completed will now
  wait and retry (up to 5 times by default), rather than rejecting.

## [1.6.0] - 2022-09-09
### Added
- New language available: Ukrainian (`'uk'`). Add language code constant and
  tests.

  Note: older library versions also support new languages, this update only
  adds new code constant.

## [1.5.0] - 2022-08-19
### Added
- Add proxy support.

## [1.4.0] - 2022-08-09
### Added
- Add `createGlossaryWithCsv()` allowing glossaries downloaded from website to
  be easily uploaded to API.

## [1.3.2] - 2022-08-09
### Changed
- Update contributing guidelines, we can now accept Pull Requests.

### Fixed
- Fix GitLab CI config.
- Correct language code case in `getSourceLanguages()` and
  `getTargetLanguages()` result.
- Use TypeScript conditional types on `translateText()` to fix TS compiler
  errors.
  * Issue [#9](https://github.com/DeepLcom/deepl-node/issues/9) thanks to
    [Jannis Blossey](https://github.com/jblossey)

## [1.3.1] - 2022-05-18
Replaces version 1.3.0 which was broken due an incorrect package version.

### Added
- New languages available: Indonesian (`'id'`) and Turkish (`'tr'`). Add
  language code constants and tests.

  Note: older library versions also support the new languages, this update only
  adds new code constants.

### Changed
- Change return type of `nonRegionalLanguageCode()` to newly-added type
  `NonRegionalLanguageCode`.

## [1.3.0] - 2022-05-18
Due to an incorrect package version, this version was removed.

## [1.2.2] - 2022-04-20
### Added
- Glossaries are now supported for language pairs: English <-> Japanese and
  French <-> German. The corresponding glossary language code TypeScript types
  are extended.

  Note: older library versions also support the new glossary language pairs,
  this update only adds new types.

## [1.2.1] - 2022-04-14
### Changed
- Simplify and widen the accepted version range for `node` and `@types/node`.

## [1.2.0] - 2022-04-13
### Added
- Add `errorMessage` property to `DocumentStatus`, describing the error in case
  of document translation failure.

## [1.1.1] - 2022-04-12
### Fixed
- Fix some tests that intermittently failed.
- Fix `isDocumentTranslationComplete()` to reject if document translation fails.

## [1.1.0] - 2022-03-22
### Added
- Add support for HTML tag handling.

### Fixed
- Fix spurious test failures.

## [1.0.0] - 2019-02-04
This version of the package on NPM refers to an earlier unofficial DeepL Node.js
client library, which can be found [here](https://github.com/icrotz/deepl). The
official DeepL Node.js client library took over this package name. Thanks to
[Tristan De Oliveira](https://github.com/icrotz) for transferring the package
ownership.

[Unreleased]: https://github.com/DeepL/deepl-node/compare/v1.28.1...HEAD
[1.28.1]: https://github.com/DeepL/deepl-node/compare/v1.28.0...v1.28.1
[1.28.0]: https://github.com/DeepL/deepl-node/compare/v1.27.0...v1.28.0
[1.27.0]: https://github.com/DeepL/deepl-node/compare/v1.26.0...v1.27.0
[1.26.0]: https://github.com/DeepL/deepl-node/compare/v1.25.0...v1.26.0
[1.25.0]: https://github.com/DeepL/deepl-node/compare/v1.24.0...v1.25.0
[1.24.0]: https://github.com/DeepL/deepl-node/compare/v1.23.0...v1.24.0
[1.23.0]: https://github.com/DeepL/deepl-node/compare/v1.22.0...v1.23.0
[1.22.0]: https://github.com/DeepL/deepl-node/compare/v1.21.0...v1.22.0
[1.21.0]: https://github.com/DeepL/deepl-node/compare/v1.20.0...v1.21.0
[1.20.0]: https://github.com/DeepL/deepl-node/compare/v1.19.1...v1.20.0
[1.19.1]: https://github.com/DeepL/deepl-node/compare/v1.19.0...v1.19.1
[1.19.0]: https://github.com/DeepL/deepl-node/compare/v1.18.0...v1.19.0
[1.18.0]: https://github.com/DeepL/deepl-node/compare/v1.17.3...v1.18.0
[1.17.3]: https://github.com/DeepL/deepl-node/compare/v1.17.2...v1.17.3
[1.17.2]: https://github.com/DeepL/deepl-node/compare/v1.17.1...v1.17.2
[1.17.1]: https://github.com/DeepL/deepl-node/compare/v1.17.0...v1.17.1
[1.17.0]: https://github.com/DeepL/deepl-node/compare/v1.16.0...v1.17.0
[1.16.0]: https://github.com/DeepL/deepl-node/compare/v1.15.0...v1.16.0
[1.15.0]: https://github.com/DeepL/deepl-node/compare/v1.14.0...v1.15.0
[1.14.0]: https://github.com/DeepL/deepl-node/compare/v1.13.1...v1.14.0
[1.13.1]: https://github.com/DeepL/deepl-node/compare/v1.13.0...v1.13.1
[1.13.0]: https://github.com/DeepL/deepl-node/compare/v1.12.0...v1.13.0
[1.12.0]: https://github.com/DeepL/deepl-node/compare/v1.11.1...v1.12.0
[1.11.1]: https://github.com/DeepL/deepl-node/compare/v1.11.0...v1.11.1
[1.11.0]: https://github.com/DeepL/deepl-node/compare/v1.10.2...v1.11.0
[1.10.2]: https://github.com/DeepL/deepl-node/compare/v1.10.1...v1.10.2
[1.10.1]: https://github.com/DeepL/deepl-node/compare/v1.10.0...v1.10.1
[1.10.0]: https://github.com/DeepL/deepl-node/compare/v1.9.0...v1.10.0
[1.9.0]: https://github.com/DeepL/deepl-node/compare/v1.8.0...v1.9.0
[1.8.0]: https://github.com/DeepL/deepl-node/compare/v1.7.5...v1.8.0
[1.7.5]: https://github.com/DeepL/deepl-node/compare/v1.7.4...v1.7.5
[1.7.4]: https://github.com/DeepL/deepl-node/compare/v1.7.3...v1.7.4
[1.7.3]: https://github.com/DeepL/deepl-node/compare/v1.7.2...v1.7.3
[1.7.2]: https://github.com/DeepL/deepl-node/compare/v1.7.1...v1.7.2
[1.7.1]: https://github.com/DeepL/deepl-node/compare/v1.7.0...v1.7.1
[1.7.0]: https://github.com/DeepL/deepl-node/compare/v1.6.0...v1.7.0
[1.6.0]: https://github.com/DeepL/deepl-node/compare/v1.5.0...v1.6.0
[1.5.0]: https://github.com/DeepL/deepl-node/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/DeepL/deepl-node/compare/v1.3.2...v1.4.0
[1.3.2]: https://github.com/DeepL/deepl-node/compare/v1.3.1...v1.3.2
[1.3.1]: https://github.com/DeepL/deepl-node/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/DeepL/deepl-node/compare/v1.2.2...v1.3.0
[1.2.2]: https://github.com/DeepL/deepl-node/compare/v1.2.1...v1.2.2
[1.2.1]: https://github.com/DeepL/deepl-node/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/DeepL/deepl-node/compare/v1.1.1...v1.2.0
[1.1.1]: https://github.com/DeepL/deepl-node/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/DeepL/deepl-node/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/DeepL/deepl-node/releases/tag/v1.0.0
