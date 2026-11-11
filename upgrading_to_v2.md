# Upgrading to 2.0.0

deepl-node 2.0.0 removes the deprecated API of the 1.x line, tightens argument validation and
changes some error types, retry rules and request encodings. If you use `deepl.Translator`, the
old document method names, the positional `rephraseText()` arguments, `Usage.anyLimitReached()` or
the style rule object forms, you must change your code. The package now requires Node.js 18 or
later. Upgrade to 1.29.0 first if you want deprecation warnings in your editor, fix them, then
move to 2.0.0.

- [Requirements](#requirements)
- [Quick checklist](#quick-checklist)
- [Client and options](#client-and-options)
- [Text translation](#text-translation)
- [Documents](#documents)
- [Glossaries](#glossaries)
- [Style rules and style profiles](#style-rules-and-style-profiles)
- [Translation memories](#translation-memories)
- [Usage](#usage)
- [Errors, validation and retries](#errors-validation-and-retries)
- [Types and signatures](#types-and-signatures)
- [Internal classes](#internal-classes)

## Requirements

- Node.js 18 or later (`engines.node` was `>=14.17`). The package is compiled to ES2022 and is
  still CommonJS (`main` is `dist/index.js`, `types` is `dist/index.d.ts`).
- `@types/node` is no longer a dependency of the package. TypeScript projects add it to their own
  `devDependencies`.
- `adm-zip` and `form-data` are no longer dependencies. Document upload uses the `FormData` and
  `Blob` globals of Node.js 18 and sends the same multipart fields. No code change is needed.
- The files `dist/translator`, `dist/documentMinifier` and `dist/fsHelper` no longer exist. Import
  from the package root (`deepl-node`) instead, see [Internal classes](#internal-classes).

## Quick checklist

1. Replace `Translator` and `TranslatorOptions` with `DeepLClient` and `DeepLClientOptions`
   ([Client and options](#translator-is-removed)).
2. Rename `extraRequestParameters` to `extraBodyParameters`
   ([Client and options](#extrarequestparameters-is-renamed)).
3. Pass `rephraseText()` options as an object
   ([Text translation](#rephrasetext-takes-an-options-object)).
4. Rename the document methods `uploadDocument()`, `getDocumentStatus()`, `downloadDocument()` and
   `isDocumentTranslationComplete()` ([Documents](#document-method-names)).
5. Rename `Usage.anyLimitReached()` to `anyCharacterLimitReached()`
   ([Usage](#anylimitreached-is-renamed)).
6. Replace `GlossaryNotFoundError` with `NotFoundError`
   ([Glossaries](#glossarynotfounderror-is-removed)).
7. Pass the arguments of `createStyleRule()` and the custom instruction methods separately
   ([Style rules](#object-forms-are-removed)).
8. Rename the `*WithCsv` multilingual glossary methods to `*FromCsv`
   ([Glossaries](#multilingual-glossary-csv-methods)).
9. Do not rely on retries of create requests after a 5xx response
   ([Errors, validation and retries](#create-requests-are-retried-less)).
10. Catch `ArgumentError` where you caught a plain `DeepLError` for invalid arguments
    ([Errors, validation and retries](#invalid-arguments-throw-argumenterror)).

## Client and options

### `Translator` is removed

`DeepLClient` holds every method with the same signatures and behaviour.

```ts
// Before
const client = new deepl.Translator(authKey, options as deepl.TranslatorOptions);
if (client instanceof deepl.Translator) { /* ... */ }

// After
const client = new deepl.DeepLClient(authKey, options as deepl.DeepLClientOptions);
if (client instanceof deepl.DeepLClient) { /* ... */ }
```

### `extraRequestParameters` is renamed

`extraRequestParameters` is removed from `BaseRequestOptions` and every options type. Use
`extraBodyParameters`, which behaves the same.

```ts
// Before
await client.translateText('Hello', null, 'de', { extraRequestParameters: { foo: 'bar' } });

// After
await client.translateText('Hello', null, 'de', { extraBodyParameters: { foo: 'bar' } });
```

### Values of `extraBodyParameters` keep their type

`RequestParameters` is `Record<string, unknown>` (was `Record<string, string>`). Objects typed
`Record<string, string>` still compile. Code that reads values from a `RequestParameters` as
strings needs a cast.

In a JSON body, each value is sent with its JSON type. The API does not convert strings, so a
string for a boolean, number or array field is rejected. Pass the real type:

```ts
// Before
{ extraRequestParameters: { outline_detection: '0' } }

// After
{ extraBodyParameters: { outline_detection: false } }
```

A `null` value is sent as JSON `null` in a JSON body. It used to remove the field. In the form body
of the document upload, `null` still removes the parameter. `undefined` is ignored.

### Request bodies are JSON

`translateText()`, `createGlossary()`, `createMultilingualGlossary()`,
`createMultilingualGlossaryFromCsv()`, `updateMultilingualGlossaryName()`,
`updateMultilingualGlossaryDictionary()`, `updateMultilingualGlossaryDictionaryFromCsv()`,
`rephraseText()` and `correctText()` send JSON instead of form-encoded bodies. Proxies and test
doubles that read these bodies must parse JSON. Document upload stays multipart.

### Constructor checks for `serverUrl` and `proxy`

`DeepLClient` and `DeepLAdminClient` validate their options when constructed:

- `serverUrl` must be an absolute `http` or `https` URL with a host. `'api.deepl.com'` or
  `'ftp://x'` throws `ArgumentError` instead of failing on the first request.
- A `proxy` string must be an `http` or `https` URL with a host. `'socks5://127.0.0.1:1080'` and
  `'proxy.example.com:3128'` throw `ArgumentError`. Before, any parsable string was accepted and
  used as a plain HTTP proxy. Use an `http://` URL or a `ProxyConfig` object.

The error message no longer contains the URL.

## Text translation

### `rephraseText()` takes an options object

The writing style and tone move into `RephraseTextOptions`. There is no fourth argument, and a
non-object third argument throws `ArgumentError`.

```ts
// Before
await client.rephraseText('Hi', 'de', 'business', 'confident');

// After
await client.rephraseText('Hi', 'de', { writingStyle: 'business', tone: 'confident' });
```

### Empty `targetLang` in `rephraseText()` and `correctText()`

`''` now throws `ArgumentError`. Before, the request was sent without a target language. Pass `null`
or omit the argument to keep the language of the input text.

### `SentenceSplittingMode` loses `'on'` and `'default'`

Use `'1'` for splitting on punctuation and newlines. Any other string is still sent as given, so
`'on'` and `'default'` now reach the API unchanged.

```ts
// Before
await client.translateText('Hello. World.', null, 'de', { splitSentences: 'on' });

// After
await client.translateText('Hello. World.', null, 'de', { splitSentences: '1' });
```

### `TranslateTextOptions.__path` is removed

`translateText()` always sends its request to `/v2/translate`.

## Documents

### Document method names

| 1.x                                  | 2.0.0                                  |
|--------------------------------------|----------------------------------------|
| `uploadDocument()`                   | `translateDocumentUpload()`            |
| `getDocumentStatus()`                | `translateDocumentGetStatus()`         |
| `downloadDocument()`                 | `translateDocumentDownload()`          |
| `isDocumentTranslationComplete(h)`   | `translateDocumentWaitUntilDone(h)`    |

The first three take the same arguments. `isDocumentTranslationComplete()` resolved
`{ handle, status }`. `translateDocumentWaitUntilDone()` resolves the `DocumentStatus`.

```ts
// Before
const { status } = await client.isDocumentTranslationComplete(handle);

// After
const status = await client.translateDocumentWaitUntilDone(handle);
```

### Document minification is removed

Remove `enableDocumentMinification` from `DocumentTranslateOptions`. `DocumentMinificationError`
and `DocumentDeminificationError` no longer exist. The API accepts larger documents, see the usage
limits.

### Errors of `translateDocument()` and `translateDocumentUpload()`

- A missing input file throws `ArgumentError` before any request. It was a
  `DocumentTranslationError`, or the Node error for `translateDocumentUpload()`.
- An existing output file or a missing or unwritable output directory throws
  `DocumentTranslationError` from `translateDocument()`. The Node error is in `error`. It used to
  be the Node error itself.

```ts
// Before
try { await client.translateDocument(input, output, null, 'de'); }
catch (e) { if ((e as NodeJS.ErrnoException).code === 'EEXIST') { /* ... */ } }

// After
try { await client.translateDocument(input, output, null, 'de'); }
catch (e) {
    if (e instanceof deepl.DocumentTranslationError &&
        (e.error as NodeJS.ErrnoException | undefined)?.code === 'EEXIST') { /* ... */ }
}
```

### HTTP 503 on document status

`translateDocumentGetStatus()` and `translateDocumentWaitUntilDone()` throw a plain `DeepLError` for
HTTP 503. Only `translateDocumentDownload()` throws `DocumentNotReadyError`. Check
`httpStatusCode === 503` or `shouldRetry`.

## Glossaries

### `GlossaryNotFoundError` is removed

Glossary requests that answer HTTP 404, and `getMultilingualGlossaryDictionaryEntries()` for a
missing dictionary, throw `NotFoundError`, which `GlossaryNotFoundError` extended.

```ts
// Before
if (e instanceof deepl.GlossaryNotFoundError) { /* ... */ }

// After
if (e instanceof deepl.NotFoundError) { /* ... */ }
```

### Multilingual glossary CSV methods

The `*WithCsv` multilingual glossary methods become `*FromCsv` with the same arguments. The
monolingual `createGlossaryWithCsv()` keeps its name.

| 1.x                                              | 2.0.0                                              |
|--------------------------------------------------|----------------------------------------------------|
| `createMultilingualGlossaryWithCsv()`            | `createMultilingualGlossaryFromCsv()`              |
| `replaceMultilingualGlossaryDictionaryWithCsv()` | `replaceMultilingualGlossaryDictionaryFromCsv()`   |
| `updateMultilingualGlossaryDictionaryWithCsv()`  | `updateMultilingualGlossaryDictionaryFromCsv()`    |

### Missing IDs and empty dictionaries throw before the request

The multilingual glossary methods that take a glossary throw `ArgumentError` for an empty ID or a
`MultilingualGlossaryInfo` without one. Before, they requested `/v3/glossaries/undefined`.
`createMultilingualGlossary()` throws for an empty dictionary list, and it and the replace and
update methods throw for a dictionary without entries. `deleteMultilingualGlossary()` throws
`ArgumentError` for an empty or missing ID (was a plain `Error`, or `TypeError` for `null`).

## Style rules and style profiles

### Object forms are removed

`createStyleRule()`, `createStyleRuleCustomInstruction()` and `updateStyleRuleCustomInstruction()`
take positional arguments. The object forms and the `CreateStyleRuleRequestBody` type are removed.

```ts
// Before
await client.createStyleRule({ name: 'Rule', language: 'en' });
await client.createStyleRuleCustomInstruction(rule, { label: 'L', prompt: 'P' });
await client.updateStyleRuleCustomInstruction(rule, id, { label: 'L', prompt: 'P' });

// After
await client.createStyleRule('Rule', 'en', configuredRules, customInstructions);
await client.createStyleRuleCustomInstruction(rule, 'L', 'P', sourceLanguage);
await client.updateStyleRuleCustomInstruction(rule, id, 'L', 'P', sourceLanguage);
```

### `configuredRules` has the API's keys

`StyleRuleInfo.configuredRules` is the `configured_rules` map as the API returns it
(`Record<string, Record<string, string>>`). Categories the library did not know are no longer
dropped. The `ConfiguredRules` type is removed.

```ts
// Before
const dates = rule.configuredRules?.datesAndTimes;
const tone = rule.configuredRules?.styleAndTone;

// After
const dates = rule.configuredRules?.dates_and_times;
const tone = rule.configuredRules?.style_and_tone;
```

### Style profiles send translation memory IDs as given

`createStyleProfile()` and `updateStyleProfile()` no longer throw `ArgumentError` for an empty
translation memory ID. The API rejects it with a `DeepLError`, as for `glossaryIds` and
`styleRuleIds`.

### `CustomInstruction.id` is required

`CustomInstruction.id` is `string` (was `string | undefined`). Objects you build yourself must set
it.

## Translation memories

### `isTranslationMemoryJobComplete()` is removed

Use `waitUntilTranslationMemoryJobDone()` with the same arguments.

```ts
// Before
await client.isTranslationMemoryJobComplete(job, 60_000);

// After
await client.waitUntilTranslationMemoryJobDone(job, 60_000);
```

### The `'downloaded'` job status is removed

`TranslationMemoryJobStatus` no longer has `'downloaded'`. Only `'completed'` counts as done in
`done()` and `waitUntilTranslationMemoryJobDone()`.

### File helpers throw `TranslationMemoryJobError`

- `importTranslationMemoryFromFilepath()` throws `ArgumentError` for a missing input file (was the
  Node error `ENOENT`) and `TranslationMemoryJobError` for every other failure.
- `exportTranslationMemoryToFilepath()` throws `TranslationMemoryJobError` for every failure,
  including an existing output file and local write failures.

The cause is in `error`, next to `jobId` and `job`. `httpStatusCode` and `shouldRetry` are copied
from a `DeepLError` cause. `downloadTranslationMemoryExport()` still throws the Node error for
output file problems.

```ts
// Before
try { await client.exportTranslationMemoryToFilepath(tm, 'tm.tmx'); }
catch (e) { if ((e as NodeJS.ErrnoException).code === 'EEXIST') { /* ... */ } }

// After
try { await client.exportTranslationMemoryToFilepath(tm, 'tm.tmx'); }
catch (e) {
    if (e instanceof deepl.TranslationMemoryJobError &&
        (e.error as NodeJS.ErrnoException | undefined)?.code === 'EEXIST') { /* ... */ }
}
```

### Errors of `downloadTranslationMemoryExport()`

An error response from the pre-signed download URL throws a plain `DeepLError` with
`httpStatusCode`. It used to map to `AuthorizationError`, `NotFoundError`, `QuotaExceededError` or
`DocumentNotReadyError`. A job without a download URL throws `DeepLError` (was `ArgumentError`).

### Export request has no `Content-Type`

`createTranslationMemoryExport()` and `exportTranslationMemoryToFilepath()` send no `Content-Type`
header, as the request has no body. It was `application/x-www-form-urlencoded`.

## Usage

### `anyLimitReached()` is renamed

`Usage.anyLimitReached()` is replaced by `anyCharacterLimitReached()`. It returns true if the
account character limit (`character`) or the API key character limit (`apiKeyCharacter`) is
reached. Speech minutes are not included. For the old account-only meaning, check
`usage.character?.limitReached()`.

```ts
// Before
if (usage.anyLimitReached()) { /* ... */ }

// After
if (usage.anyCharacterLimitReached()) { /* ... */ }
```

### `Usage.document` and `Usage.teamDocument` are removed

The API no longer returns document usage. A response that still contains `document_*` fields
parses, and the fields are ignored.

## Errors, validation and retries

### Create requests are retried less

Methods that create a resource are retried only when the request was not sent: HTTP 429, DNS
failures, refused connections, unreachable hosts or networks and connect timeouts. A 5xx response
or a reset connection is no longer retried, and `shouldRetry` is false for a 5xx, because the API
may have created the resource. Affected methods: `translateDocument()`,
`translateDocumentUpload()`, all glossary, spoken terms, style rule, custom instruction and style
profile creates, `createTranslationMemoryImport()`, `createTranslationMemoryExport()` and the
translation memory file helpers. Check whether the resource exists before creating it again.

### Cut-off response bodies

A response body cut off mid-read throws a `ConnectionError` with `shouldRetry` true and is retried,
except for the creates above. Before, `shouldRetry` was false and it was never retried.

### Invalid arguments throw `ArgumentError`

Argument checks throw `ArgumentError`, a subclass of `DeepLError`, instead of a plain `DeepLError`.
This covers an empty auth key; empty texts or language codes; `glossary` together with
`glossaryIds`; more than 5 `glossaryIds`; a missing glossary, style rule, style profile or
translation memory ID; a bad `translationMemoryThreshold`; a document glossary without `sourceLang`;
a non-path document input without `filename`; an empty glossary name or entries; an empty or
control-character glossary or spoken term; and an empty translation memory ID.

```ts
// Before
if (e instanceof deepl.DeepLError && e.constructor === deepl.DeepLError) { /* bad input */ }

// After
if (e instanceof deepl.ArgumentError) { /* invalid input */ }
```

`instanceof DeepLError` checks keep working. The `GlossaryEntries` constructor and `add()` still
throw a plain `DeepLError` for malformed TSV and duplicate source terms; `toTsv()` and
`validateGlossaryTerm()` throw `ArgumentError` for invalid terms.

### Cancelling requests

Every request method of `DeepLClient` and `DeepLAdminClient` accepts `signal?: AbortSignal`. The
promise rejects with the abort reason, not a `DeepLError`. Code that assumes every rejection is a
`DeepLError` must check `signal.aborted` first when it passes a signal. See the README.

## Types and signatures

- `DocumentStatus.documentId` is `string` (was `string | undefined`). It falls back to the ID of the
  handle. Remove `undefined` checks.
- `DocumentStatus.status` and `TranslationMemoryJobResult.status` are typed
  `<known statuses> | (string & {})`. An exhaustive `switch` needs a `default` branch.
- `TranslationMemoryJob.creationTime`, `updatedTime`, `done()` and `ok()` are required. Objects you
  build yourself must set them. `job.done?.()` becomes `job.done()`.
- `CustomInstruction.id` is required, see [Style rules](#custominstructionid-is-required).
- `RequestParameters` is `Record<string, unknown>`, see
  [Client and options](#values-of-extrabodyparameters-keep-their-type).
- `ConfiguredRules` and `CreateStyleRuleRequestBody` are removed.
- `checkStatusCode()` and these internal response types are no longer exported from the package
  root: `MultilingualGlossaryDictionaryEntriesApiResponse`,
  `MultilingualGlossaryDictionaryApiResponse`, `ListMultilingualGlossaryApiResponse`,
  `StyleRuleInfoApiResponse`, `ListStyleRuleApiResponse`, `TranslationMemoryInfoApiResponse`,
  `ListTranslationMemoryApiResponse`, `TranslationMemorySegmentsApiResponse`,
  `TranslationMemoryImportApiResponse`, `TranslationMemoryExportApiResponse`,
  `TranslationMemoryJobApiResponse` and `LanguageResourceApiResponse`. Use the types the methods
  return (`MultilingualGlossaryInfo`, `StyleRuleInfo`, `TranslationMemoryInfo`,
  `TranslationMemoryJob`, `LanguageResource`, ...).

## Internal classes

These were public by accident and are gone or changed:

- `dist/translator`, `dist/documentMinifier` and `dist/fsHelper` no longer exist, so deep imports
  such as `deepl-node/dist/translator` fail. Import from `deepl-node`.
- `checkStatusCode()` is not exported from the package root and has no replacement.
- The `*ApiResponse` types listed under [Types and signatures](#types-and-signatures) are not
  exported.
- `DocumentMinificationError` and `DocumentDeminificationError` are removed with document
  minification.
