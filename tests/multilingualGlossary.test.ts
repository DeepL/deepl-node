// Copyright 2025 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import * as deepl from 'deepl-node';

import { randomUUID } from 'crypto';
import { makeDeeplClient, withRealServer } from './core';

describe('Multilingual Glossary Tests', () => {
    const INVALID_GLOSSARY_ID = 'invalid_glossary_id';
    const GLOSSARY_NAME_PREFIX = 'deepl-node-test-glossary';
    const NONEXISTENT_GLOSSARY_ID = '96ab91fd-e715-41a1-adeb-5d701f84a483';
    const SOURCE_LANG = 'en';
    const TARGET_LANG = 'de';
    const INVALID_TARGET_LANG = 'xx';
    const TEST_ENTRIES = new deepl.GlossaryEntries({ entries: { Hello: 'Hallo' } });
    const TEST_CSV_ENTRIES = 'Hello,Guten Tag\nApple,Apfel';

    // const TEST_DICTIONARY = { sourceLangCode: SOURCE_LANG, targetLangCode: TARGET_LANG, entries: TEST_ENTRIES };

    /**
     * Utility class for managing test glossary lifecycle and cleanup
     */
    class GlossaryCleanupUtility {
        private client: deepl.DeepLClient;
        readonly glossaryName: string;
        private glossaryId?: string;

        constructor(client: deepl.DeepLClient, testName: string) {
            this.client = client;
            const uuid = randomUUID();
            this.glossaryName = `${GLOSSARY_NAME_PREFIX}: ${testName} ${uuid}`;
        }

        public capture(glossary: deepl.MultilingualGlossaryInfo): deepl.MultilingualGlossaryInfo {
            this.glossaryId = glossary.glossaryId;
            return glossary;
        }

        public async cleanup(): Promise<void> {
            try {
                if (this.glossaryId) {
                    await this.client.deleteMultilingualGlossary(this.glossaryId);
                }
            } catch {
                // All exceptions ignored
            }
        }
    }

    /**
     * Utility function for determining if a list of deepl.MultilingualGlossaryDictionaryEntries objects (that have entries) matches
     * a list of deepl.MultilingualGlossaryDictionaryInfo (that do not contain entries, but just a count of the number of entries for
     * that glossary dictionary
     */
    function assertGlossaryDictionariesEquivalent(
        expectedDicts: deepl.MultilingualGlossaryDictionaryEntries[],
        actualDicts: deepl.MultilingualGlossaryDictionaryInfo[],
    ): void {
        expect(actualDicts.length).toBe(expectedDicts.length);

        for (const expectedDict of expectedDicts) {
            const actualDict = actualDicts.find(
                (d) =>
                    d.sourceLangCode.toLowerCase() === expectedDict.sourceLangCode.toLowerCase() &&
                    d.targetLangCode.toLowerCase() === expectedDict.targetLangCode.toLowerCase(),
            );

            expect(actualDict).toBeDefined();
            expect(actualDict?.sourceLangCode.toLowerCase()).toBe(
                expectedDict.sourceLangCode.toLowerCase(),
            );
            expect(actualDict?.targetLangCode.toLowerCase()).toBe(
                expectedDict.targetLangCode.toLowerCase(),
            );
            expect(actualDict?.entryCount).toBe(Object.keys(expectedDict.entries.entries()).length);
        }
    }

    test('testMultilingualGlossaryCreateWithCsv', async () => {
        const deeplClient = makeDeeplClient();
        const glossaryCleanup = new GlossaryCleanupUtility(
            deeplClient,
            'testMultilingualGlossaryCreateWithCsv',
        );
        const glossaryName = glossaryCleanup.glossaryName;

        try {
            const glossary = await deeplClient.createMultilingualGlossaryWithCsv(
                glossaryName,
                SOURCE_LANG,
                TARGET_LANG,
                TEST_CSV_ENTRIES,
            );
            glossaryCleanup.capture(glossary);

            expect(glossary.name).toBe(glossaryName);
            const createdDict = glossary.dictionaries.find(
                (dict) =>
                    dict.sourceLangCode === SOURCE_LANG && dict.targetLangCode === TARGET_LANG,
            );
            expect(createdDict).toBeDefined();
            expect(createdDict?.entryCount).toBe(2);

            const getResult = await deeplClient.getMultilingualGlossary(glossary.glossaryId);
            expect(getResult.name).toBe(glossary.name);
            expect(getResult.creationTime).toEqual(glossary.creationTime);
            assertGlossaryDictionariesEquivalent(
                [
                    {
                        sourceLangCode: SOURCE_LANG,
                        targetLangCode: TARGET_LANG,
                        entries: new deepl.GlossaryEntries({
                            entries: { Hello: 'Guten Tag', Apple: 'Apfel' },
                        }),
                    },
                ],
                getResult.dictionaries,
            );
        } finally {
            await glossaryCleanup.cleanup();
        }
    });

    withRealServer('testMultilingualGlossaryCreateNoDictionaries', async () => {
        const deeplClient = makeDeeplClient();
        const glossaryCleanup = new GlossaryCleanupUtility(
            deeplClient,
            'testMultilingualGlossaryCreateEmptyEntries',
        );
        const glossaryName = glossaryCleanup.glossaryName;
        try {
            const glossary = await deeplClient.createMultilingualGlossary(glossaryName, []);
            glossaryCleanup.capture(glossary);

            expect(glossary.name).toBe(glossaryName);
            assertGlossaryDictionariesEquivalent([], glossary.dictionaries);

            const getResult = await deeplClient.getMultilingualGlossary(glossary.glossaryId);
            expect(getResult.name).toBe(glossary.name);
            expect(getResult.creationTime).toEqual(glossary.creationTime);
            assertGlossaryDictionariesEquivalent([], getResult.dictionaries);
        } finally {
            await glossaryCleanup.cleanup();
        }
    });

    test('testMultilingualGlossaryCreate', async () => {
        const deeplClient = makeDeeplClient();
        const glossaryCleanup = new GlossaryCleanupUtility(
            deeplClient,
            'testMultilingualGlossaryCreate',
        );
        const glossaryName = glossaryCleanup.glossaryName;

        try {
            const glossaryDicts = [
                {
                    sourceLangCode: SOURCE_LANG,
                    targetLangCode: TARGET_LANG,
                    entries: TEST_ENTRIES,
                },
                {
                    sourceLangCode: TARGET_LANG,
                    targetLangCode: SOURCE_LANG,
                    entries: TEST_ENTRIES,
                },
            ];

            const glossary = await deeplClient.createMultilingualGlossary(
                glossaryName,
                glossaryDicts,
            );
            glossaryCleanup.capture(glossary);

            expect(glossary.name).toBe(glossaryName);
            assertGlossaryDictionariesEquivalent(glossaryDicts, glossary.dictionaries);

            const getResult = await deeplClient.getMultilingualGlossary(glossary.glossaryId);
            expect(getResult.name).toBe(glossary.name);
            expect(getResult.creationTime).toEqual(glossary.creationTime);
            assertGlossaryDictionariesEquivalent(glossaryDicts, getResult.dictionaries);
        } finally {
            await glossaryCleanup.cleanup();
        }
    });

    test('testUpdateMultilingualGlossaryDictionaryWithCsv', async () => {
        const deeplClient = makeDeeplClient();
        const glossaryCleanup = new GlossaryCleanupUtility(
            deeplClient,
            'testUpdateMultilingualGlossaryDictionaryWithCsv',
        );
        const glossaryName = glossaryCleanup.glossaryName;

        try {
            // Create initial glossary
            const glossaryDicts = [
                { sourceLangCode: SOURCE_LANG, targetLangCode: TARGET_LANG, entries: TEST_ENTRIES },
            ];
            const createdGlossary = await deeplClient.createMultilingualGlossary(
                glossaryName,
                glossaryDicts,
            );
            glossaryCleanup.capture(createdGlossary);

            // Update glossary dictionary with CSV
            const updatedCsvContent = 'Hello,Guten Tag\nApple,Apfel';
            const updatedGlossary = await deeplClient.updateMultilingualGlossaryDictionaryWithCsv(
                createdGlossary.glossaryId,
                SOURCE_LANG,
                TARGET_LANG,
                updatedCsvContent,
            );

            expect(updatedGlossary.name).toBe(glossaryName);
            const updatedDict = updatedGlossary.dictionaries.find(
                (dict) =>
                    dict.sourceLangCode === SOURCE_LANG && dict.targetLangCode === TARGET_LANG,
            );
            expect(updatedDict).toBeDefined();
            expect(updatedDict?.entryCount).toBe(2);
        } finally {
            await glossaryCleanup.cleanup();
        }
    });

    test('testUpdateMultilingualGlossaryDictionary', async () => {
        const deeplClient = makeDeeplClient();
        const glossaryCleanup = new GlossaryCleanupUtility(
            deeplClient,
            'testUpdateMultilingualGlossaryDictionary',
        );
        const glossaryName = glossaryCleanup.glossaryName;

        try {
            // Create initial glossary
            const glossaryDicts = [
                { sourceLangCode: SOURCE_LANG, targetLangCode: TARGET_LANG, entries: TEST_ENTRIES },
            ];
            const createdGlossary = await deeplClient.createMultilingualGlossary(
                glossaryName,
                glossaryDicts,
            );
            glossaryCleanup.capture(createdGlossary);

            // Update glossary dictionary
            const updatedEntries = new deepl.GlossaryEntries({
                entries: { Hello: 'Guten Tag', Apple: 'Apfel' },
            });
            const updatedGlossary = await deeplClient.updateMultilingualGlossaryDictionary(
                createdGlossary.glossaryId,
                {
                    sourceLangCode: SOURCE_LANG,
                    targetLangCode: TARGET_LANG,
                    entries: updatedEntries,
                },
            );

            expect(updatedGlossary.name).toBe(glossaryName);
            const updatedDict = updatedGlossary.dictionaries.find(
                (dict) =>
                    dict.sourceLangCode === SOURCE_LANG && dict.targetLangCode === TARGET_LANG,
            );
            expect(updatedDict).toBeDefined();
            expect(updatedDict?.entryCount).toBe(2);
        } finally {
            await glossaryCleanup.cleanup();
        }
    });

    withRealServer('testGlossaryCreateInvalid', async () => {
        const deeplClient = makeDeeplClient();
        const glossaryCleanup = new GlossaryCleanupUtility(
            deeplClient,
            'testGlossaryCreateInvalid',
        );
        const glossaryName = glossaryCleanup.glossaryName;
        const glossaryDicts = [
            { sourceLangCode: SOURCE_LANG, targetLangCode: TARGET_LANG, entries: TEST_ENTRIES },
        ];

        try {
            // Test case: Empty glossary name
            await expect(deeplClient.createMultilingualGlossary('', glossaryDicts)).rejects.toThrow(
                deepl.ArgumentError,
            );
            // Test case: Invalid target language
            await expect(
                deeplClient.createMultilingualGlossary(glossaryName, [
                    {
                        sourceLangCode: SOURCE_LANG,
                        targetLangCode: INVALID_TARGET_LANG,
                        entries: TEST_ENTRIES,
                    },
                ]),
            ).rejects.toThrow(deepl.DeepLError);
            // Test case: Empty entries
            await expect(
                deeplClient.createMultilingualGlossary(glossaryName, [
                    {
                        sourceLangCode: SOURCE_LANG,
                        targetLangCode: TARGET_LANG,
                        entries: new deepl.GlossaryEntries(),
                    },
                ]),
            ).rejects.toThrow(deepl.DeepLError);
        } finally {
            await glossaryCleanup.cleanup();
        }
    });

    test('testGlossaryCreateLarge', async () => {
        const deeplClient = makeDeeplClient();
        const glossaryCleanup = new GlossaryCleanupUtility(deeplClient, 'testGlossaryCreateLarge');
        const glossaryName = glossaryCleanup.glossaryName;

        // Generate a large number of entries
        const entriesRecord: Record<string, string> = {};
        for (let i = 0; i < 10000; i++) {
            entriesRecord[`Source-${i}`] = `Target-${i}`;
        }
        const entriesAsObj = new deepl.GlossaryEntries({ entries: entriesRecord });
        const glossaryDicts = [
            { sourceLangCode: SOURCE_LANG, targetLangCode: TARGET_LANG, entries: entriesAsObj },
        ];
        const createdGlossary: deepl.MultilingualGlossaryInfo =
            await deeplClient.createMultilingualGlossary(glossaryName, glossaryDicts);

        try {
            // Verify the glossary was created successfully
            expect(createdGlossary.name).toBe(glossaryName);
            expect(createdGlossary.dictionaries.length).toBe(glossaryDicts.length);
            expect(createdGlossary.dictionaries[0].entryCount).toBe(
                Object.keys(entriesRecord).length,
            );

            // Retrieve the glossary entries and verify correctness
            const retrievedEntries = await deeplClient.getMultilingualGlossaryDictionaryEntries(
                createdGlossary.glossaryId,
                SOURCE_LANG,
                TARGET_LANG,
            );
            expect(retrievedEntries.entries).toEqual(entriesAsObj);
        } finally {
            // Cleanup the created glossary
            await deeplClient.deleteMultilingualGlossary(createdGlossary.glossaryId);
        }
    });

    test('testGlossaryGet', async () => {
        const deeplClient = makeDeeplClient();
        const glossaryCleanup = new GlossaryCleanupUtility(deeplClient, 'testGlossaryGet');
        const glossaryName = glossaryCleanup.glossaryName;
        const glossaryDicts = [
            { sourceLangCode: SOURCE_LANG, targetLangCode: TARGET_LANG, entries: TEST_ENTRIES },
        ];

        // Create a glossary
        const createdGlossary: deepl.MultilingualGlossaryInfo =
            await deeplClient.createMultilingualGlossary(glossaryName, glossaryDicts);

        try {
            // Retrieve the created glossary
            const retrievedGlossary = await deeplClient.getMultilingualGlossary(
                createdGlossary.glossaryId,
            );

            expect(retrievedGlossary.glossaryId).toBe(createdGlossary.glossaryId);
            expect(retrievedGlossary.name).toBe(createdGlossary.name);

            // Test invalid glossary ID
            await expect(deeplClient.getMultilingualGlossary(INVALID_GLOSSARY_ID)).rejects.toThrow(
                deepl.DeepLError,
            );

            // Test nonexistent glossary ID
            await expect(
                deeplClient.getMultilingualGlossary(NONEXISTENT_GLOSSARY_ID),
            ).rejects.toThrow(deepl.GlossaryNotFoundError);
        } finally {
            // Cleanup the created glossary
            await deeplClient.deleteMultilingualGlossary(createdGlossary.glossaryId);
        }
    });

    test('testGlossaryGetEntries', async () => {
        const deeplClient = makeDeeplClient();
        const glossaryCleanup = new GlossaryCleanupUtility(deeplClient, 'testGlossaryGetEntries');
        const glossaryName = glossaryCleanup.glossaryName;
        const entries = {
            Apple: 'Apfel',
            Banana: 'Banane',
            'A%=&': 'B&=%',
            Δぁ: '深',
            '🪨': '🪵',
        };
        const entriesAsObj = new deepl.GlossaryEntries({ entries: entries });
        const glossaryDicts = [
            { sourceLangCode: SOURCE_LANG, targetLangCode: TARGET_LANG, entries: entriesAsObj },
        ];

        // Create a glossary
        const createdGlossary: deepl.MultilingualGlossaryInfo =
            await deeplClient.createMultilingualGlossary(glossaryName, glossaryDicts);

        try {
            // Retrieve entries using glossary object
            const result = await deeplClient.getMultilingualGlossaryDictionaryEntries(
                createdGlossary.glossaryId,
                SOURCE_LANG,
                TARGET_LANG,
            );
            expect(result.entries).toEqual(entriesAsObj);

            // Retrieve entries using glossary ID
            const getByIdResult = await deeplClient.getMultilingualGlossaryDictionaryEntries(
                createdGlossary.glossaryId,
                SOURCE_LANG,
                TARGET_LANG,
            );
            expect(getByIdResult.entries).toEqual(entriesAsObj);

            // Test invalid glossary ID
            await expect(
                deeplClient.getMultilingualGlossaryDictionaryEntries(
                    INVALID_GLOSSARY_ID,
                    SOURCE_LANG,
                    TARGET_LANG,
                ),
            ).rejects.toThrow(deepl.DeepLError);

            // Test nonexistent glossary ID
            await expect(
                deeplClient.getMultilingualGlossaryDictionaryEntries(
                    NONEXISTENT_GLOSSARY_ID,
                    SOURCE_LANG,
                    TARGET_LANG,
                ),
            ).rejects.toThrow(deepl.GlossaryNotFoundError);
        } finally {
            // Cleanup the created glossary
            await deeplClient.deleteMultilingualGlossary(createdGlossary.glossaryId);
        }
    });

    test('testUpdateMultilingualGlossaryName', async () => {
        const deeplClient = makeDeeplClient();
        const glossaryCleanup = new GlossaryCleanupUtility(
            deeplClient,
            'testUpdateMultilingualGlossaryName',
        );
        const glossaryName = glossaryCleanup.glossaryName;

        try {
            // Create initial glossary
            const glossaryDicts = [
                { sourceLangCode: SOURCE_LANG, targetLangCode: TARGET_LANG, entries: TEST_ENTRIES },
            ];
            const createdGlossary = await deeplClient.createMultilingualGlossary(
                glossaryName,
                glossaryDicts,
            );
            glossaryCleanup.capture(createdGlossary);

            // Update glossary name
            const newName = 'Updated Glossary Name';
            const updatedGlossary = await deeplClient.updateMultilingualGlossaryName(
                createdGlossary.glossaryId,
                newName,
            );

            expect(updatedGlossary.name).toBe(newName);

            // Verify updated name
            const fetchedGlossary = await deeplClient.getMultilingualGlossary(
                createdGlossary.glossaryId,
            );
            expect(fetchedGlossary.name).toBe(newName);
        } finally {
            await glossaryCleanup.cleanup();
        }
    });

    test('testListGlossaries', async () => {
        const deeplClient = makeDeeplClient();
        const glossaryCleanup = new GlossaryCleanupUtility(deeplClient, 'testListGlossaries');
        const glossaryName = glossaryCleanup.glossaryName;

        try {
            // Create initial glossary
            const glossaryDicts = [
                { sourceLangCode: SOURCE_LANG, targetLangCode: TARGET_LANG, entries: TEST_ENTRIES },
            ];
            const createdGlossary = await deeplClient.createMultilingualGlossary(
                glossaryName,
                glossaryDicts,
            );
            glossaryCleanup.capture(createdGlossary);
            const glossaries = await deeplClient.listMultilingualGlossaries();
            const actualGlossary = glossaries.find(
                (glossary) => glossary.glossaryId === createdGlossary.glossaryId,
            );
            expect(actualGlossary).toBeDefined();
            expect(actualGlossary?.name).toEqual(glossaryName);
            expect(actualGlossary?.creationTime).toEqual(createdGlossary.creationTime);
        } finally {
            await glossaryCleanup.cleanup();
        }
    });

    test('testDeleteGlossaries', async () => {
        const deeplClient = makeDeeplClient();
        const glossaryCleanup = new GlossaryCleanupUtility(deeplClient, 'testDeleteGlossaries');
        const glossaryName = glossaryCleanup.glossaryName;

        try {
            // Create initial glossary
            const glossaryDicts = [
                { sourceLangCode: SOURCE_LANG, targetLangCode: TARGET_LANG, entries: TEST_ENTRIES },
            ];
            const createdGlossary = await deeplClient.createMultilingualGlossary(
                glossaryName,
                glossaryDicts,
            );
            glossaryCleanup.capture(createdGlossary);
            await deeplClient.deleteMultilingualGlossary(createdGlossary.glossaryId);
            await expect(
                deeplClient.getMultilingualGlossary(createdGlossary.glossaryId),
            ).rejects.toThrow(deepl.GlossaryNotFoundError);
            await expect(deeplClient.getMultilingualGlossary(INVALID_GLOSSARY_ID)).rejects.toThrow(
                deepl.DeepLError,
            );
            await expect(
                deeplClient.getMultilingualGlossary(NONEXISTENT_GLOSSARY_ID),
            ).rejects.toThrow(deepl.GlossaryNotFoundError);
        } finally {
            await glossaryCleanup.cleanup();
        }
    });

    test('testGlossaryDictionaryDelete', async () => {
        const deeplClient = makeDeeplClient();
        const glossaryCleanup = new GlossaryCleanupUtility(
            deeplClient,
            'testGlossaryDictionaryDelete',
        );
        const glossaryName = glossaryCleanup.glossaryName;
        const toBeDeleted = {
            sourceLangCode: SOURCE_LANG,
            targetLangCode: TARGET_LANG,
            entries: new deepl.GlossaryEntries({ entries: { Hello: 'Hallo' } }),
        };
        const toRemain = {
            sourceLangCode: TARGET_LANG,
            targetLangCode: SOURCE_LANG,
            entries: new deepl.GlossaryEntries({ entries: { Hallo: 'Hello' } }),
        };
        const glossaryDicts = [toBeDeleted, toRemain];
        const createdGlossary: deepl.MultilingualGlossaryInfo =
            await deeplClient.createMultilingualGlossary(glossaryName, glossaryDicts);

        try {
            const getResultBeforeDeletion = await deeplClient.getMultilingualGlossary(
                createdGlossary.glossaryId,
            );
            expect(getResultBeforeDeletion.dictionaries.length).toEqual(2);
            await deeplClient.deleteMultilingualGlossaryDictionary(
                createdGlossary.glossaryId,
                toBeDeleted.sourceLangCode,
                toBeDeleted.targetLangCode,
            );

            // Verify the dictionary was deleted
            const getResult = await deeplClient.getMultilingualGlossary(createdGlossary.glossaryId);
            expect(getResult.dictionaries.length).toBe(glossaryDicts.length - 1);
            const remainingDict = getResult.dictionaries[0];
            expect(remainingDict.sourceLangCode).toBe(toRemain.sourceLangCode);
            expect(remainingDict.targetLangCode).toBe(toRemain.targetLangCode);

            // Test invalid glossary ID
            await expect(
                deeplClient.deleteMultilingualGlossaryDictionary(
                    INVALID_GLOSSARY_ID,
                    SOURCE_LANG,
                    TARGET_LANG,
                ),
            ).rejects.toThrow(deepl.DeepLError);

            // Test nonexistent glossary ID
            await expect(
                deeplClient.deleteMultilingualGlossaryDictionary(
                    NONEXISTENT_GLOSSARY_ID,
                    SOURCE_LANG,
                    TARGET_LANG,
                ),
            ).rejects.toThrow(deepl.GlossaryNotFoundError);

            // Test missing source and target language
            await expect(
                deeplClient.deleteMultilingualGlossaryDictionary(
                    createdGlossary.glossaryId,
                    '',
                    '',
                ),
            ).rejects.toThrow(deepl.ArgumentError);
        } finally {
            await deeplClient.deleteMultilingualGlossary(createdGlossary.glossaryId);
        }
    });

    test('testGlossaryDictionaryReplace', async () => {
        const deeplClient = makeDeeplClient();
        const glossaryCleanup = new GlossaryCleanupUtility(
            deeplClient,
            'testGlossaryDictionaryReplace',
        );
        const glossaryName = glossaryCleanup.glossaryName;

        try {
            // Create initial glossary
            const glossaryDicts = [
                { sourceLangCode: SOURCE_LANG, targetLangCode: TARGET_LANG, entries: TEST_ENTRIES },
            ];
            const createdGlossary = await deeplClient.createMultilingualGlossary(
                glossaryName,
                glossaryDicts,
            );
            glossaryCleanup.capture(createdGlossary);

            // Replace glossary dictionary
            const newEntries = new deepl.GlossaryEntries({
                entries: { Apple: 'Apfel', Banana: 'Banane' },
            });
            const updatedGlossaryDict = await deeplClient.replaceMultilingualGlossaryDictionary(
                createdGlossary.glossaryId,
                {
                    sourceLangCode: SOURCE_LANG,
                    targetLangCode: TARGET_LANG,
                    entries: newEntries,
                },
            );

            expect(updatedGlossaryDict.entryCount).toBe(2);

            // Verify updated entries
            const entriesResponse = await deeplClient.getMultilingualGlossaryDictionaryEntries(
                createdGlossary.glossaryId,
                SOURCE_LANG,
                TARGET_LANG,
            );
            expect(entriesResponse.entries).toEqual(newEntries);
        } finally {
            await glossaryCleanup.cleanup();
        }
    });

    withRealServer('testGlossaryTranslateTextSentence', async () => {
        const deeplClient = makeDeeplClient();
        const glossaryCleanup = new GlossaryCleanupUtility(
            deeplClient,
            'testGlossaryDictionaryDelete',
        );
        const glossaryName = glossaryCleanup.glossaryName;
        const inputText = 'The artist was awarded a prize.';
        const glossaryDicts = [
            {
                sourceLangCode: SOURCE_LANG,
                targetLangCode: TARGET_LANG,
                entries: new deepl.GlossaryEntries({
                    entries: { artist: 'Maler', prize: 'Gewinn' },
                }),
            },
        ];
        const createdGlossary: deepl.MultilingualGlossaryInfo =
            await deeplClient.createMultilingualGlossary(glossaryName, glossaryDicts);

        try {
            const translationResult = await deeplClient.translateText(
                inputText,
                SOURCE_LANG,
                TARGET_LANG,
                { glossary: createdGlossary },
            );
            expect(typeof translationResult.text).toBe('string');
            expect(translationResult.text.toLowerCase().includes('maler')).toBe(true);
            expect(translationResult.text.toLowerCase().includes('gewinn')).toBe(true);
        } finally {
            await deeplClient.deleteMultilingualGlossary(createdGlossary.glossaryId);
        }
    });

    withRealServer('testGlossaryTranslateTextBasic', async () => {
        const deeplClient = makeDeeplClient();
        const glossaryCleanup = new GlossaryCleanupUtility(
            deeplClient,
            'testGlossaryDictionaryDelete',
        );
        const glossaryName = glossaryCleanup.glossaryName;
        const inputTextEnDe = 'The knight is very strong.';
        const inputTextDeEn = 'Der Hund bellt.';
        // Glossaries are a soft hint to the model, not a hard replacement, so
        // the entries must force a plausible non-default target the model will
        // honor in context (e.g. Hund -> hound, default is "dog"). A term the
        // model strongly overrides (e.g. Läufer -> carpet) is not applied.
        const glossaryDicts = [
            {
                sourceLangCode: SOURCE_LANG,
                targetLangCode: TARGET_LANG,
                entries: new deepl.GlossaryEntries({ entries: { knight: 'Springer' } }),
            },
            {
                sourceLangCode: TARGET_LANG,
                targetLangCode: SOURCE_LANG,
                entries: new deepl.GlossaryEntries({ entries: { Hund: 'hound' } }),
            },
        ];
        const createdGlossary: deepl.MultilingualGlossaryInfo =
            await deeplClient.createMultilingualGlossary(glossaryName, glossaryDicts);

        try {
            const translationResultEnDe = await deeplClient.translateText(
                inputTextEnDe,
                SOURCE_LANG,
                TARGET_LANG,
                { glossary: createdGlossary },
            );
            expect(typeof translationResultEnDe.text).toBe('string');
            expect(translationResultEnDe.text.toLowerCase().includes('springer')).toBe(true);
            const translationResultDeEn = await deeplClient.translateText(
                inputTextDeEn,
                TARGET_LANG,
                'en-US',
                { glossary: createdGlossary },
            );
            expect(typeof translationResultDeEn.text).toBe('string');
            expect(translationResultDeEn.text.toLowerCase().includes('hound')).toBe(true);
            await expect(
                deeplClient.translateText(inputTextEnDe, null /* sourceLang */, TARGET_LANG, {
                    glossary: createdGlossary,
                }),
            ).rejects.toThrow(deepl.DeepLError);
            await expect(
                deeplClient.translateText(inputTextEnDe, 'es', TARGET_LANG, {
                    glossary: createdGlossary,
                }),
            ).rejects.toThrow(deepl.DeepLError);
        } finally {
            await deeplClient.deleteMultilingualGlossary(createdGlossary.glossaryId);
        }
    });
});
