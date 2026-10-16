// Copyright 2025 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import nock from 'nock';

import { WritingStyle, WritingTone } from '../../src/deeplClient';
import { makeOfflineDeeplClient, offlineServerUrl } from '../core';

const rephrased = {
    improvements: [{ text: 'out', detected_source_language: 'DE', target_language: 'en-US' }],
};

describe('DeepLClient.rephraseText', () => {
    it('sends the text and parses the result', async () => {
        nock(offlineServerUrl, { reqheaders: { authorization: 'DeepL-Auth-Key k' } })
            .post('/v2/write/rephrase', { text: 'abc' })
            .reply(200, rephrased);

        const result = await makeOfflineDeeplClient().rephraseText('abc');

        expect(result).toEqual({ text: 'out', detectedSourceLang: 'de', targetLang: 'en-US' });
    });

    it('sends the target language, writing style and tone', async () => {
        nock(offlineServerUrl)
            .post('/v2/write/rephrase', {
                text: 'abc',
                target_lang: 'en',
                writing_style: 'business',
                tone: 'confident',
            })
            .reply(200, rephrased);

        await makeOfflineDeeplClient().rephraseText(
            'abc',
            'en',
            WritingStyle.BUSINESS,
            WritingTone.CONFIDENT,
        );
    });

    it.each([[null], [undefined], ['']])(
        'sends no writing style or tone when they are %p',
        async (empty) => {
            nock(offlineServerUrl)
                .post('/v2/write/rephrase', { text: 'abc' })
                .reply(200, rephrased);

            await makeOfflineDeeplClient().rephraseText('abc', null, empty, empty);
        },
    );

    it('sends every text of an array and returns one result per text', async () => {
        nock(offlineServerUrl)
            .post('/v2/write/rephrase', { text: ['a', 'b'], target_lang: 'de' })
            .reply(200, {
                improvements: [
                    { text: 'A', detected_source_language: 'DE', target_language: 'de' },
                    { text: 'B', detected_source_language: 'DE', target_language: 'de' },
                ],
            });

        const results = await makeOfflineDeeplClient().rephraseText(['a', 'b'], 'de');

        expect(results.map((result) => result.text)).toEqual(['A', 'B']);
    });

    it('throws DeepLError when a text is empty', async () => {
        await expect(makeOfflineDeeplClient().rephraseText('')).rejects.toThrow(/texts parameter/);
    });
});
