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
variant according to ISO 3166-1, for example `'en-US'`, or `'pt-BR'`. Target
languages without a variant use a default variant, for example `'en'` translates
to `'en-US'` and `'pt'` to `'pt-PT'`. The source language also accepts `null`, to
enable auto-detection of the source language.

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
-   `styleProfile`: specifies a style profile to use with translation, either as a
    string containing the style profile ID, or a `StyleProfile` as returned by
    `getStyleProfile()`. The profile applies its linked glossaries, style rule lists and
    translation memories; a component that does not fit the language pair is left out.
    Does not require `sourceLang`. Cannot be combined with `glossary`, `glossaryIds`,
    `styleRule`, `translationMemory`, `translationMemoryThreshold` or
    `customInstructions`; the API rejects such requests.
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
-   `styleProfile`: same as in [Text translation options](#text-translation-options).
    A style profile that does not exist fails the translation with a
    `DocumentTranslationError` whose message contains `Style profile not found.`.
-   `translationMemory`: same as in [Text translation options](#text-translation-options).
-   `translationMemoryThreshold`: same as in [Text translation options](#text-translation-options).
-   `filename`: if the input file is not provided as file path, this option is
    needed to specify the file extension.
-   `outputFormat`: file extension of the desired format of the translated
    document, for example `'docx'`. If unspecified, the translated document has
    the same format as the input document.
-   `enableWatermark`: set to `true` to add a "Translated by DeepL" watermark to
    the translated document. Only supported for `docx` and `pdf` output; for
    other output formats the API ignores this option.
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

### Spoken terms

Spoken terms collections improve the speech recognition of names, brands and other
terms. A collection has a name and one term list per language (for example `'en'`).
Terms are passed and returned as arrays of strings. Before sending, `createSpokenTerms()`,
`updateSpokenTerms()` and `replaceSpokenTermsList()` check each term like a glossary term:
an empty term or one containing a control character such as a newline throws a
`DeepLError` and sends no request. The API validates the rest (for example, at most 300
characters per list) and rejects invalid terms with a `DeepLError`.

Every method that takes a collection accepts its ID or a `SpokenTerms` object.

```javascript
// Create a collection; returns a SpokenTerms object
const spokenTerms = await deeplClient.createSpokenTerms('My terms', [
    { lang: 'en', entries: ['DeepL', 'webhook'] },
]);
console.log(spokenTerms.spokenTermsId, spokenTerms.name, spokenTerms.creationTime);
console.log(spokenTerms.termLists); // [{ lang: 'en', entryCount: 2 }]

// List all collections, or retrieve one; neither includes the terms
const allSpokenTerms = await deeplClient.listSpokenTerms();
const fetched = await deeplClient.getSpokenTerms(spokenTerms.spokenTermsId);

// Rename the collection and/or merge terms into existing term lists
await deeplClient.updateSpokenTerms(spokenTerms, {
    name: 'My renamed terms',
    termLists: [{ lang: 'en', entries: ['authentication'] }],
});

// Read the terms of one language
const entries = await deeplClient.getSpokenTermsEntries(spokenTerms, 'en');
console.log(entries.entries); // ['DeepL', 'authentication', 'webhook']

// Replace the term list of one language, or add it if the language is new;
// returns a SpokenTermsList
const termList = await deeplClient.replaceSpokenTermsList(spokenTerms, {
    lang: 'de',
    entries: ['Schnittstelle'],
});
console.log(termList); // { lang: 'de', entryCount: 1 }

// Delete the term list of one language, then the whole collection
await deeplClient.deleteSpokenTermsList(spokenTerms, 'de');
await deeplClient.deleteSpokenTerms(spokenTerms);
```

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

### Style profiles

A style profile is a named set of linked glossaries, style rule lists and translation
memories, with an optional description and industry. Every method that takes a style
profile accepts its ID or a `StyleProfile` object.

Options left `undefined` are not sent. When updating, they are not changed; an empty
string `''` clears `description` or `industry`, and an ID array replaces the linked
components of that kind in full, so an empty array `[]` unlinks all of them.

```javascript
// Create a style profile with only a name; the component ID arrays are empty
const minimal = await deeplClient.createStyleProfile('My profile');

// Create a style profile linking components
const styleProfile = await deeplClient.createStyleProfile('Legal, German', {
    description: 'Contract wording for the German market.',
    industry: 'Legal',
    glossaryIds: ['YOUR_GLOSSARY_ID'],
    styleRuleIds: ['YOUR_STYLE_ID'],
    translationMemoryIds: ['YOUR_TRANSLATION_MEMORY_ID'],
    glossaryPriorityOrderEnabled: true,
});
console.log(styleProfile.styleProfileId, styleProfile.name, styleProfile.styleRuleIds);

// Retrieve a style profile
const fetched = await deeplClient.getStyleProfile(styleProfile.styleProfileId);

// List style profiles page by page: page is 0-indexed, pageSize defaults to 10 (max 100)
const firstPage = await deeplClient.listStyleProfiles();
const secondPage = await deeplClient.listStyleProfiles(1, 100);

// Rename, clear the description and unlink all style rule lists; other fields stay unchanged
const updated = await deeplClient.updateStyleProfile(styleProfile, {
    name: 'Legal, German (v2)',
    description: '',
    styleRuleIds: [],
});
console.log(updated.description); // undefined

// Delete the style profile; the linked components are not deleted
await deeplClient.deleteStyleProfile(styleProfile);
```

To translate with a style profile, pass it as the `styleProfile` option of text or
document translation:

```javascript
const result = await deeplClient.translateText('The artist is here.', null, 'de', {
    styleProfile: 'YOUR_STYLE_PROFILE_ID',
});
await deeplClient.translateDocument('input.docx', 'output.docx', null, 'de', {
    styleProfile: styleProfile,
});
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
the `anyLimitReached()` function to check the `character`, `document` and
`teamDocument` usage.

For API Pro accounts, the `Usage` object also contains:

- `apiKeyCharacter`: characters translated with this API key, as opposed to
  `character`, which covers the whole account.
- `speechToTextMinutes` and `speechToSpeechMinutes`: speech usage in minutes.
- `startTime` and `endTime`: the current billing period, as `Date` objects.
- `products`: an array of per-product usage, each with `productType` (for
  example `'translate'`, `'write'`, `'speechToText'`), `billingUnit` (for
  example `'characters'`, `'minutes'`), `apiKeyUnitCount` (this API key) and
  `accountUnitCount` (the whole account).

These fields are `undefined` when the response does not contain them, for
example for API Free accounts. `anyLimitReached()` does not check
`apiKeyCharacter`, `speechToTextMinutes` or `speechToSpeechMinutes`; call their
`limitReached()` function yourself.

```javascript
const usage = await deeplClient.getUsage();
if (usage.anyLimitReached()) {
    console.log('Translation limit exceeded.');
}
if (usage.character) {
    console.log(`Characters (account): ${usage.character.count} of ${usage.character.limit}`);
}
if (usage.apiKeyCharacter) {
    console.log(
        `Characters (this API key): ${usage.apiKeyCharacter.count} of ${usage.apiKeyCharacter.limit}`,
    );
    if (usage.apiKeyCharacter.limitReached()) {
        console.log('API key character limit exceeded.');
    }
}
if (usage.document) {
    console.log(`Documents: ${usage.document.count} of ${usage.document.limit}`);
}
if (usage.startTime && usage.endTime) {
    console.log(`Billing period: ${usage.startTime.toISOString()} to ${usage.endTime.toISOString()}`);
}
for (const product of usage.products ?? []) {
    console.log(
        `${product.productType}: ${product.apiKeyUnitCount} ${product.billingUnit} (this API key), ` +
            `${product.accountUnitCount} ${product.billingUnit} (account)`,
    );
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

### Admin API

The Admin API lets you manage the developer keys of your organization and
retrieve usage analytics. It requires an admin API key, which you can create in
the "Admin API Keys" tab of your DeepL account. Admin keys cannot be used for
translation; developer keys cannot access the Admin API.

Create a `DeepLAdminClient` with your admin key. It uses the
`https://api.deepl.com` server by default, and accepts the same connection
options as `DeepLClient`, see [Configuration](#configuration).

```javascript
import * as deepl from 'deepl-node';

const adminClient = new deepl.DeepLAdminClient('YOUR_ADMIN_KEY');
```

#### Managing developer keys

```javascript
let key = await adminClient.createDeveloperKey('Staging Team Key');
console.log(`Created ${key.label} (${key.keyId})`);

for (const k of await adminClient.getDeveloperKeys()) {
    console.log(`${k.label}: deactivated=${k.isDeactivated}`);
}

key = await adminClient.renameDeveloperKey(key, 'Production Team Key');

// Limits 500000 characters and removes the speech-to-text limit. Other limits
// keep their current value.
key = await adminClient.setDeveloperKeyUsageLimits(key, {
    characters: 500000,
    speechToTextMilliseconds: null,
});

// Deactivation is permanent.
await adminClient.deactivateDeveloperKey(key);
```

`renameDeveloperKey()`, `setDeveloperKeyUsageLimits()` and
`deactivateDeveloperKey()` accept either a key ID or a `DeveloperKey` object.
These three and `createDeveloperKey()` return the resulting `DeveloperKey`.

`setDeveloperKeyUsageLimits()` changes only the limits you pass:
`characters`, `speechToTextMilliseconds` and `speechToSpeechMilliseconds`.
Omitted limits keep their current value, `null` removes a limit and `0` blocks
that usage.

#### Retrieving usage analytics

`getUsageAnalytics()` returns an `AdminUsageReport` for a date range. Dates are
UTC calendar days, and both the start day and the end day are included. The API
requires the end date to be after the start date, so a report covers at least
two days, and at most 366 days after it; otherwise it responds with an error.
Dates can be `'YYYY-MM-DD'` strings or `Date` objects. For a `Date`, the library
sends the UTC date of that moment: local midnight in UTC+2
(`2026-10-20T00:00+02:00`) is sent as `2026-10-19`. Use a string to send an
exact date. Invalid dates throw an `ArgumentError` before any request is sent.
Use the optional `groupBy` option
to break the usage down by key (`'key'`, see `keyUsages`) or by key and day
(`'key_and_day'`, see `keyAndDayUsages`). The `groupBy` of the returned report
is the raw string the API reports, for example `'keyAndDay'`. Usage breakdowns
contain the characters per product plus `speechToTextMinutes` and
`speechToSpeechMinutes`.

```javascript
const report = await adminClient.getUsageAnalytics('2026-06-01', '2026-07-01', {
    groupBy: 'key',
});
console.log(`Total characters: ${report.totalUsage.totalCharacters}`);
for (const keyUsage of report.keyUsages) {
    console.log(`${keyUsage.apiKeyLabel}: ${keyUsage.usage.totalCharacters}`);
}
```

`getCustomTagUsageAnalytics()` returns a `CustomTagUsageReport` with the usage
per custom tag. Use the optional `aggregateBy` option to choose between the
whole period (`'period'`, the default) and per-day usage (`'day'`). The results
are paginated: pass the `nextPage` value of a report as the `page` option to get
the next page.

```javascript
let page;
do {
    const report = await adminClient.getCustomTagUsageAnalytics('2026-06-01', '2026-07-01', {
        page,
    });
    for (const tagUsage of report.usage) {
        console.log(`${tagUsage.customTag}: ${tagUsage.breakdown.totalCharacters}`);
    }
    page = report.nextPage;
} while (page !== undefined);
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
    HTTP request retry. The default value is 5000 (5 seconds).
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

### Correcting Text

To correct grammar, spelling and punctuation, call `correctText()`. The first argument is a string containing the text you want to correct, or an array of strings if you want to correct multiple texts.

The second argument is optional and is the target language code, for example `'de'` or `'en-US'`. If it is omitted or `null`, the language of the input text is used.

`correctText()` returns a Promise that fulfills with a `WriteResult` object or an array of `WriteResult` objects corresponding to your input text(s). The `WriteResult` object has the following properties:
- `text`: the corrected text,
- `detectedSourceLang`: the detected source language code,
- `targetLang`: the target language code.

```javascript
// Correcting a single text:
const corrected = await deepLClient.correctText('I has a apple.', 'en-US');
console.log(corrected.text); // It has an apple.

// Correcting multiple texts:
const correctedTexts = await deepLClient.correctText(['I has a apple.', 'She go to school.']);
console.log(correctedTexts[1].text); // She goes to school.
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

`DeepLAdminClient.createDeveloperKey()` is retried only after rate limiting
(HTTP 429) and DNS failures, as repeating it after other failures could create
a second key.

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
export DEEPL_AUTH_KEY={YOUR_API_KEY}
export DEEPL_SERVER_URL=https://api.deepl.com
```

**Using .env file**:

(Benefits include: No need to refresh terminal when changing stages, can be used to isolate vars between multiple projects)

- Copy `.env.example` file to a `.env` file 
    - The `.env` file will never be stored in git, so your local credentials will not be shared
- Edit `.env` file to your own desired variables

### Tests

The tests are split into two groups, selected by `npm` script:

- `npm run test:offline` runs `tests/offline`. These tests intercept all HTTP
  traffic with [nock][nock], so they need no network and no authentication key.
  They check the requests that the library sends for every option, and how it
  handles errors, retries and polling.
- `npm run test:real-api` runs `tests/realApi`. These tests send one request per
  API endpoint to the DeepL API, using the authentication key and server URL
  defined by the `DEEPL_AUTH_KEY` and `DEEPL_SERVER_URL` environment variables.
  They create and delete glossaries, style rules, translation memories and
  spoken terms collections named
  `sdktest-node-...`.

`npm test` runs both groups. Be aware that the real-API tests make DeepL API
requests that contribute toward your API usage.

[api-docs]: https://www.deepl.com/docs-api?utm_source=github&utm_medium=github-nodejs-readme
[api-docs-context-param]: https://www.deepl.com/docs-api/translating-text/?utm_source=github&utm_medium=github-nodejs-readme
[api-docs-csv-format]: https://www.deepl.com/docs-api/managing-glossaries/supported-glossary-formats/?utm_source=github&utm_medium=github-nodejs-readme
[axios-proxy-docs]: https://axios-http.com/docs/req_config
[create-account]: https://www.deepl.com/pro?utm_source=github&utm_medium=github-nodejs-readme#developer
[issues]: https://www.github.com/DeepLcom/deepl-node/issues
[nock]: https://github.com/nock/nock
[node-version-list]: https://nodejs.dev/en/about/releases/
[pro-account]: https://www.deepl.com/pro-account/?utm_source=github&utm_medium=github-nodejs-readme
