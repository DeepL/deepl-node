# Migration Documentation for Newest Glossary Functionality

## 1. Overview of Changes
The newest version of the Glossary APIs is the `/v3` endpoints, which introduce enhanced functionality:
- **Support for Multilingual Glossaries**: The v3 endpoints allow for the creation of glossaries with multiple language pairs, enhancing flexibility and usability.
- **Editing Capabilities**: Users can now edit existing glossaries.

To support these new v3 APIs, we have created new methods to interact with these new multilingual glossaries. Users are encouraged to transition to the new to take full advantage of these new features. The `v2` methods for monolingual glossaries (e.g., `createGlossary()`, `getGlossary()`, etc.) remain available, however users are encouraged to update to use the new functions.

## 2. Endpoint Changes

| Monolingual glossary methods         | Multilingual glossary methods        | Changes Summary                                           |
|--------------------------------------|--------------------------------------|----------------------------------------------------------|
| `createGlossary()`                  | `createMultilingualGlossary()`              | Accepts an array of `MultilingualGlossaryDictionaryEntries` for multi-lingual support and now returns a `MultilingualGlossaryInfo` object. |
| `createGlossaryWithCsv()`         | `createMultilingualGlossaryFromCsv()`     | Similar functionality, but now returns a `MultilingualGlossaryInfo` object |
| `getGlossary()`                     | `getMultilingualGlossary()`                 | Similar functionality, but now returns `MultilingualGlossaryInfo`. Also can accept a `MultilingualGlossaryInfo` object as the glossary parameter instead of a `GlossaryInfo` object.|
| `listGlossaries()`                  | `listMultilingualGlossaries()`              | Similar functionality, but now returns a list of `MultilingualGlossaryInfo` objects.        |
| `getGlossaryEntries()`             | `getMultilingualGlossaryDictionaryEntries()`         | Requires specifying source and target languages. Also returns a `MultilingualGlossaryDictionaryEntries` object as the response.         |
| `deleteGlossary()`                  | `deleteMultilingualGlossary()`              | Similar functionality, but now can accept a `MultilingualGlossaryInfo` object instead of a `GlossaryInfo` object when specifying the glossary.  |

## 3. Model Changes
V2 glossaries are monolingual and the previous glossary objects could only have entries for one language pair (`sourceLang` and `targetLang`). Now we introduce the concept of "glossary dictionaries", where a glossary dictionary specifies its own `sourceLangCode`, `targetLangCode`, and has its own entries.

- **Glossary Information**:
  - **v2**: `GlossaryInfo` supports only mono-lingual glossaries, containing fields such as `sourceLang`, `targetLang`, and `entryCount`.
  - **v3**: `MultilingualGlossaryInfo` supports multi-lingual glossaries and includes a list of `MultilingualGlossaryDictionaryInfo`, which provides details about each glossary dictionary, each with its own `sourceLangCode`, `targetLangCode`, and `entryCount`.

- **Glossary Entries**:
  - **v3**: Introduces `MultilingualGlossaryDictionaryEntries`, which encapsulates a glossary dictionary with source and target languages along with its entries.

## 4. Code Examples

### Create a glossary

```javascript
// monolingual glossary example
const glossaryInfo = await deeplClient.createGlossary('My Glossary', 'en', 'de', new deepl.GlossaryEntries({ entries: { Hello: 'Hallo' } }));

// multilingual glossary example
const glossaryDicts = [{sourceLangCode: 'en', targetLangCode: 'de', entries: new deepl.GlossaryEntries({ entries: { Hello: 'Hallo' } })}];
const glossaryInfo = await deeplClient.createMultilingualGlossary('My Glossary', glossaryDicts);
```

### Get a glossary
```javascript
// monolingual glossary example
const createdGlossary = await deeplClient.createGlossary('My Glossary', 'en', 'de', new deepl.GlossaryEntries({ entries: { Hello: 'Hallo' } }));
const glossaryInfo = await deeplClient.getGlossary(createdGlossary); // GlossaryInfo object

// multilingual glossary example
const glossaryDicts = [{sourceLangCode: 'en', targetLangCode: 'de', entries: new deepl.GlossaryEntries({ entries: { Hello: 'Hallo' } })}];
const createdGlossary = await deeplClient.createMultilingualGlossary('My Glossary', glossaryDicts);
const glossaryInfo = await deeplClient.getMultilingualGlossary(createdGlossary); // MultilingualGlossaryInfo object
```

### Get glossary entries
```javascript
// monolingual glossary example
const createdGlossary = await deeplClient.createGlossary('My Glossary', 'en', 'de', new deepl.GlossaryEntries({ entries: { Hello: 'Hallo' } }));
const entries = await deeplClient.getGlossaryEntries(createdGlossary);
console.log(entries.toTsv()); // 'hello\thallo'

// multilingual glossary example
const glossaryDicts = [{sourceLangCode: 'en', targetLangCode: 'de', entries: new deepl.GlossaryEntries({ entries: { Hello: 'Hallo' } })}];
const createdGlossary = await deeplClient.createMultilingualGlossary('My Glossary', glossaryDicts);
const entriesObj = await deeplClient.getMultilingualGlossaryDictionaryEntries(createdGlossary, 'en', 'de');
console.log(entriesObj.entries.toTsv()); // 'hello\thallo'
```

### List and delete glossaries
```javascript
// monolingual glossary example
const glossaries = await deeplClient.listGlossaries();
for (const glossary of glossaries) {
  if (glossary.name === "Old glossary") {
    await deeplClient.deleteGlossary(glossary);
  }
}

// multilingual glossary example
const glossaries = await deeplClient.listMultilingualGlossaries();
for (const glossary of glossaries) {
  if (glossary.name === "Old glossary") {
    await deeplClient.deleteMultilingualGlossary(glossary);
  }
}
```


## 5. New Multilingual Glossary Methods

In addition to introducing multilingual glossaries, we introduce several new methods that enhance the functionality for managing glossaries. Below are the details for each new method:

### Update Multilingual Glossary Dictionary
- **Method**: `async updateMultilingualGlossaryDictionary(glossary: GlossaryId | MultilingualGlossaryInfo, glossaryDict: MultilingualGlossaryDictionaryEntries): Promise<MultilingualGlossaryInfo>`
- **Description**: Use this method to update or create a glossary dictionary's entries
- **Parameters**:
  - `glossary`: The ID or `MultilingualGlossaryInfo` of the glossary to update.
  - `glossaryDict`: The glossary dictionary including its new entries.
- **Returns**: `MultilingualGlossaryInfo` containing information about the updated glossary.
- **Note**: This method will either update the glossary's entries if they exist for the given glossary dictionary's language pair, or adds any new ones to the dictionary if not. It will also create a new glossary dictionary if one
did not exist for the given language pair.
- **Example**:
  ```javascript
    const glossaryDicts = [{sourceLangCode: 'en', targetLangCode: 'de', entries: new deepl.GlossaryEntries({ entries: {"artist": "Maler", "hello": "guten tag"} })}];
    const myGlossary = await deeplClient.createMultilingualGlossary('My Glossary', glossaryDicts);
    const newDict = {sourceLangCode: 'en', targetLangCode: 'de', entries: new deepl.GlossaryEntries({ entries: {"hello": "hallo", "prize": "Gewinn"} })};
    const updatedGlossary = await deeplClient.updateMultilingualGlossaryDictionary(myGlossary, newDict);

    const entriesObj = await deeplClient.getMultilingualGlossaryDictionaryEntries(createdGlossary, 'en', 'de');
    console.log(entriesObj.entries.toTsv()); // {'artist': 'Maler', 'hello': 'hallo', 'prize': 'Gewinn'}
  ```

### Update Multilingual Glossary Dictionary from CSV
- **Method**: `async updateMultilingualGlossaryDictionaryFromCsv(glossary: GlossaryId | MultilingualGlossaryInfo, sourceLanguageCode: string, targetLanguageCode: string, csvContent: string): Promise<MultilingualGlossaryInfo>`
- **Description**: This method allows you to update or create a glossary dictionary using entries in CSV format.
- **Parameters**:
  - `glossary`: The ID or `MultilingualGlossaryInfo` of the glossary to update.
  - `sourceLanguageCode`: Language of source entries.
  - `targetLanguageCode`: Language of target entries.
  - `csvContent`: CSV-formatted string containing glossary entries.
- **Returns**: `MultilingualGlossaryInfo` containing information about the updated glossary.
- **Example**:
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
    const updatedGlossary = await deeplClient.updateMultilingualGlossaryDictionaryFromCsv('4c81ffb4-2e...', 'en', 'de', csvContent);
  ```

### Update Multilingual Glossary Name
- **Method**: `async updateMultilingualGlossaryName(glossary: GlossaryId | MultilingualGlossaryInfo, name: string): Promise<MultilingualGlossaryInfo>`
- **Description**: This method allows you to update the name of an existing glossary.
- **Parameters**:
  - `glossary`: The ID or `MultilingualGlossaryInfo` of the glossary to update.
  - `name`: The new name for the glossary.
- **Returns**: `MultilingualGlossaryInfo` containing information about the updated glossary.
- **Example**:
  ```javascript
  const updatedGlossary = deeplGlient.updateMultilingualGlossaryName('4c81ffb4-2e...', 'New Glossary Name')
  ```

### Replace a Multilingual Glossary Dictionary
- **Method**: `async replaceMultilingualGlossaryDictionary(glossary: GlossaryId | MultilingualGlossaryInfo, glossaryDict: MultilingualGlossaryDictionaryEntries): Promise<MultilingualGlossaryDictionaryInfo>`
- **Description**: This method replaces the existing glossary dictionary with a new set of entries.
- **Parameters**:
  - `glossary`: The ID or `MultilingualGlossaryInfo` of the glossary to update.
  - `glossaryDict`: The glossary dictionary that overwrites any existing one.
- **Returns**: `MultilingualGlossaryInfo` containing information about the updated glossary.
- **Note**: Ensure that the new dictionary entries are complete and valid, as this method will completely overwrite the existing entries. It will also create a new glossary dictionary if one did not exist for the given language pair.
- **Example**:
  ```javascript
  const newGlossaryDict = {sourceLangCode: 'en', targetLangCode: 'de', entries: new deepl.GlossaryEntries({ entries: {"goodbye": "auf Wiedersehen"} })};
  const replacedGlossary = await deeplClient.replaceMultilingualGlossaryDictionary("4c81ffb4-2e...", newGlossaryDict)
  ```

### Replace Multilingual Glossary Dictionary from CSV
- **Method**: `async replaceMultilingualGlossaryDictionaryFromCsv(glossary: GlossaryId | MultilingualGlossaryInfo, sourceLanguageCode: string, targetLanguageCode: string, csvContent: string): Promise<MultilingualGlossaryDictionaryInfo>`
- **Description**: This method allows you to replace or create a glossary dictionary using entries in CSV format.
- **Parameters**:
  - `glossary`: The ID or `MultilingualGlossaryInfo` of the glossary to update.
  - `sourceLanguageCode`: Language of source entries.
  - `targetLanguageCode`: Language of target entries.
  - `csvContent`: CSV-formatted string containing glossary entries.
- **Returns**: `MultilingualGlossaryInfo` containing information about the updated glossary.
- **Example**:
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
    const myCsvGlossary = await deeplClient.replaceMultilingualGlossaryDictionaryFromCsv('4c81ffb4-2e...', 'en', 'de', csvContent);
  ```

### Delete a Multilingual Glossary Dictionary
- **Method**: `async deleteMultilingualGlossaryDictionary(glossary: GlossaryId | MultilingualGlossaryInfo, sourceLanguageCode: string, targetLanguageCode: string): Promise<void>`
- **Description**: This method deletes a specified glossary dictionary from a given glossary.
- **Parameters**:
  - `glossary`: The ID or `MultilingualGlossaryInfo` of the glossary containing the dictionary to delete.
  - `sourceLanguageCode`: The source language of the dictionary to be deleted.
  - `targetLanguageCode`: The target language of the dictionary to be deleted.
- **Returns**: None
  
- **Migration Note**: Ensure that your application logic correctly identifies the dictionary to delete. Both `sourceLanguageCode` and `targetLanguageCode` must be provided to specify the dictionary.
  
- **Example**:
  ```javascript
  const glossaryDicts = [{sourceLangCode: 'en', targetLangCode: 'de', entries: new deepl.GlossaryEntries({ entries: {'hello': 'hallo'}})}, {sourceLangCode: 'de', targetLangCode: 'en', entries: new deepl.GlossaryEntries({ entries: {'hallo': 'hello'}})}];
  const createdGlossary = await deeplClient.createMultilingualGlossary('My Glossary', glossaryDicts);

  // Delete via specifying the language pair
  await deeplClient.deleteMultilingualGlossaryDictionary(createdGlossary, 'de', 'en');
  ```
