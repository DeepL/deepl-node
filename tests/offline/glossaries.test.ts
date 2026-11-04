// Copyright 2022 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import * as deepl from 'deepl-node';

import nock from 'nock';

import { makeDeeplClient, serverUrl } from './client';

const glossaryReply = {
    glossary_id: 'g-1',
    name: 'my glossary',
    ready: true,
    source_lang: 'en',
    target_lang: 'de',
    creation_time: '2021-08-03T14:16:18.329Z',
    entry_count: 2,
};

describe('DeepLClient.createGlossary', () => {
    it('sends the name, base languages and TSV entries as JSON and parses the glossary', async () => {
        nock(serverUrl, {
            reqheaders: { authorization: 'DeepL-Auth-Key k', 'content-type': /application\/json/ },
        })
            .post('/v2/glossaries', {
                name: 'my glossary',
                source_lang: 'en',
                target_lang: 'de',
                entries_format: 'tsv',
                entries: 'Apple\tApfel\nBanana\tBanane',
            })
            .reply(201, glossaryReply);

        const glossary = await makeDeeplClient().createGlossary(
            'my glossary',
            <deepl.LanguageCode>'EN-US',
            <deepl.LanguageCode>'de-DE',
            new deepl.GlossaryEntries({ entries: { Apple: 'Apfel', Banana: 'Banane' } }),
        );

        expect(glossary).toEqual({
            glossaryId: 'g-1',
            name: 'my glossary',
            ready: true,
            sourceLang: 'en',
            targetLang: 'de',
            creationTime: new Date('2021-08-03T14:16:18.329Z'),
            entryCount: 2,
        });
    });

    it('throws ArgumentError when the name is empty', async () => {
        await expect(
            makeDeeplClient().createGlossary(
                '',
                'en',
                'de',
                new deepl.GlossaryEntries({ entries: { a: 'b' } }),
            ),
        ).rejects.toThrow(deepl.ArgumentError);
    });

    it('throws ArgumentError when there are no entries', async () => {
        await expect(
            makeDeeplClient().createGlossary('n', 'en', 'de', new deepl.GlossaryEntries()),
        ).rejects.toThrow(deepl.ArgumentError);
    });
});

describe('DeepLClient.createGlossaryWithCsv', () => {
    it('sends the CSV content with entries_format csv', async () => {
        const csv = 'sourceEntry1,targetEntry1,en,de\n"source""Entry","target,Entry",en,de';
        nock(serverUrl)
            .post('/v2/glossaries', {
                name: 'my glossary',
                source_lang: 'en',
                target_lang: 'de',
                entries_format: 'csv',
                entries: csv,
            })
            .reply(201, {});

        await makeDeeplClient().createGlossaryWithCsv('my glossary', 'en', 'de', Buffer.from(csv));
    });
});

describe('DeepLClient.getGlossary', () => {
    it('sends GET for the glossary ID', async () => {
        nock(serverUrl).get('/v2/glossaries/g-1').reply(200, {});

        await makeDeeplClient().getGlossary('g-1');
    });

    it('throws GlossaryNotFoundError when the glossary does not exist', async () => {
        nock(serverUrl).get('/v2/glossaries/g-1').reply(404, { message: 'not found' });

        await expect(makeDeeplClient().getGlossary('g-1')).rejects.toThrow(
            deepl.GlossaryNotFoundError,
        );
    });
});

describe('DeepLClient.listGlossaries', () => {
    it('parses the glossaries of the response', async () => {
        nock(serverUrl)
            .get('/v2/glossaries')
            .reply(200, { glossaries: [glossaryReply, { ...glossaryReply, glossary_id: 'g-2' }] });

        const glossaries = await makeDeeplClient().listGlossaries();

        expect(glossaries).toHaveLength(2);
    });
});

describe('DeepLClient.getGlossaryEntries', () => {
    it.each([
        ['a glossary ID', 'g-1'],
        ['a GlossaryInfo', <deepl.GlossaryInfo>{ glossaryId: 'g-1' }],
    ])('requests the entries of %s and parses the TSV response', async (_, glossary) => {
        nock(serverUrl)
            .get('/v2/glossaries/g-1/entries')
            .reply(200, 'Apple\tApfel\nBanana\tBanane\n');

        const entries = await makeDeeplClient().getGlossaryEntries(glossary);

        expect(entries.entries()).toEqual({ Apple: 'Apfel', Banana: 'Banane' });
    });
});

describe('DeepLClient.deleteGlossary', () => {
    it.each([
        ['a glossary ID', 'g-1'],
        ['a GlossaryInfo', <deepl.GlossaryInfo>{ glossaryId: 'g-1' }],
    ])('sends DELETE for %s', async (_, glossary) => {
        nock(serverUrl).delete('/v2/glossaries/g-1').reply(204);

        await makeDeeplClient().deleteGlossary(glossary);
    });
});
