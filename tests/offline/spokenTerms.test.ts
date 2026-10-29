// Copyright 2026 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import * as deepl from 'deepl-node';

import nock from 'nock';

import { makeDeeplClient, serverUrl } from './client';

const spokenTermsResponse = {
    spoken_terms_id: 'st-1',
    name: 'my terms',
    creation_time: '2026-10-23T17:15:53.434769Z',
    term_lists: [{ lang: 'en', entry_count: 1 }],
};

const expectedSpokenTerms = {
    spokenTermsId: 'st-1',
    name: 'my terms',
    creationTime: new Date('2026-10-23T17:15:53.434Z'),
    termLists: [{ lang: 'en', entryCount: 1 }],
};

describe('DeepLClient spoken terms', () => {
    it('joins entries with newlines in requests and splits them in responses', async () => {
        nock(serverUrl)
            .post('/v3/spoken-terms', {
                name: 'my terms',
                term_lists: [{ lang: 'en', entries: 'a\nb' }],
            })
            .reply(201, {
                spoken_terms_id: 'st-1',
                name: 'my terms',
                creation_time: '2026-10-23T17:15:53.434769Z',
                term_lists: [{ lang: 'en', entry_count: 2 }],
            });
        nock(serverUrl)
            .get('/v3/spoken-terms/st-1/entries')
            .query({ lang: 'en' })
            .reply(200, { lang: 'en', entries: 'a\nb\n' });

        const deeplClient = makeDeeplClient();
        const spokenTerms = await deeplClient.createSpokenTerms('my terms', [
            { lang: 'en', entries: ['a', 'b'] },
        ]);
        const entries = await deeplClient.getSpokenTermsEntries(spokenTerms, 'en');

        expect(spokenTerms).toEqual({
            spokenTermsId: 'st-1',
            name: 'my terms',
            creationTime: new Date('2026-10-23T17:15:53.434Z'),
            termLists: [{ lang: 'en', entryCount: 2 }],
        });
        expect(entries).toEqual({ lang: 'en', entries: ['a', 'b'] });
    });

    it('sends an empty body when updateSpokenTerms() has no options', async () => {
        nock(serverUrl).patch('/v3/spoken-terms/st-1', {}).reply(200, spokenTermsResponse);

        await expect(makeDeeplClient().updateSpokenTerms('st-1')).resolves.toEqual(
            expectedSpokenTerms,
        );
    });

    it('adds extraBodyParameters to the createSpokenTerms() body last', async () => {
        nock(serverUrl)
            .post('/v3/spoken-terms', {
                name: 'replaced',
                term_lists: [{ lang: 'en', entries: 'a' }],
                extra: 'x',
            })
            .reply(201, spokenTermsResponse);

        await makeDeeplClient().createSpokenTerms('my terms', [{ lang: 'en', entries: ['a'] }], {
            extraBodyParameters: { name: 'replaced', extra: 'x' },
        });
    });

    it('adds extraBodyParameters to the updateSpokenTerms() body last', async () => {
        nock(serverUrl)
            .patch('/v3/spoken-terms/st-1', { name: 'replaced', extra: 'x' })
            .reply(200, spokenTermsResponse);

        await makeDeeplClient().updateSpokenTerms('st-1', {
            name: 'my terms',
            extraBodyParameters: { name: 'replaced', extra: 'x' },
        });
    });

    it('adds extraBodyParameters to the replaceSpokenTermsList() body last', async () => {
        nock(serverUrl)
            .put('/v3/spoken-terms/st-1/term-lists', { lang: 'de', entries: 'a', extra: 'x' })
            .reply(200, { lang: 'de', entry_count: 1 });

        await makeDeeplClient().replaceSpokenTermsList(
            'st-1',
            { lang: 'en', entries: ['a'] },
            { extraBodyParameters: { lang: 'de', extra: 'x' } },
        );
    });

    it('rejects a term containing a newline before sending a request', async () => {
        // No nock interceptor: any request fails with a network error instead
        await expect(
            makeDeeplClient().createSpokenTerms('my terms', [{ lang: 'en', entries: ['a\nb'] }]),
        ).rejects.toThrow(
            new deepl.DeepLError("Term 'a\nb' contains invalid character: '\n' (10)"),
        );
    });
});
