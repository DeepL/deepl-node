import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { DocumentMinifier } from '../../../src/documentMinifier';
import AdmZip from 'adm-zip';
import { DocumentMinificationError } from '../../../src';
import { FsHelper } from '../../../src/fsHelper';
import { randomUUID } from 'crypto';
import mock from 'mock-fs';

describe('DocumentMinifier helperMethods', () => {
    beforeEach(() => {
        // Use in-memory file system for fs
        mock();
    });

    afterEach(() => {
        mock.restore();
    });

    describe('createTemporaryDirectory', () => {
        it('should create a temporary directory in system temp location', () => {
            const minifier = new DocumentMinifier();

            const tempDir = (minifier as any)._tempDir;

            expect(fs.existsSync(tempDir)).toBe(true);
            expect(tempDir.startsWith(os.tmpdir())).toBe(true);
            expect(tempDir).toMatch(/document_minification_[0-9a-f-]+$/);

            FsHelper.removeSyncRecursive(tempDir);
        });

        it('should use provided temp directory when specified', () => {
            const customTempDir = path.join(os.tmpdir(), 'custom_temp_dir' + randomUUID());
            fs.mkdirSync(customTempDir);

            const minifier = new DocumentMinifier(customTempDir);
            const tempDir = (minifier as any)._tempDir;

            expect(tempDir).toBe(customTempDir);

            FsHelper.removeSyncRecursive(tempDir);
        });
    });

    describe('extractZipToDirectory', () => {
        let tempDir: string;
        let documentMinifier: DocumentMinifier;

        beforeEach(() => {
            tempDir = fs.mkdtempSync('test-doc-minifier-');
            documentMinifier = new DocumentMinifier(tempDir);
        });

        afterEach(() => {
            if (fs.existsSync(tempDir)) {
                FsHelper.removeSyncRecursive(tempDir);
            }
        });

        it('should extract all files from zip to the extraction directory', () => {
            const extractionDir = path.join(tempDir, 'extraction');
            const zipPath = path.join(tempDir, 'test.zip');

            const zip = new AdmZip();
            zip.addFile('test.txt', Buffer.from('test content'));
            zip.addFile('subfolder/nested.txt', Buffer.from('nested content'));
            zip.writeZip(zipPath);

            (documentMinifier as any).extractZipToDirectory(zipPath, extractionDir);

            expect(fs.existsSync(path.join(extractionDir, 'test.txt'))).toBe(true);
            expect(fs.existsSync(path.join(extractionDir, 'subfolder/nested.txt'))).toBe(true);
            expect(fs.readFileSync(path.join(extractionDir, 'test.txt'), 'utf8')).toBe(
                'test content',
            );
            expect(fs.readFileSync(path.join(extractionDir, 'subfolder/nested.txt'), 'utf8')).toBe(
                'nested content',
            );
        });

        it('should overwrite existing files in extraction directory', () => {
            const extractionDir = path.join(tempDir, 'extraction');
            fs.mkdirSync(extractionDir);
            fs.writeFileSync(path.join(extractionDir, 'test.txt'), 'old content');

            const zipPath = path.join(tempDir, 'test.zip');
            const zip = new AdmZip();
            zip.addFile('test.txt', Buffer.from('new content'));
            zip.writeZip(zipPath);

            (documentMinifier as any).extractZipToDirectory(zipPath, extractionDir);

            expect(fs.readFileSync(path.join(extractionDir, 'test.txt'), 'utf8')).toBe(
                'new content',
            );
        });

        it('should throw error if zip file does not exist', () => {
            const nonExistentZip = path.join(tempDir, 'nonexistent.zip');
            const extractionDir = path.join(tempDir, 'extraction');

            expect(() => {
                (documentMinifier as any).extractZipToDirectory(nonExistentZip, extractionDir);
            }).toThrow(Error);
        });
    });

    describe('createZipFromDirectory', () => {
        let tempDir: string;
        let documentMinifier: DocumentMinifier;

        beforeEach(() => {
            tempDir = fs.mkdtempSync('test-doc-minifier-');
            documentMinifier = new DocumentMinifier(tempDir);
        });

        afterEach(() => {
            if (fs.existsSync(tempDir)) {
                FsHelper.removeSyncRecursive(tempDir);
            }
        });

        it('should create a zip file containing all files from source directory', () => {
            const sourceDir = path.join(tempDir, 'source');
            const outputPath = path.join(tempDir, 'output.zip');
            fs.mkdirSync(sourceDir);
            fs.writeFileSync(path.join(sourceDir, 'test.txt'), 'test content');
            fs.writeFileSync(path.join(sourceDir, 'test2.txt'), 'test content 2');

            (documentMinifier as any).createZipFromDirectory(sourceDir, outputPath);

            expect(fs.existsSync(outputPath)).toBe(true);
            const zip = new AdmZip(outputPath);
            const entries = zip.getEntries();
            expect(entries).toHaveLength(2);
            expect(entries.map((e) => e.entryName).sort()).toEqual(['test.txt', 'test2.txt']);
            expect(zip.readAsText('test.txt')).toBe('test content');
            expect(zip.readAsText('test2.txt')).toBe('test content 2');
        });

        it('should throw error if source directory does not exist', () => {
            const nonExistentDir = path.join(tempDir, 'nonexistent');
            const outputPath = path.join(tempDir, 'output.zip');

            expect(() => {
                (documentMinifier as any).createZipFromDirectory(nonExistentDir, outputPath);
            }).toThrow(Error);
        });
    });

    describe('exportMediaToMediaDirAndReplace', () => {
        let tempDir: string;
        let documentMinifier: DocumentMinifier;

        beforeEach(() => {
            tempDir = fs.mkdtempSync('test-doc-minifier-');
            documentMinifier = new DocumentMinifier(tempDir);
        });

        afterEach(() => {
            if (fs.existsSync(tempDir)) {
                FsHelper.removeSyncRecursive(tempDir);
            }
        });

        it('should move media files to media directory as placeholders', () => {
            const inputDir = path.join(tempDir, 'input');
            fs.mkdirSync(inputDir);
            fs.writeFileSync(path.join(inputDir, 'image.png'), 'image content');
            fs.writeFileSync(path.join(inputDir, 'video.mp4'), 'video content');
            fs.writeFileSync(path.join(inputDir, 'audio.mp3'), 'audio content');

            const mediaDir = path.join(tempDir, 'media');
            fs.mkdirSync(mediaDir);

            (documentMinifier as any).exportMediaToMediaDirAndReplace(inputDir, mediaDir);

            expect(fs.existsSync(path.join(mediaDir, 'image.png'))).toBe(true);
            expect(fs.readFileSync(path.join(mediaDir, 'image.png'), 'utf8')).toBe('image content');
            expect(fs.existsSync(path.join(mediaDir, 'video.mp4'))).toBe(true);
            expect(fs.readFileSync(path.join(mediaDir, 'video.mp4'), 'utf8')).toBe('video content');
            expect(fs.existsSync(path.join(mediaDir, 'audio.mp3'))).toBe(true);
            expect(fs.readFileSync(path.join(mediaDir, 'audio.mp3'), 'utf8')).toBe('audio content');
        });

        it('should move media files from subdirectories to media directory as placeholders', () => {
            const inputDir = path.join(tempDir, 'input');
            fs.mkdirSync(inputDir);
            fs.mkdirSync(path.join(inputDir, 'subdir1'));
            fs.mkdirSync(path.join(inputDir, 'subdir2'));
            fs.writeFileSync(path.join(inputDir, 'subdir1/image1.png'), 'image content 1');
            fs.writeFileSync(path.join(inputDir, 'subdir2/video1.mp4'), 'video content 1');

            const mediaDir = path.join(tempDir, 'media');
            fs.mkdirSync(mediaDir);

            (documentMinifier as any).exportMediaToMediaDirAndReplace(inputDir, mediaDir);

            expect(fs.existsSync(path.join(mediaDir, 'subdir1', 'image1.png'))).toBe(true);
            expect(fs.readFileSync(path.join(mediaDir, 'subdir1', 'image1.png'), 'utf8')).toBe(
                'image content 1',
            );
            expect(fs.existsSync(path.join(mediaDir, 'subdir2', 'video1.mp4'))).toBe(true);
            expect(fs.readFileSync(path.join(mediaDir, 'subdir2', 'video1.mp4'), 'utf8')).toBe(
                'video content 1',
            );
        });

        it('should throw DocumentMinificationError on file operation error', () => {
            const inputDir = path.join(tempDir, 'input');
            fs.mkdirSync(inputDir);
            fs.writeFileSync(path.join(inputDir, 'image.png'), 'image content');

            const mediaDir = path.join(tempDir, 'media');
            fs.mkdirSync(mediaDir);
            fs.chmodSync(mediaDir, 0o444); // read-only directory

            expect(() => {
                (documentMinifier as any).exportMediaToMediaDirAndReplace(inputDir, mediaDir);
            }).toThrow(DocumentMinificationError);
        });
    });

    describe('replaceMediaInDir', () => {
        let documentMinifier: DocumentMinifier;
        let tempDir: string;
        let inputDirectory: string;
        let mediaDirectory: string;

        beforeEach(() => {
            tempDir = fs.mkdtempSync('test-doc-minifier-');
            documentMinifier = new DocumentMinifier(tempDir);

            inputDirectory = path.join(tempDir, 'input');
            mediaDirectory = path.join(tempDir, 'media');
            fs.mkdirSync(inputDirectory, { recursive: true });
            fs.mkdirSync(mediaDirectory, { recursive: true });
        });

        afterEach(() => {
            FsHelper.removeSyncRecursive(tempDir);
        });

        test('should move media files back to input directory and create directories if they do not exist', () => {
            const mediaFilePath = path.join(mediaDirectory, 'image.png');
            fs.mkdirSync(path.dirname(mediaFilePath), { recursive: true });
            fs.writeFileSync(mediaFilePath, 'image content');

            (documentMinifier as any).replaceMediaInDir(inputDirectory, mediaDirectory);

            const inputFilePath = path.join(inputDirectory, 'image.png');
            expect(fs.existsSync(inputFilePath)).toBe(true);
            expect(fs.readFileSync(inputFilePath, 'utf-8')).toBe('image content');
        });

        test('should move media files from subdirectories back to input directory', () => {
            const subDirMediaPath = path.join(mediaDirectory, 'subdir1', 'image1.png');
            fs.mkdirSync(path.dirname(subDirMediaPath), { recursive: true });
            fs.writeFileSync(subDirMediaPath, 'image content 1');

            const subDirInputPath = path.join(inputDirectory, 'subdir1');
            fs.mkdirSync(subDirInputPath, { recursive: true });

            (documentMinifier as any).replaceMediaInDir(inputDirectory, mediaDirectory);

            const inputFilePath = path.join(subDirInputPath, 'image1.png');
            expect(fs.existsSync(inputFilePath)).toBe(true);
            expect(fs.readFileSync(inputFilePath, 'utf-8')).toBe('image content 1');
        });
    });

    describe('canMinifyFile', () => {
        it('should return true for supported file types', () => {
            expect(DocumentMinifier.canMinifyFile('test.pptx')).toBe(true);
            expect(DocumentMinifier.canMinifyFile('test.docx')).toBe(true);
        });

        it('should return false for unsupported file types', () => {
            expect(DocumentMinifier.canMinifyFile('test.pdf')).toBe(false);
            expect(DocumentMinifier.canMinifyFile('test.txt')).toBe(false);
            expect(DocumentMinifier.canMinifyFile('')).toBe(false);
        });
    });
});
