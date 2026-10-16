// Copyright 2025 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import * as deepl from 'deepl-node';

import nock from 'nock';

import { makeDeeplClient, serverUrl } from './client';

const glossaryReply = {
    glossary_id: 'g-1',
    name: 'my glossary',
    creation_time: '2021-08-03T14:16:18.329Z',
    dictionaries: [
        { source_lang: 'en', target_lang: 'de', entry_count: 2 },
        { source_lang: 'en', target_lang: 'fr', entry_count: 1 },
    ],
};

const parsedDictionaries = [
    { sourceLangCode: 'en', targetLangCode: 'de', entryCount: 2 },
    { sourceLangCode: 'en', targetLangCode: 'fr', entryCount: 1 },
];

const entries = new deepl.GlossaryEntries({ entries: { a: 'b' } });

describe('DeepLClient.createMultilingualGlossary', () => {
    it('sends the name and every dictionary with TSV entries and parses the glossary', async () => {
        nock(serverUrl)
            .post('/v3/glossaries', {
                name: 'my glossary',
                'dictionaries[0].source_lang': 'en',
                'dictionaries[0].target_lang': 'de',
                'dictionaries[0].entries': 'Apple\tApfel\nBanana\tBanane',
                'dictionaries[0].entries_format': 'tsv',
                'dictionaries[1].source_lang': 'en',
                'dictionaries[1].target_lang': 'fr',
                'dictionaries[1].entries': 'Apple\tPomme',
                'dictionaries[1].entries_format': 'tsv',
            })
            .reply(201, glossaryReply);

        const glossary = await makeDeeplClient().createMultilingualGlossary('my glossary', [
            {
                sourceLangCode: 'en',
                targetLangCode: 'de',
                entries: new deepl.GlossaryEntries({
                    entries: { Apple: 'Apfel', Banana: 'Banane' },
                }),
            },
            {
                sourceLangCode: 'en',
                targetLangCode: 'fr',
                entries: new deepl.GlossaryEntries({ entries: { Apple: 'Pomme' } }),
            },
        ]);

        expect(glossary.dictionaries).toEqual(parsedDictionaries);
    });
});

describe('DeepLClient.updateMultilingualGlossaryDictionary', () => {
    it('sends the dictionary with PATCH and parses the glossary', async () => {
        nock(serverUrl)
            .patch('/v3/glossaries/g-1', {
                'dictionaries[0].source_lang': 'en',
                'dictionaries[0].target_lang': 'de',
                'dictionaries[0].entries': 'Apple\tApfel',
                'dictionaries[0].entries_format': 'tsv',
            })
            .reply(200, glossaryReply);

        const glossary = await makeDeeplClient().updateMultilingualGlossaryDictionary('g-1', {
            sourceLangCode: 'en',
            targetLangCode: 'de',
            entries: new deepl.GlossaryEntries({ entries: { Apple: 'Apfel' } }),
        });

        expect(glossary.glossaryId).toBe('g-1');
    });
});

describe('DeepLClient.replaceMultilingualGlossaryDictionary', () => {
    it('sends the dictionary with PUT and parses the dictionary info', async () => {
        nock(serverUrl)
            .put('/v3/glossaries/g-1/dictionaries', {
                source_lang: 'en',
                target_lang: 'de',
                entries: 'Apple\tApfel',
                entries_format: 'tsv',
            })
            .reply(200, { source_lang: 'en', target_lang: 'de', entry_count: 1 });

        const dictionary = await makeDeeplClient().replaceMultilingualGlossaryDictionary('g-1', {
            sourceLangCode: 'en',
            targetLangCode: 'de',
            entries: new deepl.GlossaryEntries({ entries: { Apple: 'Apfel' } }),
        });

        expect(dictionary).toEqual({ sourceLangCode: 'en', targetLangCode: 'de', entryCount: 1 });
    });
});

describe('DeepLClient.createMultilingualGlossaryWithCsv', () => {
    it('sends the CSV content with entries_format csv and parses the glossary', async () => {
        const csv = 'sourceEntry1,targetEntry1\n"source""Entry","target,Entry"';
        nock(serverUrl)
            .post('/v3/glossaries', {
                name: 'my glossary',
                'dictionaries[0].source_lang': 'en',
                'dictionaries[0].target_lang': 'de',
                'dictionaries[0].entries': csv,
                'dictionaries[0].entries_format': 'csv',
            })
            .reply(201, glossaryReply);

        const glossary = await makeDeeplClient().createMultilingualGlossaryWithCsv(
            'my glossary',
            'en',
            'de',
            csv,
        );

        expect(glossary.glossaryId).toBe('g-1');
        expect(glossary.dictionaries).toEqual(parsedDictionaries);
    });
});

describe('DeepLClient.getMultilingualGlossary', () => {
    it('requests the glossary by ID and parses its dictionaries', async () => {
        nock(serverUrl, { reqheaders: { authorization: 'DeepL-Auth-Key k' } })
            .get('/v3/glossaries/g-1')
            .reply(200, glossaryReply);

        const glossary = await makeDeeplClient().getMultilingualGlossary('g-1');

        expect(glossary).toEqual({
            glossaryId: 'g-1',
            name: 'my glossary',
            creationTime: new Date('2021-08-03T14:16:18.329Z'),
            dictionaries: parsedDictionaries,
        });
    });

    it('throws GlossaryNotFoundError when the glossary does not exist', async () => {
        nock(serverUrl).get('/v3/glossaries/g-1').reply(404, { message: 'not found' });

        await expect(makeDeeplClient().getMultilingualGlossary('g-1')).rejects.toThrow(
            deepl.GlossaryNotFoundError,
        );
    });

    it('throws ArgumentError when the glossary ID is empty', async () => {
        await expect(makeDeeplClient().getMultilingualGlossary('')).rejects.toThrow(
            deepl.ArgumentError,
        );
    });
});

describe('DeepLClient.listMultilingualGlossaries', () => {
    it('parses every glossary of the response', async () => {
        nock(serverUrl)
            .get('/v3/glossaries')
            .reply(200, {
                glossaries: [
                    glossaryReply,
                    { ...glossaryReply, glossary_id: 'g-2', dictionaries: [] },
                ],
            });

        const glossaries = await makeDeeplClient().listMultilingualGlossaries();

        expect(glossaries.map((glossary) => glossary.glossaryId)).toEqual(['g-1', 'g-2']);
        expect(glossaries[0].dictionaries).toEqual(parsedDictionaries);
        expect(glossaries[1].dictionaries).toEqual([]);
    });
});

describe('DeepLClient.getMultilingualGlossaryDictionaryEntries', () => {
    it.each([
        ['a glossary ID', 'g-1'],
        ['a MultilingualGlossaryInfo', <deepl.MultilingualGlossaryInfo>{ glossaryId: 'g-1' }],
    ])('sends the language pair as query for %s and parses the entries', async (_, glossary) => {
        nock(serverUrl)
            .get('/v3/glossaries/g-1/entries')
            .query({ source_lang: 'en', target_lang: 'de' })
            .reply(200, {
                dictionaries: [
                    {
                        source_lang: 'en',
                        target_lang: 'de',
                        entries: 'Apple\tApfel\nBanana\tBanane',
                        entries_format: 'tsv',
                    },
                ],
            });

        const dictionary = await makeDeeplClient().getMultilingualGlossaryDictionaryEntries(
            glossary,
            'en',
            'de',
        );

        expect(dictionary.sourceLangCode).toBe('en');
        expect(dictionary.targetLangCode).toBe('de');
        expect(dictionary.entries.entries()).toEqual({ Apple: 'Apfel', Banana: 'Banane' });
    });

    it('throws GlossaryNotFoundError when the response has no dictionary', async () => {
        nock(serverUrl)
            .get('/v3/glossaries/g-1/entries')
            .query(true)
            .reply(200, { dictionaries: [] });

        await expect(
            makeDeeplClient().getMultilingualGlossaryDictionaryEntries('g-1', 'en', 'de'),
        ).rejects.toThrow(deepl.GlossaryNotFoundError);
    });

    it.each([
        ['glossary', ['', 'en', 'de']],
        ['sourceLanguageCode', ['g-1', '', 'de']],
        ['targetLanguageCode', ['g-1', 'en', '']],
    ])('throws ArgumentError when %s is empty', async (_, [glossary, source, target]) => {
        await expect(
            makeDeeplClient().getMultilingualGlossaryDictionaryEntries(glossary, source, target),
        ).rejects.toThrow(deepl.ArgumentError);
    });
});

describe('DeepLClient.deleteMultilingualGlossary', () => {
    it.each([
        ['a glossary ID', 'g-1'],
        ['a MultilingualGlossaryInfo', <deepl.MultilingualGlossaryInfo>{ glossaryId: 'g-1' }],
    ])('sends DELETE for %s', async (_, glossary) => {
        nock(serverUrl).delete('/v3/glossaries/g-1').reply(204);

        await makeDeeplClient().deleteMultilingualGlossary(glossary);
    });

    it('throws Error when the glossary ID is empty', async () => {
        await expect(makeDeeplClient().deleteMultilingualGlossary('')).rejects.toThrow(
            'glossaryId must not be empty',
        );
    });
});

describe('DeepLClient.deleteMultilingualGlossaryDictionary', () => {
    it('sends DELETE with the language pair as query', async () => {
        nock(serverUrl)
            .delete('/v3/glossaries/g-1/dictionaries')
            .query({ source_lang: 'en', target_lang: 'de' })
            .reply(204);

        await makeDeeplClient().deleteMultilingualGlossaryDictionary('g-1', 'en', 'de');
    });

    it.each([
        ['glossary', ['', 'en', 'de']],
        ['sourceLanguageCode', ['g-1', '', 'de']],
        ['targetLanguageCode', ['g-1', 'en', '']],
    ])('throws ArgumentError when %s is empty', async (_, [glossary, source, target]) => {
        await expect(
            makeDeeplClient().deleteMultilingualGlossaryDictionary(glossary, source, target),
        ).rejects.toThrow(deepl.ArgumentError);
    });
});

describe('DeepLClient glossary methods that validate their arguments', () => {
    const dictionary = { sourceLangCode: 'en', targetLangCode: 'de', entries };
    const client = () => makeDeeplClient();

    it.each([
        ['createMultilingualGlossary', () => client().createMultilingualGlossary('', [dictionary])],
        [
            'createMultilingualGlossaryWithCsv',
            () => client().createMultilingualGlossaryWithCsv('n', 'en', 'de', ''),
        ],
        [
            'updateMultilingualGlossaryName',
            () => client().updateMultilingualGlossaryName('g-1', ''),
        ],
        [
            'updateMultilingualGlossaryDictionary',
            () => client().updateMultilingualGlossaryDictionary('', dictionary),
        ],
        [
            'updateMultilingualGlossaryDictionaryWithCsv',
            () => client().updateMultilingualGlossaryDictionaryWithCsv('g-1', 'en', '', 'a,b'),
        ],
        [
            'replaceMultilingualGlossaryDictionary',
            () => client().replaceMultilingualGlossaryDictionary('', dictionary),
        ],
        [
            'replaceMultilingualGlossaryDictionaryWithCsv',
            () => client().replaceMultilingualGlossaryDictionaryWithCsv('g-1', 'en', 'de', ''),
        ],
    ])('%s throws ArgumentError for an empty argument', async (_, call) => {
        await expect(call()).rejects.toThrow(deepl.ArgumentError);
    });
});
