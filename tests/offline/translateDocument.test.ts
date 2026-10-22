// Copyright 2022 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import * as deepl from 'deepl-node';

import fs from 'fs';
import nock from 'nock';

import { makeTranslator, serverUrl } from './client';
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
            ['my-extra-parameter', 'my-extra-value'],
        ]) {
            expect(body).toContain(`name="${name}"\r\n\r\n${value}\r\n`);
        }
        expect(result).toEqual(handle);
    });

    it('sends the base name of a file path as the filename', async () => {
        const upload = expectUpload();
        const [exampleDocument] = createTextDocument();

        await makeTranslator().uploadDocument(exampleDocument, null, 'de');

        expect(upload.body()).toContain('filename="example_document.txt"');
        expect(upload.body()).not.toContain('name="source_lang"');
        expect(upload.body()).not.toContain('name="output_format"');
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
