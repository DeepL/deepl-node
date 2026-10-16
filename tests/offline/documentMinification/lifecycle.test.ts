import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import AdmZip from 'adm-zip';
import { createHash } from 'crypto';
import nock from 'nock';
import { DocumentMinifier } from '../../../src/documentMinifier';
import { FsHelper } from '../../../src/fsHelper';
import { makeTranslator, serverUrl } from '../client';
import { createMinifiableTestDocument, testFilePaths } from './fixtures';

const keyBody = { document_key: 'doc-key' };
const mediaSize = 2000000;

describe('Translator.translateDocument with enableDocumentMinification', () => {
    let tempDir: string;
    let original: string;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deepl-node-minification-test-'));
        original = createMinifiableTestDocument(
            testFilePaths.docx,
            path.join(tempDir, 'content'),
            tempDir,
            mediaSize,
        );
    });

    afterEach(() => {
        FsHelper.removeSyncRecursive(tempDir);
    });

    /** Declares upload, status and download; returns the size of the uploaded document. */
    function expectTranslation(downloadReply: (this: nock.ReplyFnContext) => nock.ReplyFnResult) {
        let uploadedBytes = 0;
        nock(serverUrl)
            .post('/v2/document', (body) => {
                // nock hex-encodes bodies that are not valid UTF-8
                uploadedBytes = body.length / 2;
                return true;
            })
            .reply(200, { document_id: 'doc-id', document_key: 'doc-key' });
        nock(serverUrl)
            .post('/v2/document/doc-id', keyBody)
            .reply(200, { status: 'done', billed_characters: 1 });
        nock(serverUrl).post('/v2/document/doc-id/result', keyBody).reply(downloadReply);
        return () => uploadedBytes;
    }

    function entryHashes(zipPath: string): Record<string, string> {
        const hashes: Record<string, string> = {};
        for (const entry of new AdmZip(zipPath).getEntries()) {
            hashes[entry.entryName] = createHash('sha1').update(entry.getData()).digest('hex');
        }
        return hashes;
    }

    it('uploads the minified document and deminifies the downloaded result', async () => {
        // What the API returns for a minified document: a document with placeholder media
        const serverDir = fs.mkdtempSync(path.join(tempDir, 'server-'));
        const returned = new DocumentMinifier(serverDir).minifyDocument(original);
        const uploadedBytes = expectTranslation(() => [200, fs.createReadStream(returned)]);
        const output = path.join(tempDir, 'output.docx');

        await makeTranslator().translateDocument(original, output, 'en', 'de', {
            enableDocumentMinification: true,
        });

        expect(fs.statSync(original).size).toBeGreaterThan(mediaSize);
        expect(uploadedBytes()).toBeLessThan(fs.statSync(original).size / 10);
        expect(entryHashes(output)).toEqual(entryHashes(original));
    });

    it('uploads a stream unminified', async () => {
        const uploadedBytes = expectTranslation(() => [200, 'result']);
        const output = path.join(tempDir, 'output.docx');

        await makeTranslator().translateDocument(
            fs.createReadStream(original),
            output,
            'en',
            'de',
            { enableDocumentMinification: true, filename: 'example.docx' },
        );

        expect(uploadedBytes()).toBeGreaterThan(fs.statSync(original).size);
        expect(fs.readFileSync(output, 'utf8')).toBe('result');
    });
});
