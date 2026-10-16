// Copyright 2025 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import fs from 'fs';
import os from 'os';
import path from 'path';

import { makeDeeplClient } from './client';
import { getUniqueName } from './helpers';

const exampleTmx =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<tmx version="1.4"><header creationtool="deepl-node-tests" creationtoolversion="1"' +
    ' segtype="sentence" o-tmf="plain" adminlang="en" srclang="en" datatype="plaintext"/>' +
    '<body><tu><tuv xml:lang="en"><seg>Segment number 1</seg></tuv>' +
    '<tuv xml:lang="de"><seg>Segment Nummer 1</seg></tuv></tu></body></tmx>\n';

// The import appears as a translation memory only after about a minute. The two job waits must
// together stay below the test timeout, or jest abandons the test before it deletes the memory.
const jobTimeout = 120000;
const importFlowTimeout = 300000;

describe('DeepLClient translation memories', () => {
    it(
        'sends the translation memory requests: import, upload, get, list, segments, export and delete',
        async () => {
            const client = makeDeeplClient();
            const name = getUniqueName('translationMemory');
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deepl-node-tm-test-'));
            let translationMemoryId: string | undefined;
            try {
                const created = await client.createTranslationMemoryImport(
                    'example.tmx',
                    Buffer.byteLength(exampleTmx),
                    { displayName: name },
                );
                expect(created.jobId).toEqual(expect.any(String));
                expect(created.uploadUrl).toEqual(expect.any(String));

                await client.uploadTranslationMemoryFile(created, Buffer.from(exampleTmx));

                const importJob = await client.isTranslationMemoryJobComplete(
                    created.jobId,
                    jobTimeout,
                );
                translationMemoryId = importJob.results[0].translationMemoryId;
                expect(importJob.operation).toBe('import');
                expect(importJob.results[0].status).toBe('completed');
                expect(translationMemoryId).toEqual(expect.any(String));
                const id = translationMemoryId as string;

                const fetched = await client.getTranslationMemory(id);
                expect(fetched.translationMemoryId).toBe(id);
                expect(fetched.name).toBe(name);
                expect(fetched.sourceLanguage).toEqual(expect.any(String));

                let listed = false;
                for (let page = 0; !listed && page < 20; page++) {
                    const memories = await client.listTranslationMemories(page, 100);
                    if (memories.length === 0) break;
                    listed = memories.some((memory) => memory.translationMemoryId === id);
                }
                expect(listed).toBe(true);

                const segments = await client.listTranslationMemorySegments(id);
                expect(segments.segments.length).toBeGreaterThan(0);
                expect(segments.segments[0].sourceSegmentId).toEqual(expect.any(String));

                const exported = await client.createTranslationMemoryExport(id);
                expect(exported.jobId).toEqual(expect.any(String));
                const exportJob = await client.isTranslationMemoryJobComplete(
                    exported.jobId,
                    jobTimeout,
                );
                const outputPath = path.join(tempDir, 'export.tmx');
                await client.downloadTranslationMemoryExport(exportJob, outputPath);
                expect(fs.readFileSync(outputPath, 'utf8')).toContain('<tmx');
            } finally {
                if (translationMemoryId !== undefined) {
                    await client
                        .deleteTranslationMemory(translationMemoryId)
                        .catch(() => undefined);
                }
            }
        },
        importFlowTimeout,
    );
});
