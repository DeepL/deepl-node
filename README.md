# deepl-node

[![Version](https://img.shields.io/npm/v/deepl-node.svg)](https://www.npmjs.org/package/deepl-node)
[![Minimum node.js version](https://img.shields.io/node/v/deepl-node.svg)](https://npmjs.com/package/deepl-node)
[![License: MIT](https://img.shields.io/badge/license-MIT-blueviolet.svg)](https://github.com/DeepLcom/deepl-node/blob/main/LICENSE)

Official Node.js Client Library for the DeepL API.

The [DeepL API][api-docs] is a language translation API that allows other
computer programs to send texts and documents to DeepL's servers and receive
high-quality translations. This opens a whole universe of opportunities for
developers: any translation product you can imagine can now be built on top of
DeepL's best-in-class translation technology.

The DeepL Node.js library offers a convenient way for applications written for
Node.js to interact with the DeepL API. We intend to support all API functions
with the library, though support for new features may be added to the library
after they're added to the API.

## Getting an authentication key

To use the package, you'll need an API authentication key. To get a key,
[please create an account here][create-account]. With a DeepL API Free account
you can translate up to 500,000 characters/month for free.

## Installation

`npm install deepl-node`

### Requirements

The package officially supports Node.js version 12, 14, 16, 17, 18, 20, 22 and 24.

We strongly recommend upgrading to a supported Node.js version as we will be dropping support for end-of-life versions in 2025. You can find the Node versions and support timelines [here][node-version-list].

## Usage

Import the package and construct a `DeepLClient`. The first argument is a string
containing your API authentication key as found in your
[DeepL Pro Account][pro-account].

Be careful not to expose your key, for example when sharing source code.

An example using `async`/`await` and ES Modules:

```javascript
import * as deepl from 'deepl-node';

const authKey = "f63c02c5-f056-..."; // Replace with your key
const deeplClient = new deepl.DeepLClient(authKey);

(async () => {
    const result = await deeplClient.translateText('Hello, world!', null, 'fr');
    console.log(result.text); // Bonjour, le monde !
})();
```

This example is for demonstration purposes only. In production code, the
authentication key should not be hard-coded, but instead fetched from a
configuration file or environment variable.

If you are using CommonJS, you should instead require the package:

```javascript
const deepl = require('deepl-node');
const deeplClient = new deepl.DeepLClient(authKey);
```

`DeepLClient` accepts options as the second argument, see
[Configuration](#configuration) for more information.

All `DeepLClient` functions return promises, and for brevity the examples in this
file use `await` and `try`/`catch` blocks, however Promise-chaining is also
possible:

```javascript
deeplClient
    .translateText('Hello, world!', null, 'fr')
    .then((result) => {
        console.log(result.text); // Bonjour, le monde !
    })
    .catch((error) => {
        console.error(error);
    });
```

The package also supports TypeScript:

```typescript
import * as deepl from 'deepl-node';

(async () => {
    const targetLang: deepl.TargetLanguageCode = 'fr';
    const results = await deeplClient.translateText(
        ['Hello, world!', 'How are you?'],
        null,
        targetLang,
    );
    results.map((result: deepl.TextResult) => {
        console.log(result.text); // Bonjour, le monde !
    });
})();
```

### Translating text

To translate text, call `translateText()`. The first argument is a string
containing the text you want to translate, or an array of strings if you want to
translate multiple texts.

The second and third arguments are the source and target language codes.
Language codes are **case-insensitive** strings according to ISO 639-1, for
example `'de'`, `'fr'`, `'ja''`. Some target languages also include the regional
variant according to ISO 3166-1, for example `'en-US'`, or `'pt-BR'`. The source
language also accepts `null`, to enable auto-detection of the source language.

The last argument to `translateText()` is optional, and specifies extra
translation options, see [Text translation options](#text-translation-options)
below.

`translateText()` returns a Promise that fulfills with a `TextResult`, or an
array of `TextResult`s corresponding to your input text(s). `TextResult` has the
following properties:
- `text` is the translated text,
- `detectedSourceLang` is the detected source language code,
- `billedCharacters` is the number of characters billed for the text.
- `modelTypeUsed` indicates the translation model used, but is `undefined`
  unless the `modelType` option is specified.

```javascript
// Translate text into a target language, in this case, French:
const translationResult = await deeplClient.translateText('Hello, world!', 'en', 'fr');
console.log(translationResult.text); // 'Bonjour, le monde !'

// Translate multiple texts into British English:
const translations = await deeplClient.translateText(
    ['お元気ですか？', '¿Cómo estás?'],
    null,
    'en-GB',
);
console.log(translations[0].text); // 'How are you?'
console.log(translations[0].detectedSourceLang); // 'ja'
console.log(translations[0].billedCharacters); // 7 - the number of characters in the source text "お元気ですか？"
console.log(translations[1].text); // 'How are you?'
console.log(translations[1].detectedSourceLang); // 'es'
console.log(translations[1].billedCharacters); // 12 - the number of characters in the source text "¿Cómo estás?"

// Translate into German with less and more Formality:
console.log(await deeplClient.translateText('How are you?', null, 'de', { formality: 'less' })); // 'Wie geht es dir?'
console.log(await deeplClient.translateText('How are you?', null, 'de', { formality: 'more' })); // 'Wie geht es Ihnen?'
```

#### Text translation options

-   `splitSentences`: specify how input text should be split into sentences,
    default: `'on'`.
    -   `'on'`: input text will be split into sentences using both newlines and
        punctuation.
    -   `'off'`: input text will not be split into sentences. Use this for
        applications where each input text contains only one sentence.
    -   `'nonewlines'`: input text will be split into sentences using punctuation
        but not newlines.
-   `preserveFormatting`: controls automatic-formatting-correction. Set to `true`
    to prevent automatic-correction of formatting, default: `false`.
-   `formality`: controls whether translations should lean toward informal or
    formal language. This option is only available for some target languages, see
    [Listing available languages](#listing-available-languages). Use the
    `prefer_*` options to apply formality if it is available for the target  
    language, or otherwise fallback to the default.
    - `'less'`: use informal language.
    - `'more'`: use formal, more polite language.
    - `'default'`: use default formality.
    - `'prefer_less'`: use informal language if available, otherwise default.
    - `'prefer_more'`: use formal, more polite language if available, otherwise default.
-   `glossary`: specifies a glossary to use with translation, either as a string
    containing the glossary ID, or a `MultilingualGlossaryInfo`/`GlossaryInfo` as returned by
    `getMultilingualGlossary()`/`getGlossary()`.
-   `glossaryIds`: specifies up to 5 glossaries to use with translation, as an array of
    glossary ID strings, `MultilingualGlossaryInfo`, or `GlossaryInfo` objects. Glossaries are
    applied in the order given, with the first matching term taking precedence. Requires
    `sourceLang` to be set, and cannot be combined with the singular `glossary` option.
-   `styleRule`: specifies a style rule to use with translation, either as a string
    containing the style rule ID, or a `StyleRuleInfo` as returned by `getAllStyleRules()`.
-   `translationMemory`: specifies a translation memory to use with translation,
    either as a string containing the translation memory ID, or a
    `TranslationMemoryInfo` as returned by `listTranslationMemories()`.
-   `translationMemoryThreshold`: a number from 0 to 100 that specifies the
    minimum matching percentage for translation memory matches. We recommend
    a minimum threshold of 75%.
-   `context`: specifies additional context to influence translations, that is not
    translated itself. Characters in the `context` parameter are not counted toward billing.
    See the [API documentation][api-docs-context-param] for more information and
    example usage.
-   `customInstructions`: an array of instructions to customize the translation behavior.
    Up to 10 custom instructions can be specified, each with a maximum of 300 characters.
    Important: The target language must be `de`, `en`, `es`, `fr`, `it`, `ja`, `ko`, `zh`
    or any variants of these languages.
    Note: Any request with the `customInstructions` parameter enabled will use 
    the `quality_optimized` model type as the default. Requests combining 
    `customInstructions` and `modelType: latency_optimized` will be rejected.
-   `modelType`: specifies the type of translation model to use, options are:
    - `'quality_optimized'`: use a translation model that maximizes translation
      quality, at the cost of response time. This option may be unavailable for
      some language pairs.
    - `'prefer_quality_optimized'`: use the highest-quality translation model 
      for the given language pair.
    - `'latency_optimized'`: use a translation model that minimizes response
      time, at the cost of translation quality.
-   `tagHandling`: type of tags to parse before translation, options are `'html'`
    and `'xml'`.
-   `tagHandlingVersion`: specifies which version of the tag handling algorithm to use.
    Options are `v1` and `v2`.

The following options are only used if `tagHandling` is `'xml'`:

-   `outlineDetection`: specify `false` to disable automatic tag detection,
    default is `true`.
-   `splittingTags`: list of XML tags that should be used to split text into
    sentences. Tags may be specified as an array of strings (`['tag1', 'tag2']`),
    or a comma-separated list of strings (`'tag1,tag2'`). The default is an empty
    list.
-   `nonSplittingTags`: list of XML tags that should not be used to split text
    into sentences. Format and default are the same as for `splittingTags`.
-   `ignoreTags`: list of XML tags that containing content that should not be
    translated. Format and default are the same as for `splittingTags`.
-   `extraRequestParameters`: Extra body parameters to be passed along with the
    HTTP request. Only string values are permitted.
    For example: `{'param': 'value', 'param2': 'value2'}`
    Note: Extra request parameters can override parameters explicitly set by the library
    (such as `target_lang`, `source_lang`, etc.). This is primarily useful for testing or
    accessing beta features.


### Translating documents

To translate documents, call `translateDocument()`. The first and second
arguments are the input and output files. These arguments accept strings
containing file paths, or Streams or FileHandles opened for reading/writing. The
input file may also be given as a Buffer containing the file data. Note that if
the input file is not given as a file path, then the `filename` option is
required.

The third and fourth arguments are the source and target language codes, and
they work exactly the same as when translating text with `translateText()`.

The last argument to `translateDocument()` is optional, and specifies extra
translation options, see
[Document translation options](#document-translation-options) below.

```javascript
// Translate a formal document from English to German:
try {
    await deeplClient.translateDocument(
        'Instruction Manual.docx',
        'Bedienungsanleitung.docx',
        'en',
        'de',
        { formality: 'more' },
    );
} catch (error) {
    // If the error occurs after the document was already uploaded,
    // documentHandle will contain the document ID and key
    if (error.documentHandle) {
        const handle = error.documentHandle;
        console.log(`Document ID: ${handle.documentId}, ` + `Document key: ${handle.documentKey}`);
    } else {
        console.log(`Error occurred during document upload: ${error}`);
    }
}
```

`translateDocument()` wraps multiple API calls: uploading, polling status until
the translation is complete, and downloading. If your application needs to
execute these steps individually, you can instead use the following functions
directly:

-   `uploadDocument()`,
-   `getDocumentStatus()` (or `isDocumentTranslationComplete()`), and
-   `downloadDocument()`

#### Document translation options

-   `formality`: same as in [Text translation options](#text-translation-options).
-   `glossary`: same as in [Text translation options](#text-translation-options).
-   `glossaryIds`: same as in [Text translation options](#text-translation-options).
-   `styleRule`: same as in [Text translation options](#text-translation-options).
-   `translationMemory`: same as in [Text translation options](#text-translation-options).
-   `translationMemoryThreshold`: same as in [Text translation options](#text-translation-options).
-   `filename`: if the input file is not provided as file path, this option is
    needed to specify the file extension.
-   `extraRequestParameters`: same as in [Text translation options](#text-translation-options).
-   `enableDocumentMinification`: A `bool` value. If set to `true`, the library will try to minify a document 
before translating it through the API, sending a smaller document if the file contains a lot of media. This is 
currently only supported for `pptx` and `docx` files. See also [Document minification](#document-minification). 

#### Document minification
In some contexts, one can end up with large document files (e.g. PowerPoint presentations
or Word files with many contributors, especially in a larger organization). However, the
DeepL API enforces a limit of 30 MB for most of these files (see Usage Limits in the docs).
In the case that most of this size comes from media included in the documents (e.g. images,
videos, animations), document minification can help.
In this case, the library will create a temporary directory to extract the document into,
replace the large media with tiny placeholders, create a minified document, translate that
via the API, and re-insert the original media into the original file. Please note that this
requires a bit of additional (temporary) disk space, we recommend at least 2x the file size
of the document to be translated.

To use document minification, simply pass the option to the `translateDocument()` function:
```typescript
await deeplClient.translateDocument(
    inFile, outFile, "en", "de", { enableDocumentMinification: true }
);
```
In order to use document minification with the lower-level `uploadDocument()`,
`isDocumentTranslationComplete()` and `downloadDocument()` methods as well as other details,
see the `DocumentMinifier` class.


Currently supported document types for minification:
1. `pptx`
2. `docx`

Currently supported media types for minification:
1. `png`
2. `jpg`
3. `jpeg`
4. `emf`
5. `bmp`
6. `tiff`
7. `wdp`
8. `svg`
9. `gif`
10. `mp4`
11. `asf`
12. `avi`
13. `m4v`
14. `mpg`
15. `mpeg`
16. `wmv`
17. `mov`
18. `aiff`
19. `au`
20. `mid`
21. `midi`
22. `mp3`
23. `m4a`
24. `wav`
25. `wma`


### Glossaries

Glossaries allow you to customize your translations using defined terms.
Multiple glossaries can be stored with your account, each with a user-specified
name and a uniquely-assigned ID.

#### v2 versus v3 glossary APIs

The newest version of the glossary APIs are the `/v3` endpoints, allowing both
editing functionality plus support for multilingual glossaries. New methods and
objects have been created to support interacting with these new glossaries. 
Due to this  new functionality, users are recommended to utilize these 
multilingual glossary methods. However, to continue using the `v2` glossary API 
endpoints, please continue to use the existing endpoints in the `translator.ts` 
(e.g. `createGlossary()`, `getGlossary()`, etc).

To migrate to use the new multilingual glossary methods from the current 
monolingual glossary methods, please refer to 
[this migration guide](upgrading_to_multilingual_glossaries.md).

The following sections describe how to interact with multilingual glossaries 
using the new functionality:

You can create a multi-lingual glossary with your desired terms and name using
`createMultilingualGlossary()`. Glossaries created via the /v3 endpoints can now 
support multiple source-target language pairs. Note: Glossaries are only 
supported for some language pairs, check the
[DeepL API documentation][api-docs] for more information.

```javascript
// Create a glossary with an English to German dictionary containing two terms:
const entries = new deepl.GlossaryEntries({ entries: { artist: 'Maler', prize: 'Gewinn' } });
const glossaryEnToDe = await deeplClient.createMultilingualGlossary('My glossary', [{sourceLangCode: 'en', targetLangCode: 'de', entries: entries}]);
```

You can also upload a glossary downloaded from the DeepL website using
`createGlossaryWithCsv()`. Instead of supplying the entries as a dictionary,
provide the CSV content as a string.

```javascript
const fs = require('fs').promises;
const filePath = '/path/to/glossary_file.csv';
let csvContent = '';
try {
    csvContent = await fs.readFile(filePath, 'utf-8');
} catch (error) {
    console.error(`Error reading file at ${filePath}:`, error);
    throw error;
}
const csvContent = await readCsvFile(filePath);
const glossaryEnToDe = await deeplClient.createMultilingualGlossaryWithCsv('My glossary', 'en', 'de', csvContent);
```

The [API documentation][api-docs-csv-format] explains the expected CSV format in
detail.

Functions to get, list, and delete stored glossaries are also provided.

```javascript
// Find details about the glossary named 'My glossary'
const glossaries = await deeplClient.listMultilingualGlossaries();
const glossary = glossaries.find((glossary) => glossary.name == 'My glossary');
console.log(`Glossary ID: ${glossary.glossaryId}`);
for (const glossaryDict of glossary.dictionaries) {
    console.log(`Contains dictionary, source: ${glossaryDict.sourceLang}, target: ${glossaryDict.targetLang}, with ${glossaryDict.entryCount} entries.`;)
}
```

To use a glossary when translating text and documents, include the ID
(or `MultilingualGlossaryInfo` object returned by `listMultilingualGlossaries()` or `createMultilingualGlossary()`) in
the function call. The source and target languages must match the glossary.

```javascript
const resultWithGlossary = await deeplClient.translateText(
    'The artist was awarded a prize.',
    'en',
    'de',
    { glossary },
);
console.log(resultWithGlossary.text); // 'Der Maler wurde mit einem Gewinn ausgezeichnet.'
// Without using a glossary would give:  'Der Künstler wurde mit einem Preis ausgezeichnet.'
```

#### Getting, listing, and deleting stored glossaries

Functions to get, list, and delete stored glossaries are also provided:

- `getMultilingualGlossary()` takes a glossary ID and returns a 
  `Promise<MultilingualGlossaryInfo>` object for a stored glossary, or raises an
  exception if no such glossary is found.
- `listMultilingualGlossaries()` returns a promise of a list of `MultilingualGlossaryInfo` objects
  corresponding to all of your stored glossaries.
- `deleteMultilingualGlossary()` takes a glossary ID or `MultilingualGlossaryInfo` 
  object and deletes the stored glossary from the server, or raises an 
  exception if no such glossary is found.
- `deleteMultilingualGlossaryDictionary()` takes a glossary ID or `GlossaryInfo` object to 
  identify the glossary. Additionally takes in a source and target language or a 
  `MultilingualGlossaryDictionaryInfo` object and deletes the stored dictionary
   from the server, or raises an exception if no such glossary dictionary is found.

```javascript
const glossaryDicts = [{sourceLangCode: 'en', targetLangCode: 'de', entries: new deepl.GlossaryEntries({ entries: {'hello': 'hallo'}})}, {sourceLangCode: 'de', targetLangCode: 'en', entries: new deepl.GlossaryEntries({ entries: {'hallo': 'hello'}})}];
const createdGlossary = await deeplClient.createMultilingualGlossary('My Glossary', glossaryDicts);
const glossaries = await deeplClient.listMultilingualGlossaries();

// Delete a dictionary in a glossary
await deeplClient.deleteMultilingualGlossaryDictionary(createdGlossary, 'de', 'en');

// Delete a glossary by name
for (const glossary of glossaries) {
  if (glossary.name === "Old glossary") {
    await deeplClient.deleteMultilingualGlossary(glossary);
  }
}
```

#### Listing entries in a stored glossary

The `MultilingualGlossaryInfo` object does not contain the glossary entries, but
instead only the number of entries in the `entryCount` property.

To list the entries contained within a stored glossary, use
`getMultilingualGlossaryEntries()` providing either the `MultilingualGlossaryInfo` object or glossary
ID and the source and target language pair:

```javascript
const entriesObj = await deeplClient.getMultilingualGlossaryDictionaryEntries(createdGlossary, 'en', 'de');
console.log(entriesObj.entries.toTsv()); // 'hello\thallo'
```

#### Editing a glossary

Functions to edit stored glossaries are also provided:

- `updateMultilingualGlossaryDictionary()` takes a glossary ID or `MultilingualGlossaryInfo`
  object, plus a source language, target language, and a dictionary of entries.
  It will then either update the list of entries for that dictionary (either
  inserting new entries or replacing the target phrase for any existing
  entries) or will insert a new glossary dictionary if that language pair is
  not currently in the stored glossary.
- `replaceMultilingualGlossaryDictionary()` takes a glossary ID or `MultilingualGlossaryInfo`
  object, plus a source language, target language, and a dictionary of entries.
  It will then either set the entries to the parameter value, completely
  replacing any pre-existing entries for that language pair.
- `updateMultilingualGlossaryName()` takes a glossary ID or `MultilingualGlossaryInfo`
  object, plus the new name of the glossary.

```javascript
const glossaryDicts = [{sourceLangCode: 'en', targetLangCode: 'de', entries: new deepl.GlossaryEntries({ entries: {"artist": "Maler", "hello": "guten tag"} })}];
const myGlossary = await deeplClient.createMultilingualGlossary('My Glossary', glossaryDicts);
const newDict = {sourceLangCode: 'en', targetLangCode: 'de', entries: new deepl.GlossaryEntries({ entries: {"hello": "hallo", "prize": "Gewinn"} })};
const updatedGlossary = await deeplClient.updateMultilingualGlossaryDictionary(myGlossary, newDict);

const entriesObj = await deeplClient.getMultilingualGlossaryDictionaryEntries(createdGlossary, 'en', 'de');
console.log(entriesObj.entries.toTsv()); // {'artist': 'Maler', 'hello': 'hallo', 'prize': 'Gewinn'}
```

For examples for the other methods please see [this migration guide](upgrade_to_multilingual_glossaries.md)

### Style Rules

Style rules allow you to customize your translations using a managed, shared list
of rules for style, formatting, and more. Multiple style rules can be stored with 
your account, each with a user-specified name and a uniquely-assigned ID.

#### Creating a style rule

Use `createStyleRule()` to create a new style rule with a name and language
code. You can optionally provide `configuredRules` and `customInstructions`.

```javascript
const rule = await deeplClient.createStyleRule('My Style Rule', 'en');
console.log(`Created: ${rule.name} (${rule.styleId})`);
```

#### Retrieving and listing style rules

Use `getStyleRule()` to retrieve a single style rule by ID, or
`getAllStyleRules()` to list all style rules.

`getAllStyleRules()` returns a list of `StyleRuleInfo` objects
corresponding to all of your stored style rules. The method accepts optional
parameters: `page` (page number for pagination, 0-indexed), `pageSize` (number
of items per page), and `detailed`. When `true`, the response includes
`configuredRules` and `customInstructions` for each style rule. When `false`
(default), these fields are omitted for faster responses.

```javascript
// Get a single style rule by ID
const rule = await deeplClient.getStyleRule('YOUR_STYLE_ID');
console.log(`${rule.name} (${rule.language})`);

// List all style rules
const styleRules = await deeplClient.getAllStyleRules();
for (const r of styleRules) {
    console.log(`${r.name} (${r.styleId})`);
}

// List with detailed configuration
const detailed = await deeplClient.getAllStyleRules(undefined, undefined, true);
for (const r of detailed) {
    if (r.configuredRules) {
        console.log(`  Number formatting: ${JSON.stringify(r.configuredRules.numbers)}`);
    }
}
```

#### Updating a style rule

Use `updateStyleRuleName()` to rename a style rule, and
`updateStyleRuleConfiguredRules()` to update its configured rules.

```javascript
// Update the name
const updated = await deeplClient.updateStyleRuleName('YOUR_STYLE_ID', 'New Name');

// Update configured rules
const updatedRules = await deeplClient.updateStyleRuleConfiguredRules(
    'YOUR_STYLE_ID',
    { style_and_tone: { formality: 'formal' } },
);
```

#### Managing custom instructions

Custom instructions allow you to add free-text prompts to a style rule. Use
`createStyleRuleCustomInstruction()`, `getStyleRuleCustomInstruction()`,
`updateStyleRuleCustomInstruction()`, and
`deleteStyleRuleCustomInstruction()` to manage them.

```javascript
// Create a custom instruction
const instruction = await deeplClient.createStyleRuleCustomInstruction(
    'YOUR_STYLE_ID', 'Formal tone', 'Always use formal language');
console.log(`Created instruction: ${instruction.id}`);

// Get a custom instruction
const fetched = await deeplClient.getStyleRuleCustomInstruction(
    'YOUR_STYLE_ID', instruction.id);

// Update a custom instruction
const updated = await deeplClient.updateStyleRuleCustomInstruction(
    'YOUR_STYLE_ID', instruction.id, 'Updated label', 'Use very formal language');

// Delete a custom instruction
await deeplClient.deleteStyleRuleCustomInstruction(
    'YOUR_STYLE_ID', instruction.id);
```

#### Deleting a style rule

Use `deleteStyleRule()` to delete a style rule by ID.

```javascript
await deeplClient.deleteStyleRule('YOUR_STYLE_ID');
```

### Translation Memories

Translation memories store and reuse previously created translations, helping to
maintain consistency and reduce translation costs by leveraging past work.

#### Listing translation memories

Use `listTranslationMemories()` to list available translation memories
associated with your account.

```javascript
const translationMemories = await deeplClient.listTranslationMemories();
for (const tm of translationMemories) {
    console.log(`${tm.name} (${tm.translationMemoryId})`);
}
```

#### Retrieving a translation memory

Use `getTranslationMemory()` to retrieve a single translation memory. It accepts
either a translation memory ID or a `TranslationMemoryInfo` object.

```javascript
const tm = await deeplClient.getTranslationMemory('YOUR_TM_ID');
console.log(`${tm.name}: ${tm.segmentCount} segments, updated ${tm.updatedTime}`);
```

#### Listing the segments of a translation memory

`listTranslationMemorySegments()` returns one page of segments. Pagination is
cursor-based: omit `pageCursor` on the first call, then pass the previous
response's `nextPageCursor` until it is `undefined`. Optionally filter with
`filterText` (at least 2 characters, matched against both source and target
text) and `filterCaseSensitive`. Note that `segmentCount` is the
translation-memory total and is not reduced by the filter.

```javascript
let pageCursor = undefined;
do {
    const page = await deeplClient.listTranslationMemorySegments('YOUR_TM_ID', {
        pageSize: 50,
        pageCursor,
    });
    for (const segment of page.segments) {
        console.log(segment.sourceText);
        for (const target of segment.targets) {
            console.log(`  ${target.targetLanguage}: ${target.targetText}`);
        }
    }
    pageCursor = page.nextPageCursor;
} while (pageCursor);
```

#### Importing a translation memory

`importTranslationMemoryFromFilepath()` imports a TMX file as a new translation
memory: it creates the import job, uploads the file, and waits for processing to
finish. The returned job carries the ID of the new translation memory.

```javascript
const job = await deeplClient.importTranslationMemoryFromFilepath('/path/to/legal.tmx', {
    displayName: 'Legal TM',
    timeoutMs: 300000,
});
console.log(`Created translation memory ${job.results[0].translationMemoryId}`);
console.log(`Skipped segments: ${job.results[0].skippedSegmentCount}`);
```

The three steps are also available separately, for example to upload the file
yourself or to poll for progress. `createTranslationMemoryImport()` returns an
upload URL that the file must be uploaded to, then `getTranslationMemoryJob()`
reports the status.

```javascript
const fileBuffer = await fs.promises.readFile('/path/to/legal.tmx');
const created = await deeplClient.createTranslationMemoryImport('legal.tmx', fileBuffer.length, {
    displayName: 'Legal TM',
});
await deeplClient.uploadTranslationMemoryFile(created, fileBuffer);

const job = await deeplClient.isTranslationMemoryJobComplete(created.jobId, 300000);
```

The job status is `'awaiting_input'` until the file is uploaded, and stays
`'awaiting_input'` for a while afterwards because the API detects the upload
asynchronously. `isTranslationMemoryJobComplete()` polls through that status
like any other non-terminal one. A job whose file is never uploaded does not
finish on its own, so pass a timeout in milliseconds when that is a
possibility.

#### Exporting a translation memory

`exportTranslationMemoryToFilepath()` exports a translation memory to a TMX file:
it creates the export job, waits for it to finish, and writes the result.

```javascript
const job = await deeplClient.exportTranslationMemoryToFilepath(
    'YOUR_TM_ID',
    '/path/to/exported.tmx',
);
```

As with import, the individual steps are available separately. Note that the API
may reuse a previously completed export of an unchanged translation memory,
indicated by `reusedExisting`.

```javascript
const created = await deeplClient.createTranslationMemoryExport('YOUR_TM_ID');
const job = await deeplClient.isTranslationMemoryJobComplete(created.jobId, 300000);
await deeplClient.downloadTranslationMemoryExport(job, '/path/to/exported.tmx');
```

#### Deleting a translation memory

Use `deleteTranslationMemory()` to delete a translation memory.

```javascript
await deeplClient.deleteTranslationMemory('YOUR_TM_ID');
```

#### Using a translation memory in translations

Pass the `translationMemory` option to `translateText()` to apply a translation
memory during translation. You can provide either the translation memory ID as a
string, or a `TranslationMemoryInfo` object returned by
`listTranslationMemories()`. Optionally, use `translationMemoryThreshold` to
control the minimum similarity for matches.

```typescript
// Using a translation memory ID
const result = await deeplClient.translateText(
    'Hello, world!',
    'en',
    'de',
    { translationMemory: 'YOUR_TM_ID' },
);

// Using a TranslationMemoryInfo object with a similarity threshold
const translationMemories = await deeplClient.listTranslationMemories();
const result = await deeplClient.translateText(
    'Hello, world!',
    'en',
    'de',
    {
        translationMemory: translationMemories[0],
        translationMemoryThreshold: 80,
    },
);
```

### Checking account usage

To check account usage, use the `getUsage()` function.

The returned `Usage` object contains up to three usage subtypes, depending on
your account type: `character`, `document` and `teamDocument`. For API accounts
`character` will be defined, the others `undefined`.

Each usage subtypes (if defined) have `count` and `limit` properties giving the
amount used and maximum amount respectively, and the `limitReached()` function
that checks if the usage has reached the limit. The top level `Usage` object has
the `anyLimitReached()` function to check all usage subtypes.

```javascript
const usage = await deeplClient.getUsage();
if (usage.anyLimitReached()) {
    console.log('Translation limit exceeded.');
}
if (usage.character) {
    console.log(`Characters: ${usage.character.count} of ${usage.character.limit}`);
}
if (usage.document) {
    console.log(`Documents: ${usage.document.count} of ${usage.document.limit}`);
}
```

### Listing available languages

You can request the list of languages supported by DeepL Translator for text and
documents using the `getSourceLanguages()` and `getTargetLanguages()` functions.
They both return an array of `Language` objects.

The `name` property gives the name of the language in English, and the `code`
property gives the language code. The `supportsFormality` property only appears
for target languages, and is a `Boolean` indicating whether the target language
supports the optional `formality` parameter.

```javascript
const sourceLanguages = await deeplClient.getSourceLanguages();
for (let i = 0; i < sourceLanguages.length; i++) {
    const lang = sourceLanguages[i];
    console.log(`${lang.name} (${lang.code})`); // Example: 'English (en)'
}

const targetLanguages = await deeplClient.getTargetLanguages();
for (let i = 0; i < targetLanguages.length; i++) {
    const lang = targetLanguages[i];
    if (lang.supportsFormality) {
        console.log(`${lang.name} (${lang.code}) supports formality`);
        // Example: 'German (DE) supports formality'
    }
}
```

Glossaries are supported for a subset of language pairs. To retrieve those
languages use the `getGlossaryLanguagePairs()` function, which returns an array
of `GlossaryLanguagePair` objects. Each has `sourceLang` and `targetLang`
properties indicating that that pair of language codes is supported for
glossaries.

```javascript
const glossaryLanguages = await deeplClient.getGlossaryLanguagePairs();
for (let i = 0; i < glossaryLanguages.length; i++) {
    const languagePair = glossaryLanguages[i];
    console.log(`${languagePair.sourceLang} to ${languagePair.targetLang}`);
    // Example: 'en to de', 'de to en', etc.
}
```

### Writing a Plugin

If you use this library in an application, please identify the application with
the `appInfo` field in the `DeepLClientOptions`, which takes the name and version of the app:

```javascript
const options = {appInfo: { appName: 'sampleNodeTranslationApp', appVersion: '1.2.3' },};
const deepl = new deepl.DeepLClient('YOUR_AUTH_KEY', options);
```

This information is passed along when the library makes calls to the DeepL API.
Both name and version are required.

### Configuration

The `DeepLClient` constructor accepts configuration options as a second argument,
for example:

```javascript
const options = { maxRetries: 5, minTimeout: 10000 };
const deepl = new deepl.DeepLClient('YOUR_AUTH_KEY', options);
```

The available options are:

-   `maxRetries`: the maximum `Number` of failed HTTP requests to retry, per
    function call. By default, 5 retries are made. See
    [Request retries](#request-retries).
-   `minTimeout`: the `Number` of milliseconds used as connection timeout for each
    HTTP request retry. The default value is 10000 (10 seconds).
-   `serverUrl`: `string` containing the URL of the DeepL API, can be overridden
    for example for testing purposes. By default, the URL is selected based on the
    user account type (free or paid).
-   `headers`: extra HTTP headers attached to every HTTP request. By default, no
    extra headers are used. Note that Authorization and User-Agent headers are
    added automatically but may be overridden by this option.
-   `proxy`: define the hostname, and port of the proxy server, and optionally
    the protocol, and authorization (as an auth object with username and
    password fields).

### Rephrasing Text

To rephrase text, call `rephraseText()`. The first argument is a string containing the text you want to rephrase, or an array of strings if you want to rephrase multiple texts.

The second argument is the target language code. Language codes are **case-insensitive** strings, for example, `'de'`, `'fr'`, `'en'`. The target language code can also be `null` to enable auto-detection of the target language.

The last two arguments, `writingStyle` and `tone`, are optional and specify the writing style and tone of the rephrased text. Possible values are defined in the `WritingStyle` and `WritingTone` enums.

`rephraseText()` returns a Promise that fulfills with an `Improvement` object or an array of `Improvement` objects corresponding to your input text(s). The `Improvement` object has the following properties:
- `text`: the rephrased text,
- `detectedSourceLang`: the detected source language code,
- `targetLanguage`: the target language code.

```javascript
// Rephrasing a text in academic style:
const rephrasedResult = await deepLClient.rephraseText('This is an example text.', 'en', WritingStyle.ACADEMIC);
console.log(rephrasedResult.text); // The rephrased text in academic style

// Rephrasing multiple texts in a friendly tone:
const rephrasedTexts = await deepLClient.rephraseText(
    ['How are you?', 'What are you doing today?'],
    'de',
    null,
    WritingTone.FRIENDLY,
);
console.log(rephrasedTexts[0].text); // The rephrased text for "How are you?" in a friendly tone
console.log(rephrasedTexts[1].text); // The rephrased text for "What are you doing today?" in a friendly tone
```


#### Logging

`deepl-node` logs debug and info messages for every HTTP request and response
using the `loglevel` module, to the `'deepl'` logger. You can reconfigure the
log level as follows:

```javascript
import log from 'loglevel';

log.getLogger('deepl').setLevel('debug'); // Or 'info'
```

The `loglevel` package also supports plugins, see
[the documentation](https://www.npmjs.com/package/loglevel#plugins).

#### Proxy configuration

You can configure a proxy by specifying the `proxy` argument when constructing a
`deepl.DeepLClient`:

```javascript
const options = {proxy: {host: 'localhost', port: 3000}};
const deepl = new deepl.DeepLClient('YOUR_AUTH_KEY', options);
```

The proxy argument is passed to the underlying `axios` request, see the
[documentation for axios][axios-proxy-docs].

#### Anonymous platform information

By default, we send some basic information about the platform the client library
is running on with each request, see [here for an explanation](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/User-Agent).
This data is completely anonymous and only used to improve our product, not track
any individual users. If you do not wish to send this data, you can opt-out when
creating your `DeepLClient` object by setting the `sendPlatformInfo` flag in
the `DeepLClientOptions` to `false` like so:

```javascript
const options = {sendPlatformInfo: false};
const deepl = new deepl.DeepLClient('YOUR_AUTH_KEY', options);
```

### Request retries

Requests to the DeepL API that fail due to transient conditions (for example,
network timeouts or high server-load) will be retried. The maximum number of
retries can be configured when constructing the `DeepLClient` object using the
`maxRetries` option. The timeout for each request attempt may be controlled
using the `minTimeout` option. An exponential-backoff strategy is used, so
requests that fail multiple times will incur delays.

## Issues

If you experience problems using the library, or would like to request a new
feature, please open an [issue][issues].

## Development

We welcome Pull Requests, please read the
[contributing guidelines](CONTRIBUTING.md).

### Environment Variables

There are multiple ways to manage your own environment variables. You can choose what works best for you. Make sure that only the values for one stage (local, prod, etc) are active at one time.

**Using a global .rc file (such as ~/.bashrc):**

```sh
# Local
export DEEPL_MOCK_SERVER_PORT=3000
export DEEPL_AUTH_KEY=ANY_VALUE
export DEEPL_SERVER_URL=http://localhost:3000
```

```sh
# Prod
# (Make sure to run `unset DEEPL_MOCK_SERVER_PORT` if it was previously assigned a value)
export DEEPL_AUTH_KEY={YOUR_API_KEY}
export DEEPL_SERVER_URL=https://api.deepl.com
```

**Using .env file**:

(Benefits include: No need to refresh terminal when changing stages, no need to call `unset` to clear vars, can be used to isolate vars between multiple projects)

- Copy `.env.example` file to a `.env` file 
    - The `.env` file will never be stored in git, so your local credentials will not be shared
- Edit `.env` file to your own desired variables
    - If using local mock server, then point to local ports

### Tests

Execute the tests using `npm test`. The tests communicate with the DeepL API
using the authentication key defined by the `DEEPL_AUTH_KEY` environment
variable.

Be aware that the tests make DeepL API requests that contribute toward your API
usage.

The test suite may instead be configured to communicate with the mock-server
provided by [deepl-mock][deepl-mock]. Although most test cases work for either,
some test cases work only with the DeepL API or the mock-server and will be
otherwise skipped. The test cases that require the mock-server trigger server
errors and test the client error-handling. To execute the tests using
deepl-mock, run it in another terminal while executing the tests. Execute the
tests using `npm test` with the `DEEPL_MOCK_SERVER_PORT` and `DEEPL_SERVER_URL`
environment variables defined referring to the mock-server.

[api-docs]: https://www.deepl.com/docs-api?utm_source=github&utm_medium=github-nodejs-readme
[api-docs-context-param]: https://www.deepl.com/docs-api/translating-text/?utm_source=github&utm_medium=github-nodejs-readme
[api-docs-csv-format]: https://www.deepl.com/docs-api/managing-glossaries/supported-glossary-formats/?utm_source=github&utm_medium=github-nodejs-readme
[axios-proxy-docs]: https://axios-http.com/docs/req_config
[create-account]: https://www.deepl.com/pro?utm_source=github&utm_medium=github-nodejs-readme#developer
[deepl-mock]: https://www.github.com/DeepLcom/deepl-mock
[issues]: https://www.github.com/DeepLcom/deepl-node/issues
[node-version-list]: https://nodejs.dev/en/about/releases/
[pro-account]: https://www.deepl.com/pro-account/?utm_source=github&utm_medium=github-nodejs-readme
