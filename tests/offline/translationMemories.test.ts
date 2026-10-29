// Copyright 2025 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import * as deepl from 'deepl-node';

import fs from 'fs';
import nock from 'nock';
import os from 'os';
import path from 'path';

import { makeDeeplClient, serverUrl } from './client';

const storageUrl = 'https://storage.example';
const tmx = '<tmx version="1.4"><body/></tmx>';

const tmReply = {
    translation_memory_id: 'tm-1',
    name: 'my tm',
    source_language: 'de',
    target_languages: ['en'],
    segment_count: 3,
    creation_time: '2025-01-02T03:04:05Z',
    updated_time: '2025-01-03T03:04:05Z',
};

function jobReply(status: string, extra: Record<string, unknown> = {}) {
    return {
        job_id: 'job-1',
        operation: 'import',
        product: 'translation_memory',
        results: [{ status, ...extra }],
    };
}

function tempDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'deepl-node-tm-test-'));
}

describe('DeepLClient.listTranslationMemories', () => {
    it('sends no query by default and parses the translation memories', async () => {
        nock(serverUrl, { reqheaders: { authorization: 'DeepL-Auth-Key k' } })
            .get('/v3/translation_memories')
            .query({})
            .reply(200, { translation_memories: [tmReply] });

        const result = await makeDeeplClient().listTranslationMemories();

        expect(result).toEqual([
            {
                translationMemoryId: 'tm-1',
                name: 'my tm',
                sourceLanguage: 'de',
                targetLanguages: ['en'],
                segmentCount: 3,
                creationTime: new Date('2025-01-02T03:04:05Z'),
                updatedTime: new Date('2025-01-03T03:04:05Z'),
            },
        ]);
    });

    it('sends page and page_size', async () => {
        nock(serverUrl)
            .get('/v3/translation_memories')
            .query({ page: '1', page_size: '5' })
            .reply(200, { translation_memories: [] });

        await makeDeeplClient().listTranslationMemories(1, 5);
    });
});

describe('DeepLClient.getTranslationMemory', () => {
    it.each([
        ['an ID', 'tm-1'],
        ['a TranslationMemoryInfo', <deepl.TranslationMemoryInfo>{ translationMemoryId: 'tm-1' }],
    ])('sends GET for %s', async (_, translationMemory) => {
        nock(serverUrl).get('/v3/translation_memories/tm-1').reply(200, {});

        await makeDeeplClient().getTranslationMemory(translationMemory);
    });

    it('URL-encodes the translation memory ID in the path', async () => {
        nock(serverUrl).get('/v3/translation_memories/a%2Fb%3F').reply(200, {});

        await makeDeeplClient().getTranslationMemory('a/b?');
    });

    it('throws DeepLError when the translation memory has no ID', async () => {
        await expect(
            makeDeeplClient().getTranslationMemory(<deepl.TranslationMemoryInfo>{}),
        ).rejects.toThrow(/should be a TranslationMemoryId/);
    });

    it('throws DeepLError when the translation memory does not exist', async () => {
        nock(serverUrl).get('/v3/translation_memories/tm-1').reply(404, { message: 'm' });

        await expect(makeDeeplClient().getTranslationMemory('tm-1')).rejects.toThrow('Not found');
    });
});

describe('DeepLClient.listTranslationMemorySegments', () => {
    it('sends no query by default and parses the segments', async () => {
        nock(serverUrl)
            .get('/v3/translation_memories/tm-1/segments')
            .query({})
            .reply(200, {
                segments: [
                    {
                        source_segment_id: 'seg-1',
                        source_text: 'Hallo',
                        creation_time: '2025-01-02T03:04:05Z',
                        targets: [
                            {
                                target_segment_id: 'tgt-1',
                                target_language: 'en',
                                target_text: 'Hello',
                            },
                        ],
                    },
                ],
                segment_count: 1,
                next_page_cursor: 'cursor-2',
            });

        const result = await makeDeeplClient().listTranslationMemorySegments('tm-1');

        expect(result.segmentCount).toBe(1);
        expect(result.nextPageCursor).toBe('cursor-2');
        expect(result.segments[0]).toMatchObject({
            sourceSegmentId: 'seg-1',
            sourceText: 'Hallo',
            creationTime: new Date('2025-01-02T03:04:05Z'),
            targets: [{ targetSegmentId: 'tgt-1', targetLanguage: 'en', targetText: 'Hello' }],
        });
    });

    it('sends the paging and filter options, with spaces encoded as %20', async () => {
        nock(serverUrl)
            .get(
                '/v3/translation_memories/tm-1/segments?page_size=5&page_cursor=c1' +
                    '&filter_text=Nummer%207&filter_case_sensitive=true',
            )
            .reply(200, { segments: [], segment_count: 0 });

        await makeDeeplClient().listTranslationMemorySegments('tm-1', {
            pageSize: 5,
            pageCursor: 'c1',
            filterText: 'Nummer 7',
            filterCaseSensitive: true,
        });
    });

    it('URL-encodes the translation memory ID in the path', async () => {
        nock(serverUrl)
            .get('/v3/translation_memories/a%2Fb/segments')
            .reply(200, { segments: [], segment_count: 0 });

        await makeDeeplClient().listTranslationMemorySegments('a/b');
    });
});

describe('DeepLClient.deleteTranslationMemory', () => {
    it('sends DELETE for the translation memory ID', async () => {
        nock(serverUrl).delete('/v3/translation_memories/tm-1').reply(204);

        await makeDeeplClient().deleteTranslationMemory('tm-1');
    });

    it('URL-encodes the translation memory ID in the path', async () => {
        nock(serverUrl).delete('/v3/translation_memories/a%2Fb').reply(204);

        await makeDeeplClient().deleteTranslationMemory('a/b');
    });
});

describe('DeepLClient.createTranslationMemoryImport', () => {
    it('sends the source file and display name as JSON and parses the import', async () => {
        nock(serverUrl, { reqheaders: { 'content-type': 'application/json' } })
            .post('/v3/translation_memories/import', {
                source_file: {
                    file_name: 'a.tmx',
                    content_length: 10,
                    content_type: 'application/xml',
                },
                parameters: { display_name: 'my tm' },
            })
            .reply(202, {
                job_id: 'job-1',
                upload_url: `${storageUrl}/upload`,
                expires_at: '2025-01-02T03:04:05Z',
            });

        const result = await makeDeeplClient().createTranslationMemoryImport('a.tmx', 10, {
            contentType: 'application/xml',
            displayName: 'my tm',
        });

        expect(result).toEqual({
            jobId: 'job-1',
            uploadUrl: `${storageUrl}/upload`,
            expiresAt: new Date('2025-01-02T03:04:05Z'),
        });
    });

    it('sends only the file name and length when there are no options', async () => {
        nock(serverUrl)
            .post('/v3/translation_memories/import', {
                source_file: { file_name: 'a.tmx', content_length: 10 },
            })
            .reply(202, { job_id: 'job-1', upload_url: `${storageUrl}/upload` });

        await makeDeeplClient().createTranslationMemoryImport('a.tmx', 10);
    });

    it.each([
        ['file name', '', 10],
        ['content length', 'a.tmx', 0],
    ])('throws ArgumentError when the %s is invalid', async (_, fileName, contentLength) => {
        await expect(
            makeDeeplClient().createTranslationMemoryImport(fileName, contentLength),
        ).rejects.toThrow(deepl.ArgumentError);
    });
});

describe('DeepLClient.uploadTranslationMemoryFile', () => {
    it('puts the file to the upload URL with the content type, and without credentials', async () => {
        let received = '';
        nock(storageUrl, {
            reqheaders: { 'content-type': 'text/xml', 'user-agent': /^deepl-node\// },
            badheaders: ['authorization', 'x-corp-token'],
        })
            .put('/upload?sig=1', (body) => {
                received = body;
                return true;
            })
            .reply(200);

        await makeDeeplClient({
            headers: { 'X-Corp-Token': 't' },
        }).uploadTranslationMemoryFile(
            { jobId: 'job-1', uploadUrl: `${storageUrl}/upload?sig=1` },
            Buffer.from(tmx),
            'text/xml',
        );

        expect(received).toBe(tmx);
    });

    it('sends application/xml by default', async () => {
        nock(storageUrl, { reqheaders: { 'content-type': 'application/xml' } })
            .put('/upload')
            .reply(200);

        await makeDeeplClient().uploadTranslationMemoryFile(
            `${storageUrl}/upload`,
            Buffer.from(tmx),
        );
    });

    it('throws DeepLError with the status when the storage rejects the upload', async () => {
        nock(storageUrl).put('/upload').reply(403, 'expired');

        await expect(
            makeDeeplClient().uploadTranslationMemoryFile(`${storageUrl}/upload`, Buffer.from(tmx)),
        ).rejects.toThrow('HTTP status: 403, content: expired');
    });

    it('throws DeepLError with httpStatusCode and shouldRetry after storage server errors', async () => {
        nock(storageUrl).put('/upload').reply(500, 'down');

        const error = await makeDeeplClient({ maxRetries: 0 })
            .uploadTranslationMemoryFile(`${storageUrl}/upload`, Buffer.from(tmx))
            .catch((e) => e);

        expect(error).toBeInstanceOf(deepl.DeepLError);
        expect(error.httpStatusCode).toBe(500);
        expect(error.shouldRetry).toBe(true);
    });

    it('throws ArgumentError when the upload URL is empty', async () => {
        await expect(
            makeDeeplClient().uploadTranslationMemoryFile('', Buffer.from(tmx)),
        ).rejects.toThrow(deepl.ArgumentError);
    });
});

describe('DeepLClient.getTranslationMemoryJob', () => {
    it('requests the job and parses its result', async () => {
        nock(serverUrl)
            .get('/v3/translation_memories/jobs/job-1')
            .reply(
                200,
                jobReply('completed', {
                    translation_memory_id: 'tm-1',
                    skipped_segment_count: 2,
                    download_url: `${storageUrl}/download`,
                }),
            );

        const job = await makeDeeplClient().getTranslationMemoryJob('job-1');

        expect(job).toMatchObject({ jobId: 'job-1', operation: 'import' });
        expect(job.results).toEqual([
            {
                status: 'completed',
                requiredAction: undefined,
                downloadUrl: `${storageUrl}/download`,
                expiresAt: undefined,
                errorMessage: undefined,
                translationMemoryId: 'tm-1',
                skippedSegmentCount: 2,
            },
        ]);
    });

    it('URL-encodes the job ID in the path', async () => {
        nock(serverUrl)
            .get('/v3/translation_memories/jobs/a%2Fb')
            .reply(200, jobReply('processing'));

        await makeDeeplClient().getTranslationMemoryJob('a/b');
    });

    it('throws ArgumentError when the job ID is empty', async () => {
        await expect(makeDeeplClient().getTranslationMemoryJob('')).rejects.toThrow(
            deepl.ArgumentError,
        );
    });
});

describe('DeepLClient.isTranslationMemoryJobComplete', () => {
    const jobPath = '/v3/translation_memories/jobs/job-1';

    it('polls through awaiting_input until the job is completed', async () => {
        nock(serverUrl).get(jobPath).reply(200, jobReply('awaiting_input'));
        nock(serverUrl).get(jobPath).reply(200, jobReply('completed'));

        await makeDeeplClient().isTranslationMemoryJobComplete('job-1');
    }, 15000);

    it.each([
        ['failed', { error: { message: 'bad tmx' } }, 'bad tmx'],
        ['expired', {}, 'Job expired'],
    ])('throws DeepLError when the job is %s', async (status, extra, message) => {
        nock(serverUrl).get(jobPath).reply(200, jobReply(status, extra));

        await expect(makeDeeplClient().isTranslationMemoryJobComplete('job-1')).rejects.toThrow(
            message,
        );
    });

    it('throws DeepLError when the status is unknown', async () => {
        nock(serverUrl).get(jobPath).reply(200, jobReply('something_new'));

        await expect(makeDeeplClient().isTranslationMemoryJobComplete('job-1')).rejects.toThrow(
            /unusable status: something_new/,
        );
    });

    it('throws DeepLError when the job has no result', async () => {
        nock(serverUrl)
            .get(jobPath)
            .reply(200, { job_id: 'job-1', operation: 'import', results: [] });

        await expect(makeDeeplClient().isTranslationMemoryJobComplete('job-1')).rejects.toThrow(
            /unusable status: none/,
        );
    });

    it('throws DeepLError when timeoutMs is exceeded', async () => {
        nock(serverUrl).get(jobPath).times(2).reply(200, jobReply('processing'));

        await expect(makeDeeplClient().isTranslationMemoryJobComplete('job-1', 1)).rejects.toThrow(
            'Timeout of 1ms exceeded',
        );
    }, 15000);
});

describe('DeepLClient.createTranslationMemoryExport', () => {
    it('URL-encodes the translation memory ID in the path', async () => {
        nock(serverUrl).post('/v3/translation_memories/a%2Fb/export').reply(202, { job_id: 'j' });

        await makeDeeplClient().createTranslationMemoryExport('a/b');
    });

    it.each([
        [202, false],
        [200, true],
    ])('answered with %i parses reusedExisting as %s', async (status, reusedExisting) => {
        nock(serverUrl)
            .post('/v3/translation_memories/tm-1/export')
            .reply(status, { job_id: 'job-2', parameters: { translation_memory_id: 'tm-1' } });

        const result = await makeDeeplClient().createTranslationMemoryExport('tm-1');

        expect(result).toEqual({ jobId: 'job-2', translationMemoryId: 'tm-1', reusedExisting });
    });
});

describe('DeepLClient.downloadTranslationMemoryExport', () => {
    const job = (downloadUrl?: string): deepl.TranslationMemoryJob => ({
        jobId: 'job-2',
        operation: 'export',
        product: 'translation_memory',
        results: [{ status: 'completed', downloadUrl }],
    });

    it('streams the download URL to a file, without credentials', async () => {
        nock(storageUrl, { badheaders: ['authorization'] })
            .get('/download?sig=1')
            .reply(200, tmx);
        const outputPath = path.join(tempDir(), 'out.tmx');

        await makeDeeplClient().downloadTranslationMemoryExport(
            job(`${storageUrl}/download?sig=1`),
            outputPath,
        );

        expect(fs.readFileSync(outputPath, 'utf8')).toBe(tmx);
    });

    it('rejects an existing output file before it downloads anything', async () => {
        const outputPath = path.join(tempDir(), 'out.tmx');
        fs.writeFileSync(outputPath, 'existing');

        await expect(
            makeDeeplClient().downloadTranslationMemoryExport(
                job(`${storageUrl}/download`),
                outputPath,
            ),
        ).rejects.toMatchObject({ code: 'EEXIST' });
        expect(fs.readFileSync(outputPath, 'utf8')).toBe('existing');
    });

    it('throws DeepLError and leaves no file when the storage answers an error', async () => {
        nock(storageUrl).get('/download').reply(403, 'expired');
        const outputPath = path.join(tempDir(), 'out.tmx');

        await expect(
            makeDeeplClient({ maxRetries: 0 }).downloadTranslationMemoryExport(
                job(`${storageUrl}/download`),
                outputPath,
            ),
        ).rejects.toThrow(deepl.DeepLError);
        expect(fs.existsSync(outputPath)).toBe(false);
    });

    it('throws ArgumentError when the job has no download URL', async () => {
        await expect(
            makeDeeplClient().downloadTranslationMemoryExport(job(), 'unused.tmx'),
        ).rejects.toThrow(deepl.ArgumentError);
    });
});

describe('DeepLClient.importTranslationMemoryFromFilepath', () => {
    it('sends the import, uploads the file and waits for the job', async () => {
        const inputPath = path.join(tempDir(), 'example.tmx');
        fs.writeFileSync(inputPath, tmx);
        nock(serverUrl)
            .post('/v3/translation_memories/import', {
                source_file: { file_name: 'example.tmx', content_length: tmx.length },
                parameters: { display_name: 'my tm' },
            })
            .reply(202, { job_id: 'job-1', upload_url: `${storageUrl}/upload` });
        nock(storageUrl).put('/upload', tmx).reply(200);
        nock(serverUrl)
            .get('/v3/translation_memories/jobs/job-1')
            .reply(200, jobReply('completed'));

        await makeDeeplClient().importTranslationMemoryFromFilepath(inputPath, {
            displayName: 'my tm',
        });
    });
});

describe('DeepLClient.exportTranslationMemoryToFilepath', () => {
    it('sends the export, waits for the job and downloads the file', async () => {
        const outputPath = path.join(tempDir(), 'out.tmx');
        nock(serverUrl)
            .post('/v3/translation_memories/tm-1/export')
            .reply(202, { job_id: 'job-2' });
        nock(serverUrl)
            .get('/v3/translation_memories/jobs/job-2')
            .reply(200, jobReply('completed', { download_url: `${storageUrl}/download` }));
        nock(storageUrl).get('/download').reply(200, tmx);

        await makeDeeplClient().exportTranslationMemoryToFilepath('tm-1', outputPath);

        expect(fs.readFileSync(outputPath, 'utf8')).toBe(tmx);
    });
});
