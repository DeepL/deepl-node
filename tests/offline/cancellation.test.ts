// Copyright 2026 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import * as deepl from 'deepl-node';

import fs from 'fs';
import nock from 'nock';
import os from 'os';
import path from 'path';
import { Readable } from 'stream';

import { makeAdminClient, makeDeeplClient, serverUrl } from './client';

const handle = { documentId: 'doc-id', documentKey: 'doc-key' };
const keyBody = { document_key: handle.documentKey };

/** Returns an AbortController that aborts with the returned reason after the given delay. */
function abortAfter(ms: number): { signal: AbortSignal; reason: Error } {
    const controller = new AbortController();
    const reason = new Error('cancelled by caller');
    // The pinned @types/node does not declare the reason parameter; Node.js >= 17.2 supports it.
    setTimeout(() => (controller.abort as (reason?: unknown) => void).call(controller, reason), ms);
    return { signal: controller.signal, reason };
}

describe('signal option', () => {
    it('rejects with the abort reason, unwrapped, when the request in flight is aborted', async () => {
        nock(serverUrl).get('/v2/usage').delay(2000).reply(200, { character_count: 1 });
        const { signal, reason } = abortAfter(50);

        const error = await makeDeeplClient()
            .getUsage({ signal })
            .catch((e) => e);

        expect(error).toBe(reason);
    });

    it('rejects without sending a request when the signal is already aborted', async () => {
        const controller = new AbortController();
        controller.abort();

        const error = await makeDeeplClient()
            .getGlossary('glossary-id', { signal: controller.signal })
            .catch((e) => e);

        expect(error.name).toBe('AbortError');
        expect(error).not.toBeInstanceOf(deepl.DeepLError);
    });

    it('stops retrying when aborted during the backoff sleep', async () => {
        nock(serverUrl).post('/v2/translate').reply(503);
        const { signal, reason } = abortAfter(100);
        const started = Date.now();

        const error = await makeDeeplClient()
            .translateText('Hello', null, 'de', { signal })
            .catch((e) => e);

        expect(error).toBe(reason);
        expect(Date.now() - started).toBeLessThan(900);
    });

    it('cancels the DeepLAdminClient request in flight', async () => {
        nock(serverUrl).get('/v2/admin/developer-keys').delay(2000).reply(200, []);
        const { signal, reason } = abortAfter(50);

        const error = await makeAdminClient()
            .listDeveloperKeys({ signal })
            .catch((e) => e);

        expect(error).toBe(reason);
    });

    it('cancels translateDocumentWaitUntilDone between status checks', async () => {
        nock(serverUrl).post('/v2/document/doc-id', keyBody).reply(200, { status: 'queued' });
        const { signal, reason } = abortAfter(100);
        const started = Date.now();

        const error = await makeDeeplClient()
            .translateDocumentWaitUntilDone(handle, { signal })
            .catch((e) => e);

        expect(error).toBe(reason);
        expect(Date.now() - started).toBeLessThan(4000);
    });

    it('rejects translateDocument with the abort reason, not a DocumentTranslationError', async () => {
        nock(serverUrl)
            .post('/v2/document')
            .reply(200, { document_id: handle.documentId, document_key: handle.documentKey });
        nock(serverUrl).post('/v2/document/doc-id', keyBody).reply(200, { status: 'queued' });
        const outputFile = path.join(
            fs.mkdtempSync(path.join(os.tmpdir(), 'deepl-node-')),
            'out.txt',
        );
        const { signal, reason } = abortAfter(100);

        const error = await makeDeeplClient()
            .translateDocument(Buffer.from('Hello'), outputFile, null, 'de', {
                filename: 'in.txt',
                signal,
            })
            .catch((e) => e);

        expect(error).toBe(reason);
        expect(fs.existsSync(outputFile)).toBe(false);
    });

    it('cancels a download in progress with the abort reason', async () => {
        let sent = false;
        const body = new Readable({
            read() {
                // Sends one chunk, then stalls like a slow connection.
                if (!sent) this.push('partial');
                sent = true;
            },
        });
        nock(serverUrl)
            .post('/v2/document/doc-id/result', keyBody)
            .reply(200, () => body);
        const outputFile = path.join(
            fs.mkdtempSync(path.join(os.tmpdir(), 'deepl-node-')),
            'out.txt',
        );
        const { signal, reason } = abortAfter(100);

        const error = await makeDeeplClient()
            .translateDocumentDownload(handle, outputFile, { signal })
            .catch((e) => e);

        expect(error).toBe(reason);
        expect(fs.existsSync(outputFile)).toBe(false);
    });
});
