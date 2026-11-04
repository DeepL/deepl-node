// Copyright 2025 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import * as deepl from 'deepl-node';

import log from 'loglevel';
import nock from 'nock';

import { HttpClient, RETRYABLE_AXIOS_ERROR_CODES } from '../../src/client';
import { makeDeeplClient, serverUrl } from './client';
import { inputText } from '../fixtures';

jest.mock('loglevel', () => ({
    debug: jest.fn(),
    getLogger: jest.fn().mockReturnValue({
        setLevel: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
    }),
}));

const usage = { character_count: 1, character_limit: 2 };

describe('HttpClient retries', () => {
    it.each([[429], [500], [503]])('retries when the server answers %i', async (status) => {
        nock(serverUrl).get('/v2/usage').reply(status);
        nock(serverUrl).get('/v2/usage').reply(200, usage);

        await makeDeeplClient().getUsage();
    });

    it('retries when the connection is reset', async () => {
        nock(serverUrl).get('/v2/usage').replyWithError({ code: 'ECONNRESET' });
        nock(serverUrl).get('/v2/usage').reply(200, usage);

        await makeDeeplClient().getUsage();
    });

    it.each([['ECONNREFUSED'], ['ENOTFOUND'], ['EHOSTUNREACH'], ['ENETUNREACH'], ['ENETDOWN']])(
        'retries after the network error %s',
        async (code) => {
            nock(serverUrl).get('/v2/usage').replyWithError({ code });
            nock(serverUrl).get('/v2/usage').reply(200, usage);

            await makeDeeplClient().getUsage();
        },
    );

    it('does not retry a non-transient network error', async () => {
        nock(serverUrl).get('/v2/usage').replyWithError({ code: 'CERT_HAS_EXPIRED' });

        const error = await makeDeeplClient()
            .getUsage()
            .catch((e) => e);

        expect(error).toBeInstanceOf(deepl.ConnectionError);
        expect(error.shouldRetry).toBe(false);
    });

    it('makes maxRetries retries after the first attempt', async () => {
        const scope = nock(serverUrl).get('/v2/usage').times(2).reply(500);
        nock(serverUrl).get('/v2/usage').reply(200, usage);

        await makeDeeplClient({ maxRetries: 2 }).getUsage();
        expect(scope.isDone()).toBe(true);
    });

    it('uses a per-attempt timeout of 10 seconds by default', async () => {
        const prepareRequest = jest.spyOn(HttpClient.prototype, 'prepareRequest');
        nock(serverUrl).get('/v2/usage').reply(200, usage);

        await makeDeeplClient().getUsage();

        expect(prepareRequest.mock.calls[0][2]).toBe(10000);
        prepareRequest.mockRestore();
    });

    it('does not retry when maxRetries is 0', async () => {
        nock(serverUrl).get('/v2/usage').reply(500);

        await expect(makeDeeplClient({ maxRetries: 0 }).getUsage()).rejects.toThrow(
            /Unexpected status code: 500/,
        );
    });

    it('throws ConnectionError when the server does not answer in time', async () => {
        // Never answers: a delayed reply would leave a timer running past the end of the test
        nock(serverUrl)
            .get('/v2/usage')
            .reply(() => new Promise(() => undefined));

        await expect(
            makeDeeplClient({ maxRetries: 0, minTimeout: 200 }).getUsage(),
        ).rejects.toThrow(deepl.ConnectionError);
    });

    it.each([
        ['ETIMEDOUT'],
        ['ECONNABORTED'],
        ['ECONNRESET'],
        ['EPIPE'],
        ['EAI_AGAIN'],
        ['ENOTFOUND'],
        ['ECONNREFUSED'],
        ['EHOSTUNREACH'],
        ['ENETUNREACH'],
        ['ENETDOWN'],
    ])('classifies axios error code %s as retryable', (code) => {
        expect(RETRYABLE_AXIOS_ERROR_CODES.has(code)).toBe(true);
    });

    it.each([['CERT_HAS_EXPIRED']])('classifies axios error code %s as not retryable', (code) => {
        expect(RETRYABLE_AXIOS_ERROR_CODES.has(code)).toBe(false);
    });
});

describe('HttpClient debug logging', () => {
    const debug = log.getLogger('deepl').debug;

    beforeEach(() => {
        jest.clearAllMocks();
        log.getLogger('deepl').setLevel('debug');
    });

    function expectRequestTraceAndResponseLogged() {
        expect(debug).toHaveBeenCalledTimes(3);
        expect(debug).toHaveBeenNthCalledWith(1, expect.stringContaining('Request details:'));
        expect(debug).toHaveBeenNthCalledWith(
            2,
            expect.stringContaining('Trace details:, xTraceId = trace-1'),
        );
        expect(debug).toHaveBeenNthCalledWith(
            3,
            expect.stringContaining('Response details:, content = '),
        );
    }

    it('logs request, trace and response details of translateText', async () => {
        nock(serverUrl)
            .post('/v2/translate')
            .reply(
                200,
                {
                    translations: [
                        { detected_source_language: 'EN', text: 'a', billed_characters: 1 },
                    ],
                },
                { 'x-trace-id': 'trace-1' },
            );

        await makeDeeplClient().translateText(inputText.en, null, 'de');

        expectRequestTraceAndResponseLogged();
    });

    it('logs request, trace and response details of rephraseText', async () => {
        nock(serverUrl)
            .post('/v2/write/rephrase')
            .reply(
                200,
                {
                    improvements: [
                        { text: 'a', detected_source_language: 'de', target_language: 'de' },
                    ],
                },
                { 'x-trace-id': 'trace-1' },
            );

        await makeDeeplClient().rephraseText(inputText.de, 'de');

        expectRequestTraceAndResponseLogged();
    });
});

describe('Create retries', () => {
    const entries = new deepl.GlossaryEntries({ entries: { a: 'b' } });

    it('does not retry a document upload after a server error', async () => {
        const scope = nock(serverUrl).post('/v2/document').reply(500).persist();
        let requests = 0;
        scope.on('request', () => requests++);

        const error = await makeDeeplClient()
            .translateDocumentUpload(Buffer.from('x'), null, 'de', { filename: 'a.txt' })
            .catch((e) => e);

        expect(error).toBeInstanceOf(deepl.DeepLError);
        expect(error.shouldRetry).toBe(false);
        expect(requests).toBe(1);
    });

    it.each<[string, (client: deepl.DeepLClient) => Promise<unknown>]>([
        ['/v2/glossaries', (c) => c.createGlossary('g', 'en', 'de', entries)],
        [
            '/v3/glossaries',
            (c) =>
                c.createMultilingualGlossary('g', [
                    { sourceLangCode: 'en', targetLangCode: 'de', entries },
                ]),
        ],
        ['/v3/glossaries', (c) => c.createMultilingualGlossaryFromCsv('g', 'en', 'de', 'a,b')],
        ['/v3/spoken-terms', (c) => c.createSpokenTerms('s', [{ lang: 'en', entries: ['a'] }])],
        ['/v3/translation_memories/import', (c) => c.createTranslationMemoryImport('a.tmx', 1)],
        ['/v3/translation_memories/tm-1/export', (c) => c.createTranslationMemoryExport('tm-1')],
        ['/v3/style_rules', (c) => c.createStyleRule('r', 'en')],
        [
            '/v3/style_rules/s-1/custom_instructions',
            (c) => c.createStyleRuleCustomInstruction('s-1', 'l', 'p'),
        ],
        ['/v3/style_profiles', (c) => c.createStyleProfile('p')],
    ])('does not retry POST %s after a server error', async (path, create) => {
        const scope = nock(serverUrl).post(path).reply(500).persist();
        let requests = 0;
        scope.on('request', () => requests++);

        const error = (await create(makeDeeplClient()).catch((e) => e)) as deepl.DeepLError;

        expect(error).toBeInstanceOf(deepl.DeepLError);
        expect(error.shouldRetry).toBe(false);
        expect(requests).toBe(1);
    });

    it('does not retry a create after a connection reset', async () => {
        const scope = nock(serverUrl)
            .post('/v3/style_profiles')
            .replyWithError({ code: 'ECONNRESET' })
            .persist();
        let requests = 0;
        scope.on('request', () => requests++);

        const error = await makeDeeplClient()
            .createStyleProfile('p')
            .catch((e) => e);

        expect(error).toBeInstanceOf(deepl.ConnectionError);
        expect(error.shouldRetry).toBe(false);
        expect(requests).toBe(1);
    });
});
