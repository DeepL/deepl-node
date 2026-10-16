import * as path from 'path';
import * as fs from 'fs';
import { DocumentMinifier } from '../../../src/documentMinifier';
import { FsHelper } from '../../../src/fsHelper';
import { testFilePaths } from '../../core';
import { createMinifiableTestDocument } from '../../minifiableDocuments';
import AdmZip from 'adm-zip';
import { createHash } from 'crypto';
import mock from 'mock-fs';

describe('DocumentMinifier', () => {
    beforeEach(() => {
        // Use in-memory file system for fs, but load real folder from tests/resources
        mock({
            'tests/resources': mock.load('tests/resources'),
        });
    });

    afterEach(() => {
        mock.restore();
    });

    describe('minifyDocument', () => {
        let tempDir: string;
        let documentMinifier: DocumentMinifier;

        beforeEach(() => {
            tempDir = fs.mkdtempSync('test-doc-minifier-');
            documentMinifier = new DocumentMinifier(tempDir);
        });

        afterEach(() => {
            FsHelper.removeSyncRecursive(tempDir);
        });

        it.each([testFilePaths.pptx, testFilePaths.docx])(
            'should make the file size smaller for %s',
            (testFilePath) => {
                documentMinifier = new DocumentMinifier(tempDir);

                const tempZipContentDirectory = path.join(tempDir, 'test-document-zip-content');
                fs.mkdirSync(tempZipContentDirectory);
                const testDocumentPath = createMinifiableTestDocument(
                    testFilePath,
                    tempZipContentDirectory,
                    tempDir,
                );
                FsHelper.removeSyncRecursive(tempZipContentDirectory);

                const minifiedDocumentPath = documentMinifier.minifyDocument(
                    testDocumentPath,
                    false,
                );

                const minifiedFileSize = fs.statSync(minifiedDocumentPath).size;
                expect(minifiedFileSize).toBeLessThan(fs.statSync(testDocumentPath).size);
                expect(minifiedFileSize).toBeGreaterThanOrEqual(100);
                expect(minifiedFileSize).toBeLessThanOrEqual(50000);
            },
        );

        it.each([testFilePaths.pptx, testFilePaths.docx])(
            'should handle correctly when cleanup=true for %s',
            (testFilePath) => {
                const minifiedDocumentPath = documentMinifier.minifyDocument(testFilePath, true);

                expect(fs.existsSync(documentMinifier.getExtractedDocDirectory())).toBe(false);
                expect(fs.existsSync(documentMinifier.getOriginalMediaDirectory())).toBe(true);
                expect(fs.existsSync(minifiedDocumentPath)).toBe(true);
            },
        );

        it.each([testFilePaths.pptx, testFilePaths.docx])(
            'should handle cleanup=false for %s',
            (testFilePath) => {
                const minifiedDocumentPath = documentMinifier.minifyDocument(testFilePath, false);

                expect(fs.existsSync(documentMinifier.getExtractedDocDirectory())).toBe(true);
                expect(fs.existsSync(documentMinifier.getOriginalMediaDirectory())).toBe(true);
                expect(fs.existsSync(minifiedDocumentPath)).toBe(true);
            },
        );

        it('should throw an error for a file that cannot be extracted', () => {
            const unsupportedFilePath = 'unsupported_file.txt';

            jest.spyOn(documentMinifier as any, 'extractZipToDirectory').mockImplementationOnce(
                () => {
                    throw new Error('Custom error message');
                },
            );

            expect(() => {
                documentMinifier.minifyDocument(unsupportedFilePath, false);
            }).toThrowError(/Error when extracting document/);
        });

        it('should throw an error for a file that cannot be extracted', () => {
            const testFilePath = testFilePaths.docx;

            jest.spyOn(documentMinifier as any, 'createZipFromDirectory').mockImplementationOnce(
                () => {
                    throw new Error('Custom error message');
                },
            );

            expect(() => {
                documentMinifier.minifyDocument(testFilePath, false);
            }).toThrowError(/Failed creating a zip file/);
        });

        it('should throw an error if cleanup fails', () => {
            const testFilePath = testFilePaths.docx;
            jest.spyOn(FsHelper, 'removeSyncRecursive').mockImplementationOnce(() => {
                throw new Error('Custom error message');
            });

            expect(() => {
                documentMinifier.minifyDocument(testFilePath, true);
            }).toThrowError(/Failed to delete directory/);
        });

        it('should throw an error if the file is over the limit', () => {
            const testFilePath = testFilePaths.docx;

            const previousLimit = (documentMinifier as any).MINIFIED_DOC_SIZE_LIMIT_WARNING;
            (DocumentMinifier as any).MINIFIED_DOC_SIZE_LIMIT_WARNING = 1;

            const consoleErrorSpy = jest.spyOn(console, 'error');
            documentMinifier.minifyDocument(testFilePath, false);

            expect(consoleErrorSpy).toHaveBeenCalled();
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'The input file could not be minified below 5 MB, likely a media type is missing. ' +
                    'This might cause the translation to fail.',
            );

            (DocumentMinifier as any).MINIFIED_DOC_SIZE_LIMIT_WARNING = previousLimit;
        });
    });

    describe('deminifyDocument', () => {
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

        it.each([testFilePaths.docx, testFilePaths.pptx])(
            'should deminify a zipped file and be approximately the same as the original file %s',
            (originalFile) => {
                const inputFilePath = testFilePaths.zip;
                const outputFilePath = `${tempDir}/deminified${path.extname(originalFile)}`;

                documentMinifier.minifyDocument(originalFile);
                documentMinifier.deminifyDocument(inputFilePath, outputFilePath);

                const originalFileSize = fs.statSync(originalFile).size;
                const outputFileSize = fs.statSync(outputFilePath).size;

                expect(Math.abs(originalFileSize - outputFileSize)).toBeLessThanOrEqual(1000);
            },
        );

        it('should handle correctly when cleanup=false', () => {
            const originalFile = testFilePaths.docx;
            const inputFilePath = testFilePaths.zip;
            const outputFilePath = `${tempDir}/deminified.docx`;

            documentMinifier.minifyDocument(originalFile);
            documentMinifier.deminifyDocument(inputFilePath, outputFilePath);

            expect(fs.existsSync(tempDir)).toBe(true);
        });

        it('should handle correctly when cleanup=true', () => {
            const originalFile = testFilePaths.docx;
            const inputFilePath = testFilePaths.zip;
            const outputFilePath = `${tempDir}/deminified.docx`;

            documentMinifier.minifyDocument(originalFile);
            documentMinifier.deminifyDocument(inputFilePath, outputFilePath, true);

            expect(fs.existsSync(tempDir)).toBe(false);
        });

        it('should throw an error if unzipping fails', () => {
            const inputFilePath = testFilePaths.zip;
            const outputFilePath = `${tempDir}/deminified.docx`;

            jest.spyOn(documentMinifier as any, 'extractZipToDirectory').mockImplementationOnce(
                () => {
                    throw new Error('Custom error message');
                },
            );

            expect(() => {
                documentMinifier.deminifyDocument(inputFilePath, outputFilePath);
            }).toThrowError(/Failed to extract/);
        });

        it('should replace existing outputFilePath if it already exists', () => {
            documentMinifier.minifyDocument(testFilePaths.docx);

            const inputFilePath = testFilePaths.zip;
            const outputFilePath = `${tempDir}/deminified.docx`;

            fs.writeFileSync(outputFilePath, 'pre-existing content');

            documentMinifier.deminifyDocument(inputFilePath, outputFilePath);

            expect(fs.readFileSync(outputFilePath, 'utf-8')).not.toBe('pre-existing content');
        });

        it('should throw an error if zipping failed', () => {
            documentMinifier.minifyDocument(testFilePaths.docx);

            const inputFilePath = testFilePaths.zip;
            const outputFilePath = `${tempDir}/deminified.docx`;

            jest.spyOn(documentMinifier as any, 'createZipFromDirectory').mockImplementationOnce(
                () => {
                    throw new Error('Custom error message');
                },
            );

            expect(() => {
                documentMinifier.deminifyDocument(inputFilePath, outputFilePath);
            }).toThrowError(/Failed creating a zip file/);
        });
    });

    describe('minify and deminify round trip', () => {
        let tempDir: string;

        beforeEach(() => {
            tempDir = fs.mkdtempSync('test-doc-minifier-');
        });

        afterEach(() => {
            FsHelper.removeSyncRecursive(tempDir);
        });

        /** Maps the name of every file in the zip to a hash of its content. */
        function contentOf(zipPath: string): Record<string, string> {
            const content: Record<string, string> = {};
            for (const entry of new AdmZip(zipPath).getEntries()) {
                if (!entry.isDirectory) {
                    content[entry.entryName] = createHash('sha1')
                        .update(entry.getData())
                        .digest('hex');
                }
            }
            return content;
        }

        it('restores the original media of a document', () => {
            const original = createMinifiableTestDocument(
                testFilePaths.docx,
                path.join(tempDir, 'content'),
                tempDir,
                200000,
            );
            const minifier = new DocumentMinifier(tempDir);
            const minified = minifier.minifyDocument(original);
            const output = path.join(tempDir, 'restored.docx');

            minifier.deminifyDocument(minified, output);

            expect(contentOf(minified)).not.toEqual(contentOf(original));
            expect(contentOf(output)).toEqual(contentOf(original));
        });

        it('minifies and deminifies a document without media', () => {
            const minifier = new DocumentMinifier(tempDir);
            const minified = minifier.minifyDocument(testFilePaths.no_media);
            const output = path.join(tempDir, 'restored.docx');

            minifier.deminifyDocument(minified, output);

            expect(fs.existsSync(output)).toBe(true);
            expect(contentOf(output)).toEqual(contentOf(testFilePaths.no_media));
        });
    });
});
