// Copyright 2025 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import * as deepl from 'deepl-node';

import nock from 'nock';

import { makeDeeplClient, makeTranslator, serverUrl } from './client';

describe('error mapping', () => {
    it.each([
        [400, deepl.DeepLError, 'Bad request, message: m, detail: d'],
        [403, deepl.AuthorizationError, 'Authorization failure, check auth_key, message: m'],
        [404, deepl.DeepLError, 'Not found, message: m'],
        [413, deepl.DeepLError, 'Unexpected status code: 413 Payload Too Large, message: m'],
        [429, deepl.TooManyRequestsError, 'Too many requests'],
        [456, deepl.QuotaExceededError, 'Quota for this billing period has been exceeded'],
        [500, deepl.DeepLError, 'Unexpected status code: 500 Internal Server Error'],
        [503, deepl.DeepLError, 'Service unavailable, message: m'],
    ])('throws for status %i', async (status, errorClass, message) => {
        nock(serverUrl).get('/v2/usage').reply(status, { message: 'm', detail: 'd' });

        const error = await makeTranslator({ maxRetries: 0 })
            .getUsage()
            .catch((e) => e);

        expect(error).toBeInstanceOf(errorClass);
        expect(error.message).toContain(message);
    });

    it('throws DeepLError with the raw body when the error body is not JSON', async () => {
        nock(serverUrl).get('/v2/usage').reply(400, 'plain text');

        await expect(makeTranslator().getUsage()).rejects.toThrow('Bad request, plain text');
    });

    it('throws GlossaryNotFoundError when a glossary request answers 404', async () => {
        nock(serverUrl).get('/v2/glossaries/g-1').reply(404, { message: 'm' });

        await expect(makeTranslator().getGlossary('g-1')).rejects.toThrow(
            deepl.GlossaryNotFoundError,
        );
    });

    it('throws DeepLError when the usage response is not valid JSON', async () => {
        nock(serverUrl).get('/v2/usage').reply(200, 'not json');

        await expect(makeTranslator().getUsage()).rejects.toThrow(/Error parsing response JSON/);
    });
});

    it.each<[string, string, string, (client: deepl.DeepLClient) => Promise<unknown>]>([
        [
            'source languages',
            '/v3/languages?resource=translate_text',
            'null',
            (c) => c.getSourceLanguages(),
        ],
        [
            'source languages',
            '/v3/languages?resource=translate_text',
            'not json',
            (c) => c.getSourceLanguages(),
        ],
        [
            'target languages',
            '/v3/languages?resource=translate_text',
            '{}',
            (c) => c.getTargetLanguages(),
        ],
        ['multilingual glossaries', '/v3/glossaries', '{}', (c) => c.listMultilingualGlossaries()],
        ['style rule', '/v3/style_rules/s-1', 'not json', (c) => c.getStyleRule('s-1')],
        ['spoken terms', '/v3/spoken-terms/t-1', 'null', (c) => c.getSpokenTerms('t-1')],
        ['style profile', '/v3/style_profiles/p-1', 'null', (c) => c.getStyleProfile('p-1')],
    ])('throws DeepLError for a malformed %s response at %s: %s', async (_, path, body, call) => {
        nock(serverUrl).get(path).reply(200, body, { 'Content-Type': 'text/plain' });

        const error = (await call(makeDeeplClient()).catch((e) => e)) as Error;

        expect(error).toBeInstanceOf(deepl.DeepLError);
        expect(error.message).toMatch(/Error parsing response JSON/);
    });
