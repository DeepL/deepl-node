// Copyright 2025 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import nock from 'nock';

import { WritingStyle, WritingTone } from '../../src/deeplClient';
import { ArgumentError } from '../../src/errors';
import { makeDeeplClient, serverUrl } from './client';

const rephrased = {
    improvements: [{ text: 'out', detected_source_language: 'DE', target_language: 'en-US' }],
};

describe('DeepLClient.rephraseText', () => {
    it('sends the text and parses the result', async () => {
        nock(serverUrl, { reqheaders: { authorization: 'DeepL-Auth-Key k' } })
            .post('/v2/write/rephrase', { text: 'abc' })
            .reply(200, rephrased);

        const result = await makeDeeplClient().rephraseText('abc');

        expect(result).toEqual({ text: 'out', detectedSourceLang: 'de', targetLang: 'en-US' });
    });

    it('sends the target language, writing style and tone', async () => {
        nock(serverUrl)
            .post('/v2/write/rephrase', {
                text: 'abc',
                target_lang: 'en',
                writing_style: 'business',
                tone: 'confident',
            })
            .reply(200, rephrased);

        await makeDeeplClient().rephraseText(
            'abc',
            'en',
            WritingStyle.BUSINESS,
            WritingTone.CONFIDENT,
        );
    });

    it.each([[null], [undefined], ['']])(
        'sends no writing style or tone when they are %p',
        async (empty) => {
            nock(serverUrl).post('/v2/write/rephrase', { text: 'abc' }).reply(200, rephrased);

            await makeDeeplClient().rephraseText('abc', null, empty, empty);
        },
    );

    it('sends the writing style, tone and extra body parameters of an options object', async () => {
        nock(serverUrl)
            .post('/v2/write/rephrase', {
                text: 'abc',
                target_lang: 'en',
                writing_style: 'business',
                tone: 'confident',
                extra: 'x',
            })
            .reply(200, rephrased);

        await makeDeeplClient().rephraseText('abc', 'en', {
            writingStyle: WritingStyle.BUSINESS,
            tone: WritingTone.CONFIDENT,
            extraRequestParameters: { extra: 'x' },
        });
    });

    it('sends the extraBodyParameters of an options object', async () => {
        nock(serverUrl)
            .post('/v2/write/rephrase', { text: 'abc', target_lang: 'en', extra: 'x' })
            .reply(200, rephrased);

        await makeDeeplClient().rephraseText('abc', 'en', {
            extraBodyParameters: { extra: 'x' },
        });
    });

    it('lets extra body parameters override built-in parameters', async () => {
        nock(serverUrl)
            .post('/v2/write/rephrase', { text: 'abc', target_lang: 'fr' })
            .reply(200, rephrased);

        await makeDeeplClient().rephraseText('abc', 'en', {
            extraRequestParameters: { target_lang: 'fr' },
        });
    });

    it('throws ArgumentError when an options object is combined with a tone argument', async () => {
        const client = makeDeeplClient();
        // The overloads reject this at compile time; JavaScript callers can still pass it
        const rephraseText = client.rephraseText.bind(client) as (
            ...args: unknown[]
        ) => Promise<unknown>;
        await expect(rephraseText('abc', 'en', {}, WritingTone.FRIENDLY)).rejects.toThrow(
            ArgumentError,
        );
    });

    it('sends every text of an array and returns an array of results', async () => {
        nock(serverUrl)
            .post('/v2/write/rephrase', { text: ['a', 'b'], target_lang: 'de' })
            .reply(200, {
                improvements: [
                    { text: 'A', detected_source_language: 'DE', target_language: 'de' },
                    { text: 'B', detected_source_language: 'DE', target_language: 'de' },
                ],
            });

        const results = await makeDeeplClient().rephraseText(['a', 'b'], 'de');

        expect(results).toHaveLength(2);
    });

    it('throws DeepLError when a text is empty', async () => {
        await expect(makeDeeplClient().rephraseText('')).rejects.toThrow(/texts parameter/);
    });
});
