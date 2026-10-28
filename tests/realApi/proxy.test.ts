// Copyright 2022 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import * as deepl from 'deepl-node';

import http from 'http';
import { AddressInfo } from 'net';
import { createProxy } from 'proxy';

import { makeTranslator } from './client';

describe('Translator proxy option', () => {
    it.each<[string, (port: number) => deepl.ProxyConfig | string]>([
        ['a ProxyConfig', (port) => ({ host: '127.0.0.1', port })],
        ['a proxy URL', (port) => `http://127.0.0.1:${port}`],
    ])('sends requests through the proxy configured as %s', async (_, proxy) => {
        const connectTargets: (string | undefined)[] = [];
        const server = createProxy(http.createServer());
        server.on('connect', (req) => connectTargets.push(req.url));
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
        try {
            const port = (server.address() as AddressInfo).port;

            const usage = await makeTranslator({ proxy: proxy(port) }).getUsage();

            expect(usage.toString()).toContain('Usage this billing period');
            const authKey = process.env.DEEPL_AUTH_KEY as string;
            const serverUrl = new URL(
                process.env.DEEPL_SERVER_URL ??
                    (authKey.endsWith(':fx')
                        ? 'https://api-free.deepl.com'
                        : 'https://api.deepl.com'),
            );
            expect(connectTargets).toEqual([`${serverUrl.hostname}:${serverUrl.port || 443}`]);
        } finally {
            server.close();
        }
    });
});
