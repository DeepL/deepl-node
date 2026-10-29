// Copyright 2022 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import * as deepl from 'deepl-node';

import fs from 'fs';
import nock from 'nock';

import { makeDeeplClient, makeTranslator, serverUrl } from './client';
import { createTextDocument } from '../fixtures';

const handle = { documentId: 'doc-id', documentKey: 'doc-key' };
const handleReply = { document_id: handle.documentId, document_key: handle.documentKey };
const keyBody = { document_key: handle.documentKey };

/** Declares POST /v2/document and records the multipart body that the SDK sends. */
function expectUpload(): { body: () => string } {
    let sent = '';
    nock(serverUrl)
        .post('/v2/document', (body) => {
            sent = body;
            return true;
        })
        .reply(200, handleReply);
    return { body: () => sent };
}

describe('Translator.uploadDocument', () => {
    it('sends the file and the language options as multipart parts and parses the handle', async () => {
        const upload = expectUpload();

        const result = await makeTranslator().uploadDocument(
            Buffer.from('Example file contents'),
            'en',
            'de',
            {
                filename: 'example.txt',
                formality: 'more',
                glossary: 'g-1',
                styleRule: 'style-1',
                translationMemory: 'tm-1',
                translationMemoryThreshold: 80,
                outputFormat: 'docx',
                enableWatermark: true,
                extraRequestParameters: { 'my-extra-parameter': 'my-extra-value' },
            },
        );

        const body = upload.body();
        expect(body).toContain('name="file"; filename="example.txt"');
        expect(body).toContain('Example file contents');
        for (const [name, value] of [
            ['source_lang', 'en'],
            ['target_lang', 'de'],
            ['formality', 'more'],
            ['glossary_id', 'g-1'],
            ['style_id', 'style-1'],
            ['translation_memory_id', 'tm-1'],
            ['translation_memory_threshold', '80'],
            ['output_format', 'docx'],
            ['enable_watermark', 'true'],
            ['my-extra-parameter', 'my-extra-value'],
        ]) {
            expect(body).toContain(`name="${name}"\r\n\r\n${value}\r\n`);
        }
        expect(result).toEqual(handle);
    });

    it('sends extraBodyParameters as multipart parts', async () => {
        const upload = expectUpload();

        await makeTranslator().uploadDocument(Buffer.from('x'), null, 'de', {
            filename: 'example.txt',
            extraBodyParameters: { 'my-extra-parameter': 'my-extra-value' },
        });

        expect(upload.body()).toContain('name="my-extra-parameter"\r\n\r\nmy-extra-value\r\n');
    });

    it('sends extraBodyParameters once, replacing parameters the SDK sets after the languages', async () => {
        const upload = expectUpload();

        await makeTranslator().uploadDocument(Buffer.from('x'), null, 'de', {
            filename: 'example.txt',
            outputFormat: 'docx',
            extraBodyParameters: { output_format: 'pdf' },
        });

        expect(upload.body()).toContain('name="output_format"\r\n\r\npdf\r\n');
        expect(upload.body()).not.toContain('name="output_format"\r\n\r\ndocx\r\n');
    });

    it('sends the style profile ID of a string and of a StyleProfile as one part', async () => {
        const translator = makeTranslator();
        for (const [styleProfile, id] of <Array<[string | deepl.StyleProfile, string]>>[
            ['sp-1', 'sp-1'],
            [<deepl.StyleProfile>{ styleProfileId: 'sp-2' }, 'sp-2'],
        ]) {
            const upload = expectUpload();

            await translator.uploadDocument(Buffer.from('x'), null, 'de', {
                filename: 'example.txt',
                styleProfile,
            });

            const body = upload.body();
            expect(body).toContain(`name="style_profile_id"\r\n\r\n${id}\r\n`);
            expect(body.split('name="style_profile_id"').length).toBe(2);
        }
    });

    it('sends no style_profile_id part when styleProfile is unset', async () => {
        const upload = expectUpload();

        await makeTranslator().uploadDocument(Buffer.from('x'), null, 'de', {
            filename: 'example.txt',
        });

        expect(upload.body()).not.toContain('name="style_profile_id"');
    });

    it('sends the base name of a file path as the filename', async () => {
        const upload = expectUpload();
        const [exampleDocument] = createTextDocument();

        await makeTranslator().uploadDocument(exampleDocument, null, 'de');

        expect(upload.body()).toContain('filename="example_document.txt"');
        expect(upload.body()).not.toContain('name="source_lang"');
        expect(upload.body()).not.toContain('name="output_format"');
        expect(upload.body()).not.toContain('name="enable_watermark"');
    });

    it('sends enable_watermark=false when enableWatermark is false', async () => {
        const upload = expectUpload();

        await makeTranslator().uploadDocument(Buffer.from('abc'), null, 'de', {
            filename: 'a.txt',
            enableWatermark: false,
        });

        expect(upload.body()).toContain('name="enable_watermark"\r\n\r\nfalse\r\n');
    });

    it.each([
        ['a stream', () => fs.createReadStream(createTextDocument()[0])],
        ['a buffer', () => Buffer.from('abc')],
    ])(
        'throws DeepLError when the input is %s and options.filename is missing',
        async (_, input) => {
            await expect(makeTranslator().uploadDocument(input(), null, 'de')).rejects.toThrow(
                'options.filename',
            );
        },
    );

    it('retries when the server answers 429', async () => {
        nock(serverUrl).post('/v2/document').reply(429);
        nock(serverUrl).post('/v2/document').reply(200, handleReply);

        await makeTranslator().uploadDocument(Buffer.from('abc'), null, 'de', {
            filename: 'a.txt',
        });
    });
});

describe('Translator.translateDocumentUpload', () => {
    it('sends the file and target language and parses the handle', async () => {
        const upload = expectUpload();

        const result = await makeDeeplClient().translateDocumentUpload(
            Buffer.from('abc'),
            null,
            'de',
            { filename: 'a.txt' },
        );

        expect(result).toEqual(handle);
        expect(upload.body()).toContain('name="target_lang"\r\n\r\nde\r\n');
        expect(upload.body()).toContain('filename="a.txt"');
    });
});

describe('Translator.translateDocumentGetStatus', () => {
    it('sends the document key and parses the status and document ID', async () => {
        nock(serverUrl)
            .post('/v2/document/doc-id', keyBody)
            .reply(200, { document_id: 'doc-id', status: 'translating', seconds_remaining: 3 });

        const status = await makeDeeplClient().translateDocumentGetStatus(handle);

        expect(status.documentId).toBe('doc-id');
        expect([status.status, status.ok(), status.secondsRemaining]).toEqual([
            'translating',
            true,
            3,
        ]);
    });

    it('leaves documentId undefined when document_id is not a string', async () => {
        nock(serverUrl)
            .post('/v2/document/doc-id', keyBody)
            .reply(200, { document_id: 42, status: 'done', billed_characters: 11 });

        const status = await makeDeeplClient().translateDocumentGetStatus(handle);

        expect(status.documentId).toBeUndefined();
        expect([status.done(), status.billedCharacters]).toEqual([true, 11]);
    });

    it('keeps an unknown status as a string and treats it as ok', async () => {
        nock(serverUrl).post('/v2/document/doc-id', keyBody).reply(200, { status: 'resyncing' });

        const status = await makeDeeplClient().translateDocumentGetStatus(handle);

        expect([status.status, status.ok(), status.done()]).toEqual(['resyncing', true, false]);
    });

    it('URL-encodes the document ID in the path', async () => {
        nock(serverUrl).post('/v2/document/a%2Fb%3F', keyBody).reply(200, { status: 'done' });

        const status = await makeDeeplClient().translateDocumentGetStatus({
            documentId: 'a/b?',
            documentKey: handle.documentKey,
        });

        expect(status.done()).toBe(true);
    });

    it('throws DeepLError, not DocumentNotReadyError, when the server answers 503', async () => {
        nock(serverUrl).post('/v2/document/doc-id').reply(503);

        const error = await makeDeeplClient({ maxRetries: 0 })
            .translateDocumentGetStatus(handle)
            .catch((e) => e);

        expect(error).toBeInstanceOf(deepl.DeepLError);
        expect(error).not.toBeInstanceOf(deepl.DocumentNotReadyError);
        expect(error.httpStatusCode).toBe(503);
    });
});

describe('Translator.getDocumentStatus', () => {
    it('sends the document key and parses the status', async () => {
        nock(serverUrl)
            .post('/v2/document/doc-id', keyBody)
            .reply(200, { status: 'translating', seconds_remaining: 3 });
        nock(serverUrl)
            .post('/v2/document/doc-id', keyBody)
            .reply(200, { status: 'done', billed_characters: 11 });
        const translator = makeTranslator();

        const translating = await translator.getDocumentStatus(handle);
        const done = await translator.getDocumentStatus(handle);

        expect([translating.ok(), translating.done(), translating.secondsRemaining]).toEqual([
            true,
            false,
            3,
        ]);
        expect([done.ok(), done.done(), done.billedCharacters]).toEqual([true, true, 11]);
    });

    it('parses an error status', async () => {
        nock(serverUrl)
            .post('/v2/document/doc-id', keyBody)
            .reply(200, { status: 'error', error_message: 'bad file' });

        const status = await makeTranslator().getDocumentStatus(handle);

        expect([status.ok(), status.done(), status.errorMessage]).toEqual([
            false,
            false,
            'bad file',
        ]);
    });

    it('throws DeepLError when the document is not found', async () => {
        nock(serverUrl).post('/v2/document/doc-id').reply(404, { message: 'nope' });

        await expect(makeTranslator().getDocumentStatus(handle)).rejects.toThrow(
            'Not found, message: nope',
        );
    });
});

describe('Translator.translateDocumentWaitUntilDone', () => {
    it('polls until the document is done and resolves with the final status', async () => {
        nock(serverUrl).post('/v2/document/doc-id', keyBody).reply(200, { status: 'queued' });
        nock(serverUrl)
            .post('/v2/document/doc-id', keyBody)
            .reply(200, { status: 'done', billed_characters: 11 });

        const status = await makeTranslator().translateDocumentWaitUntilDone(handle);

        expect([status.ok(), status.done(), status.billedCharacters]).toEqual([true, true, 11]);
    }, 15000);

    it('throws DeepLError with the error message when the translation fails', async () => {
        nock(serverUrl)
            .post('/v2/document/doc-id', keyBody)
            .reply(200, { status: 'error', error_message: 'bad file' });

        const result = makeTranslator().translateDocumentWaitUntilDone(handle);

        await expect(result).rejects.toThrow(deepl.DeepLError);
        await expect(result).rejects.toThrow('bad file');
    });
});

describe('Translator.translateDocumentWaitUntilDone (polling)', () => {
    it('keeps polling through an unknown status', async () => {
        nock(serverUrl).post('/v2/document/doc-id', keyBody).reply(200, { status: 'resyncing' });
        nock(serverUrl).post('/v2/document/doc-id', keyBody).reply(200, { status: 'done' });

        const status = await makeDeeplClient().translateDocumentWaitUntilDone(handle);

        expect(status.done()).toBe(true);
    }, 15000);

    it('throws DeepLError when timeoutMs expires', async () => {
        // A second poll happens only if the first status request took under 1 ms.
        nock(serverUrl).post('/v2/document/doc-id', keyBody).reply(200, { status: 'translating' });
        nock(serverUrl)
            .post('/v2/document/doc-id', keyBody)
            .optionally()
            .reply(200, { status: 'translating' });

        const result = makeDeeplClient().translateDocumentWaitUntilDone(handle, { timeoutMs: 1 });

        await expect(result).rejects.toThrow(deepl.DeepLError);
        await expect(result).rejects.toThrow('Timeout of 1ms exceeded');
    });
});

describe('Translator.isDocumentTranslationComplete', () => {
    it('polls until the document is done', async () => {
        nock(serverUrl).post('/v2/document/doc-id', keyBody).reply(200, { status: 'queued' });
        nock(serverUrl)
            .post('/v2/document/doc-id', keyBody)
            .reply(200, { status: 'done', billed_characters: 11 });

        const { status } = await makeTranslator().isDocumentTranslationComplete(handle);

        expect(status.done()).toBe(true);
    }, 15000);

    it('throws DeepLError with the error message when the translation fails', async () => {
        nock(serverUrl)
            .post('/v2/document/doc-id', keyBody)
            .reply(200, { status: 'error', error_message: 'bad file' });

        await expect(makeTranslator().isDocumentTranslationComplete(handle)).rejects.toThrow(
            'bad file',
        );
    });
});

describe('Translator.downloadDocument', () => {
    it('sends the document key and streams the result to a file', async () => {
        nock(serverUrl).post('/v2/document/doc-id/result', keyBody).reply(200, 'result');
        const [, outputPath] = createTextDocument();

        await makeTranslator().downloadDocument(handle, outputPath);

        expect(fs.readFileSync(outputPath, 'utf8')).toBe('result');
    });

    it('throws DocumentNotReadyError when the server answers 503', async () => {
        nock(serverUrl).post('/v2/document/doc-id/result').reply(503);
        const [, outputPath] = createTextDocument();

        await expect(
            makeTranslator({ maxRetries: 0 }).downloadDocument(handle, outputPath),
        ).rejects.toThrow(deepl.DocumentNotReadyError);
        expect(fs.existsSync(outputPath)).toBe(false);
    });
});

describe('Translator.translateDocumentDownload', () => {
    it('sends the document key to the URL-encoded result path and writes the file', async () => {
        nock(serverUrl).post('/v2/document/a%2Fb/result', keyBody).reply(200, 'result');
        const [, outputPath] = createTextDocument();

        await makeDeeplClient().translateDocumentDownload(
            { documentId: 'a/b', documentKey: handle.documentKey },
            outputPath,
        );

        expect(fs.readFileSync(outputPath, 'utf8')).toBe('result');
    });
});

describe('Translator.translateDocument', () => {
    it('uploads, polls and downloads the document', async () => {
        nock(serverUrl).post('/v2/document').reply(200, handleReply);
        nock(serverUrl).post('/v2/document/doc-id', keyBody).reply(200, { status: 'done' });
        nock(serverUrl).post('/v2/document/doc-id/result', keyBody).reply(200, 'result');
        const [exampleDocument, outputPath] = createTextDocument();

        await makeTranslator().translateDocument(exampleDocument, outputPath, null, 'de');

        expect(fs.readFileSync(outputPath, 'utf8')).toBe('result');
    });

    it('throws DocumentTranslationError with the document handle when the translation fails', async () => {
        nock(serverUrl).post('/v2/document').reply(200, handleReply);
        nock(serverUrl)
            .post('/v2/document/doc-id', keyBody)
            .reply(200, { status: 'error', error_message: 'Source and target language match' });
        const [exampleDocument, outputPath] = createTextDocument();

        const error = await makeTranslator()
            .translateDocument(exampleDocument, outputPath, null, 'de')
            .catch((e) => e);

        expect(error).toBeInstanceOf(deepl.DocumentTranslationError);
        expect(error.message).toContain('Source and target language match');
        expect(error.documentHandle).toEqual(handle);
        expect(fs.existsSync(outputPath)).toBe(false);
    });

    it('rejects with DocumentTranslationError when timeoutMs expires', async () => {
        nock(serverUrl).post('/v2/document').reply(200, handleReply);
        // A second poll happens only if the first status request took under 1 ms.
        nock(serverUrl).post('/v2/document/doc-id', keyBody).reply(200, { status: 'translating' });
        nock(serverUrl)
            .post('/v2/document/doc-id', keyBody)
            .optionally()
            .reply(200, { status: 'translating' });
        const [exampleDocument, outputPath] = createTextDocument();

        const error = await makeDeeplClient()
            .translateDocument(exampleDocument, outputPath, null, 'de', { timeoutMs: 1 })
            .catch((e) => e);

        expect(error).toBeInstanceOf(deepl.DocumentTranslationError);
        expect(error.message).toContain('Timeout of 1ms exceeded');
        expect(error.documentHandle).toEqual(handle);
    });

    it('throws Error when the output file already exists', async () => {
        const [exampleDocument, outputPath] = createTextDocument();
        fs.writeFileSync(outputPath, 'existing');

        await expect(
            makeTranslator().translateDocument(exampleDocument, outputPath, null, 'de'),
        ).rejects.toThrow('exists');
        expect(fs.readFileSync(outputPath, 'utf8')).toBe('existing');
    });

    it('throws DocumentTranslationError when the input file does not exist', async () => {
        const [, outputPath] = createTextDocument();

        await expect(
            makeTranslator().translateDocument('nonExistentFile.txt', outputPath, null, 'de'),
        ).rejects.toThrow('no such file');
        expect(fs.existsSync(outputPath)).toBe(false);
    });
});
