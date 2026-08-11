// Copyright 2025 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.
import fs from 'fs';
import * as deepl from '../src';
import os from 'os';
import path from 'path';
import {
    exampleText,
    makeDeeplClient,
    makeTranslator,
    tempFiles,
    testTimeout,
    withMockServer,
} from './core';

const EXAMPLE_TMX =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<tmx version="1.4"><body>' +
    '<tu><tuv xml:lang="de"><seg>Hallo</seg></tuv>' +
    '<tuv xml:lang="en"><seg>Hello</seg></tuv></tu>' +
    '</body></tmx>\n';

/** Writes an example TMX file into a fresh temp directory and returns its path. */
function tempTmxFile(): string {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deepl-node-tm-test-'));
    const tmxPath = path.join(tempDir, 'example.tmx');
    fs.writeFileSync(tmxPath, EXAMPLE_TMX);
    return tmxPath;
}

describe('Translation Memories Tests', () => {
    const DEFAULT_TM_ID = 'a74d88fb-ed2a-4943-a664-a4512398b994';

    withMockServer('test listTranslationMemories', async () => {
        const deeplClient = makeDeeplClient();
        const translationMemories = await deeplClient.listTranslationMemories(0, 10);

        expect(Array.isArray(translationMemories)).toBe(true);
        expect(translationMemories.length).toBeGreaterThan(0);
        expect(translationMemories[0].translationMemoryId).toBeDefined();
        expect(translationMemories[0].name).toBeDefined();
        expect(translationMemories[0].sourceLanguage).toBeDefined();
        expect(translationMemories[0].targetLanguages).toBeDefined();
        expect(translationMemories[0].segmentCount).toBeDefined();
    });

    withMockServer('test translateText with translationMemory string ID', async () => {
        const deeplClient = makeDeeplClient();
        const exampleTextValue = 'Hallo, Welt!';
        await deeplClient.translateText(exampleTextValue, 'de', 'en-US', {
            translationMemory: DEFAULT_TM_ID,
        });
    });

    withMockServer('test translateText with translationMemory and threshold', async () => {
        const deeplClient = makeDeeplClient();
        const exampleTextValue = 'Hallo, Welt!';
        await deeplClient.translateText(exampleTextValue, 'de', 'en-US', {
            translationMemory: DEFAULT_TM_ID,
            translationMemoryThreshold: 80,
        });
    });

    withMockServer(
        'test translateDocument with translationMemory string ID',
        async () => {
            // Note: the default translation memory supports target language 'en', so the
            // target language must be an English variant for the mock server to accept it.
            const translator = makeTranslator();
            const [exampleDocument, , outputDocumentPath] = tempFiles();
            fs.writeFileSync(exampleDocument, exampleText.de);
            await translator.translateDocument(exampleDocument, outputDocumentPath, 'de', 'en-US', {
                translationMemory: DEFAULT_TM_ID,
            });
        },
        testTimeout,
    );

    withMockServer(
        'test translateDocument with translationMemory and threshold',
        async () => {
            const translator = makeTranslator();
            const [exampleDocument, , outputDocumentPath] = tempFiles();
            fs.writeFileSync(exampleDocument, exampleText.de);
            await translator.translateDocument(exampleDocument, outputDocumentPath, 'de', 'en-US', {
                translationMemory: DEFAULT_TM_ID,
                translationMemoryThreshold: 80,
            });
        },
        testTimeout,
    );

    withMockServer(
        'test translateDocument with TranslationMemoryInfo object',
        async () => {
            const deeplClient = makeDeeplClient();
            const translationMemories = await deeplClient.listTranslationMemories(0, 10);
            const translationMemory = translationMemories[0];
            const [exampleDocument, , outputDocumentPath] = tempFiles();
            fs.writeFileSync(exampleDocument, exampleText.de);
            await deeplClient.translateDocument(
                exampleDocument,
                outputDocumentPath,
                'de',
                'en-US',
                {
                    translationMemory: translationMemory,
                },
            );
        },
        testTimeout,
    );
    withMockServer('test getTranslationMemory', async () => {
        const deeplClient = makeDeeplClient();
        const translationMemory = await deeplClient.getTranslationMemory(DEFAULT_TM_ID);

        expect(translationMemory.translationMemoryId).toBe(DEFAULT_TM_ID);
        expect(translationMemory.name).toBeTruthy();
        expect(translationMemory.sourceLanguage).toBeTruthy();
        expect(Array.isArray(translationMemory.targetLanguages)).toBe(true);
        expect(translationMemory.creationTime).toBeInstanceOf(Date);
        expect(translationMemory.updatedTime).toBeInstanceOf(Date);
    });

    withMockServer('test getTranslationMemory accepts a TranslationMemoryInfo', async () => {
        const deeplClient = makeDeeplClient();
        const [listed] = await deeplClient.listTranslationMemories();

        const translationMemory = await deeplClient.getTranslationMemory(listed);

        expect(translationMemory.translationMemoryId).toBe(listed.translationMemoryId);
    });

    withMockServer('test getTranslationMemory with unknown ID', async () => {
        const deeplClient = makeDeeplClient();
        await expect(
            deeplClient.getTranslationMemory('00000000-0000-0000-0000-000000000000'),
        ).rejects.toThrow();
    });

    withMockServer('test listTranslationMemorySegments', async () => {
        const deeplClient = makeDeeplClient();
        const page = await deeplClient.listTranslationMemorySegments(DEFAULT_TM_ID);

        expect(page.segments.length).toBeGreaterThan(0);
        expect(page.segmentCount).toBeGreaterThan(0);
        const segment = page.segments[0];
        expect(segment.sourceSegmentId).toBeTruthy();
        expect(segment.sourceText).toBeTruthy();
        expect(segment.targets.length).toBeGreaterThan(0);
        expect(segment.targets[0].targetLanguage).toBeTruthy();
        expect(segment.targets[0].targetText).toBeTruthy();
    });

    withMockServer('test listTranslationMemorySegments pagination', async () => {
        const deeplClient = makeDeeplClient();
        const first = await deeplClient.listTranslationMemorySegments(DEFAULT_TM_ID, {
            pageSize: 5,
        });

        expect(first.segments).toHaveLength(5);
        expect(first.nextPageCursor).toBeDefined();

        const second = await deeplClient.listTranslationMemorySegments(DEFAULT_TM_ID, {
            pageSize: 5,
            pageCursor: first.nextPageCursor,
        });

        expect(second.segments.length).toBeGreaterThan(0);
        const firstIds = first.segments.map((segment) => segment.sourceSegmentId);
        const secondIds = second.segments.map((segment) => segment.sourceSegmentId);
        expect(firstIds.some((id) => secondIds.includes(id))).toBe(false);
    });

    withMockServer('test listTranslationMemorySegments filter', async () => {
        const deeplClient = makeDeeplClient();
        const unfiltered = await deeplClient.listTranslationMemorySegments(DEFAULT_TM_ID);
        const filtered = await deeplClient.listTranslationMemorySegments(DEFAULT_TM_ID, {
            filterText: 'Nummer 7',
        });

        expect(filtered.segments.length).toBeLessThan(unfiltered.segments.length);
        // segmentCount is TM-level metadata and unaffected by the filter
        expect(filtered.segmentCount).toBe(unfiltered.segmentCount);
    });

    withMockServer(
        'test importTranslationMemoryFromFilepath',
        async () => {
            const deeplClient = makeDeeplClient();
            const job = await deeplClient.importTranslationMemoryFromFilepath(tempTmxFile(), {
                displayName: 'Imported TM',
            });

            expect(job.operation).toBe('import');
            expect(job.product).toBe('translation_memory');
            expect(job.results[0].status).toBe('completed');
            const translationMemoryId = job.results[0].translationMemoryId as string;
            expect(translationMemoryId).toBeTruthy();

            const imported = await deeplClient.getTranslationMemory(translationMemoryId);
            expect(imported.name).toBe('Imported TM');

            await deeplClient.deleteTranslationMemory(imported);
        },
        testTimeout,
    );

    withMockServer('test createTranslationMemoryImport awaits upload', async () => {
        const deeplClient = makeDeeplClient();
        const created = await deeplClient.createTranslationMemoryImport('example.tmx', 1024, {
            displayName: 'Awaiting Upload TM',
        });

        expect(created.jobId).toBeTruthy();
        expect(created.uploadUrl).toBeTruthy();

        const job = await deeplClient.getTranslationMemoryJob(created.jobId);
        expect(job.results[0].status).toBe('awaiting_input');
        expect(job.results[0].requiredAction).toBeTruthy();
    });

    withMockServer(
        'test importTranslationMemoryFromFilepath polls through awaiting_input',
        async () => {
            // The live API detects the upload asynchronously and keeps reporting
            // 'awaiting_input' for a while afterwards, so the wait loop must poll through that
            // status instead of rejecting. One extra poll keeps the test fast.
            const deeplClient = makeDeeplClient({ mockServerTmJobProcessingPolls: 1 });
            const created = await deeplClient.createTranslationMemoryImport(
                'example.tmx',
                EXAMPLE_TMX.length,
                { displayName: 'Awaiting Input TM' },
            );
            const pending = await deeplClient.getTranslationMemoryJob(created.jobId);
            expect(pending.results[0].status).toBe('awaiting_input');

            await deeplClient.uploadTranslationMemoryFile(created, Buffer.from(EXAMPLE_TMX));

            // The job still reports 'awaiting_input' on the next poll, and only completes on the
            // one after that; the wait loop must poll through rather than reject.
            const job = await deeplClient.isTranslationMemoryJobComplete(created.jobId, 60000);

            expect(job.results[0].status).toBe('completed');
            const translationMemoryId = job.results[0].translationMemoryId as string;
            expect(translationMemoryId).toBeTruthy();

            await deeplClient.deleteTranslationMemory(translationMemoryId);
        },
        testTimeout,
    );

    withMockServer('test createTranslationMemoryImport rejects an invalid file', async () => {
        const deeplClient = makeDeeplClient();
        await expect(deeplClient.createTranslationMemoryImport('', 100)).rejects.toThrow();
        await expect(deeplClient.createTranslationMemoryImport('example.tmx', 0)).rejects.toThrow();
    });

    withMockServer(
        'test exportTranslationMemoryToFilepath',
        async () => {
            const deeplClient = makeDeeplClient();
            const imported = await deeplClient.importTranslationMemoryFromFilepath(tempTmxFile());
            const translationMemoryId = imported.results[0].translationMemoryId as string;
            const outputPath = `${tempTmxFile()}.exported`;

            const job = await deeplClient.exportTranslationMemoryToFilepath(
                translationMemoryId,
                outputPath,
            );

            expect(job.operation).toBe('export');
            expect(job.results[0].status).toBe('completed');
            expect(fs.readFileSync(outputPath, 'utf8')).toContain('<tmx');

            await deeplClient.deleteTranslationMemory(translationMemoryId);
        },
        testTimeout,
    );

    withMockServer(
        'test createTranslationMemoryExport reuses a completed job',
        async () => {
            const deeplClient = makeDeeplClient();
            const imported = await deeplClient.importTranslationMemoryFromFilepath(tempTmxFile());
            const translationMemoryId = imported.results[0].translationMemoryId as string;

            const created = await deeplClient.createTranslationMemoryExport(translationMemoryId);
            expect(created.reusedExisting).toBe(false);
            expect(created.translationMemoryId).toBe(translationMemoryId);
            await deeplClient.isTranslationMemoryJobComplete(created.jobId);

            const reused = await deeplClient.createTranslationMemoryExport(translationMemoryId);
            expect(reused.reusedExisting).toBe(true);
            expect(reused.jobId).toBe(created.jobId);

            await deeplClient.deleteTranslationMemory(translationMemoryId);
        },
        testTimeout,
    );

    withMockServer('test getTranslationMemoryJob with unknown ID', async () => {
        const deeplClient = makeDeeplClient();
        await expect(
            deeplClient.getTranslationMemoryJob('00000000-0000-0000-0000-000000000000'),
        ).rejects.toThrow();
    });

    withMockServer(
        'test deleteTranslationMemory',
        async () => {
            const deeplClient = makeDeeplClient();
            const imported = await deeplClient.importTranslationMemoryFromFilepath(tempTmxFile());
            const translationMemoryId = imported.results[0].translationMemoryId as string;

            await deeplClient.deleteTranslationMemory(translationMemoryId);

            await expect(deeplClient.getTranslationMemory(translationMemoryId)).rejects.toThrow();
        },
        testTimeout,
    );
});

describe('Translation Memory storage requests', () => {
    // Uploads and downloads go to pre-signed Asset Store URLs outside the DeepL API. Rather than
    // stripping the auth header per request, the SDK uses a separate client that never holds it,
    // so a leak is impossible by construction. These assertions inspect that client directly:
    // the mock's stand-in endpoints are unauthenticated and cannot catch a leak.
    class StorageClientProbe extends deepl.DeepLClient {
        headersSentToStorage(): Record<string, string> {
            const config = this.storageHttpClient.prepareRequest(
                'PUT',
                'https://storage.example/upload',
                1000,
                false,
                { rawBody: Buffer.from('<tmx/>'), headers: { 'Content-Type': 'application/xml' } },
            );
            return (config.headers ?? {}) as Record<string, string>;
        }

        headersSentToApi(): Record<string, string> {
            const config = this.httpClient.prepareRequest('GET', '/v2/usage', 1000, false, {});
            return (config.headers ?? {}) as Record<string, string>;
        }
    }

    const probe = new StorageClientProbe('sample-auth-key-that-must-not-leak', {
        headers: { 'X-Corp-Token': 'also-must-not-leak' },
    });

    it('sends no auth header to storage, whatever the caller configured', () => {
        const headers = probe.headersSentToStorage();
        expect(Object.keys(headers).filter((k) => k.toLowerCase() === 'authorization')).toEqual([]);
        expect(JSON.stringify(headers)).not.toContain('sample-auth-key-that-must-not-leak');
    });

    it('sends no other configured headers to storage either', () => {
        expect(probe.headersSentToStorage()['X-Corp-Token']).toBeUndefined();
    });

    it('still sends the per-request Content-Type and a User-Agent to storage', () => {
        const headers = probe.headersSentToStorage();
        expect(headers['Content-Type']).toBe('application/xml');
        expect(headers['User-Agent']).toContain('deepl-node');
    });

    it('still sends the auth header to the DeepL API itself', () => {
        expect(probe.headersSentToApi().Authorization).toBe(
            'DeepL-Auth-Key sample-auth-key-that-must-not-leak',
        );
    });
});
