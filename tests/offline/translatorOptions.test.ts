// Copyright 2025 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import * as deepl from 'deepl-node';

import nock from 'nock';

import { makeTranslator, serverUrl } from './client';

const usage = { character_count: 1, character_limit: 2 };

/** Declares GET /v2/usage, requiring the User-Agent header to satisfy `matches`. */
function expectUserAgent(matches: (userAgent: string) => boolean, host = serverUrl) {
    nock(host, { reqheaders: { 'user-agent': matches } })
        .get('/v2/usage')
        .reply(200, usage);
}

describe('Translator constructor', () => {
    it('throws DeepLError when the auth key is empty', () => {
        expect(() => new deepl.Translator('')).toThrow(/authKey.*empty/);
    });

    it('sends the auth key in the Authorization header', async () => {
        nock(serverUrl, { reqheaders: { authorization: 'DeepL-Auth-Key my-key' } })
            .get('/v2/usage')
            .reply(200, usage);

        await makeTranslator({ authKey: 'my-key' }).getUsage();
    });

    it('throws DeepLError when the auth key is only whitespace', () => {
        expect(() => new deepl.Translator(' \t\n')).toThrow(/authKey.*empty/);
    });

    it('trims the auth key', async () => {
        nock('https://api-free.deepl.com', {
            reqheaders: { authorization: 'DeepL-Auth-Key my-key:fx' },
        })
            .get('/v2/usage')
            .reply(200, usage);

        await new deepl.DeepLClient(' my-key:fx\n').getUsage();
    });

    it('exports isFreeAccountAuthKey', () => {
        expect(deepl.isFreeAccountAuthKey('my-key:fx')).toBe(true);
        expect(deepl.isFreeAccountAuthKey('my-key')).toBe(false);
    });

    it('sends requests to the API for free accounts when the auth key ends in :fx', async () => {
        nock('https://api-free.deepl.com').get('/v2/usage').reply(200, usage);

        await new deepl.Translator('my-key:fx').getUsage();
    });

    it('sends requests to the API for paid accounts when the auth key does not end in :fx', async () => {
        nock('https://api.deepl.com').get('/v2/usage').reply(200, usage);

        await new deepl.Translator('my-key').getUsage();
    });

    it('sends requests to serverUrl when it is set', async () => {
        nock('https://example.test').get('/v2/usage').reply(200, usage);

        await makeTranslator({ serverUrl: 'https://example.test' }).getUsage();
    });

    it('sends the configured headers with every request', async () => {
        nock(serverUrl, { reqheaders: { 'x-test': 'v', authorization: /^DeepL-Auth-Key/ } })
            .get('/v2/usage')
            .reply(200, usage);

        await makeTranslator({ headers: { 'X-Test': 'v' } }).getUsage();
    });
});

describe('Translator User-Agent', () => {
    const platformInfo = (userAgent: string) =>
        userAgent.startsWith('deepl-node/') &&
        userAgent.includes('(') &&
        userAgent.includes(' node/');
    const noPlatformInfo = (userAgent: string) =>
        userAgent.startsWith('deepl-node/') && !userAgent.includes('(');

    it('sends the library version and platform info by default', async () => {
        expectUserAgent(platformInfo);

        await makeTranslator().getUsage();
    });

    it('sends the platform info when sendPlatformInfo is true', async () => {
        expectUserAgent(platformInfo);

        await makeTranslator({ sendPlatformInfo: true }).getUsage();
    });

    it('sends no platform info when sendPlatformInfo is false', async () => {
        expectUserAgent(noPlatformInfo);

        await makeTranslator({ sendPlatformInfo: false }).getUsage();
    });

    it.each([[undefined], [true], [false]])(
        'appends appInfo when sendPlatformInfo is %s',
        async (sendPlatformInfo) => {
            expectUserAgent((userAgent) => userAgent.endsWith(' sampleCSApp/1.2.3'));

            await makeTranslator({
                sendPlatformInfo,
                appInfo: { appName: 'sampleCSApp', appVersion: '1.2.3' },
            }).getUsage();
        },
    );
});
