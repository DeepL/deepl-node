// Copyright 2025 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import nock from 'nock';

import { makeDeeplClient, serverUrl } from './client';

const corrected = {
    improvements: [{ text: 'out', detected_source_language: 'DE', target_language: 'de' }],
};

describe('DeepLClient.correctText', () => {
    it('sends the text and parses the result', async () => {
        nock(serverUrl, { reqheaders: { authorization: 'DeepL-Auth-Key k' } })
            .post('/v2/write/correct', { text: 'abc' })
            .reply(200, corrected);

        const result = await makeDeeplClient().correctText('abc');

        expect(result).toEqual({ text: 'out', detectedSourceLang: 'de', targetLang: 'de' });
    });

    it('sends the target language', async () => {
        nock(serverUrl)
            .post('/v2/write/correct', { text: 'abc', target_lang: 'de' })
            .reply(200, corrected);

        await makeDeeplClient().correctText('abc', 'de');
    });

    it('sends every text of an array and returns one result per text', async () => {
        nock(serverUrl)
            .post('/v2/write/correct', { text: ['a', 'b'] })
            .reply(200, {
                improvements: [
                    { text: 'A', detected_source_language: 'DE', target_language: 'de' },
                    { text: 'B', detected_source_language: 'DE', target_language: 'de' },
                ],
            });

        const results = await makeDeeplClient().correctText(['a', 'b']);

        expect(results.map((result) => result.text)).toEqual(['A', 'B']);
    });

    it('throws DeepLError when a text is empty', async () => {
        await expect(makeDeeplClient().correctText('', 'de')).rejects.toThrow(/non-empty string/);
    });
});
