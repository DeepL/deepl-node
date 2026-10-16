// Copyright 2025 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import * as deepl from 'deepl-node';

import log from 'loglevel';
import nock from 'nock';

import { RETRYABLE_AXIOS_ERROR_CODES } from '../../src/client';
import { makeDeeplClient, makeTranslator, serverUrl } from './client';
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

        await makeTranslator().getUsage();
    });

    it('retries when the connection is reset', async () => {
        nock(serverUrl).get('/v2/usage').replyWithError({ code: 'ECONNRESET' });
        nock(serverUrl).get('/v2/usage').reply(200, usage);

        await makeTranslator().getUsage();
    });

    it('does not retry when the connection is refused', async () => {
        nock(serverUrl).get('/v2/usage').replyWithError({ code: 'ECONNREFUSED' });

        await expect(makeTranslator().getUsage()).rejects.toThrow(deepl.ConnectionError);
    });

    it('does not retry when maxRetries is 0', async () => {
        nock(serverUrl).get('/v2/usage').reply(500);

        await expect(makeTranslator({ maxRetries: 0 }).getUsage()).rejects.toThrow(
            /Unexpected status code: 500/,
        );
    });

    it('throws ConnectionError when the server does not answer in time', async () => {
        // Never answers: a delayed reply would leave a timer running past the end of the test
        nock(serverUrl)
            .get('/v2/usage')
            .reply(() => new Promise(() => undefined));

        await expect(makeTranslator({ maxRetries: 0, minTimeout: 200 }).getUsage()).rejects.toThrow(
            deepl.ConnectionError,
        );
    });

    it.each([['ETIMEDOUT'], ['ECONNABORTED'], ['ECONNRESET'], ['EPIPE'], ['EAI_AGAIN']])(
        'classifies axios error code %s as retryable',
        (code) => {
            expect(RETRYABLE_AXIOS_ERROR_CODES.has(code)).toBe(true);
        },
    );

    it.each([['ENOTFOUND'], ['ECONNREFUSED'], ['CERT_HAS_EXPIRED']])(
        'classifies axios error code %s as not retryable',
        (code) => {
            expect(RETRYABLE_AXIOS_ERROR_CODES.has(code)).toBe(false);
        },
    );
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

        await makeTranslator().translateText(inputText.en, null, 'de');

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
