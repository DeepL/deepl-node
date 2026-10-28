import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { randomUUID } from 'crypto';
import { DocumentDeminificationError, DocumentMinificationError } from './errors';
import AdmZip from 'adm-zip';
import { FsHelper } from './fsHelper';

interface IDocumentMinifier {
    /**
     * Minifies a given document by extracting it as a ZIP file and replacing all supported media files
     * with a small placeholder. Created file will be inside the `tempDir`. The filename can be retrieved by calling
     * {@link DocumentMinifier.getMinifiedDocFile} with tempDir as a parameter. Note: This method will minify the file without any checks. You should first call
     * {@link DocumentMinifier.canMinifyFile} on the input file. If `cleanup` is `true`, the extracted document will be deleted afterwards, and only
     * the original media and the minified file will remain in the `tempDir`.
     *
     * @param inputFilePath - Path to the file to be minified
     * @param cleanup - If true, will delete the extracted document files from the temporary directory.
     *                 Otherwise, the files will remain (useful for debugging).
     *                 Default behavior is not to cleanup.
     * @returns The path of the minified document. Can also be retrieved by calling
     *          {@link DocumentMinifier.getMinifiedDocFile}
     * @throws {DocumentMinificationError} If an error occurred during the minification process
     */
    minifyDocument(inputFilePath: string, cleanup?: boolean): string;

    /**
     * Deminifies a given file at `inputFilePath` by reinserting its original media in `tempDir` and stores
     * the resulting document in `outputFilePath`. If `cleanup` is set to `true`, it will delete the
     * `tempDir` afterwards; otherwise, nothing will happen after the deminification.
     *
     * @param inputFilePath Path to the document to be deminified with its media.
     * @param outputFilePath Where the final (deminified) document will be stored.
     * @param cleanup Determines if the `tempDir` is deleted at the end of this method. Default behavior is not to cleanup.
     * @throws {DocumentDeminificationError} If an error occurred during the deminification process.
     */
    deminifyDocument(inputFilePath: string, outputFilePath: string, cleanup?: boolean): void;
}

/**
 * Class that implements document minification: Stripping supported files like pptx and docx
 * of their media (images, videos, etc) before uploading them to the DeepL API to be translated.
 * This allows users to translate files that would usually hit the size limit for files.
 *
 * @note Please note the following:
 * 1. To use this class, you first need to check by calling {@link DocumentMinifier.canMinifyFile}
 *    if the file type is supported. This class performs no further checks.
 * 2. The {@link DocumentMinifier} is stateful, so you cannot use it to minify multiple documents at once.
 *    You need to create a new {@link DocumentMinifier} object per document.
 * 3. Be very careful when providing a custom `tempDir` when instantiating the class. For example,
 *    {@link DocumentMinifier.deminifyDocument} will delete the entire `tempDir` with
 *    `cleanup` set to `true` (disabled by default). In order not to lose any data, ideally always
 *    call `new DocumentMinifier()` in order to get a fresh temporary directory.
 * 4. If an error occurs during minification, either a {@link DocumentMinificationError} or a
 *    {@link DocumentDeminificationError} will be thrown, depending on which phase the error
 *    occurred in.
 *
 * The document minification process works in 2 phases:
 * 1. Minification: The document is extracted into a temporary directory, the media files are backed up,
 *    the media in the document is replaced with placeholders and a minified document is created.
 * 2. Deminification: The minified document is extracted into a temporary directory, the media backups are
 *    reinserted into the extracted document, and the document is deminified into the output path.
 *
 * If `cleanup` is enabled, the minification phase will delete the folder with the extracted document
 * and the deminification phase will delete the entire temporary directory.
 * Note that by default, the input file will be kept on disk, and as such no further backups of media etc.
 * are made (as they are all available from the input file).
 *
 * @example
 *     const inputFile = "/home/exampleUser/document.pptx";
 *     const outputFile = "/home/exampleUser/document_ES.pptx";
 *     const minifier = new DocumentMinifier();
 *     if (DocumentMinifier.canMinifyFile(inputFile)) {
 *       try {
 *         const minifiedFile = minifier.minifyDocument(inputFile, true);
 *         // process file minifiedFile, e.g. translate it with DeepL
 *         minifier.deminifyDocument(minifiedFile, outputFile, true);
 *         // process file outputFile
 *       } catch (e) {
 *         if (e instanceof DocumentMinificationError) {
 *           // handle error during minification, e.g. print list of media, clean up temporary directory, etc
 *         } else if (e instanceof DocumentDeminificationError) {
 *           // handle error during deminification, e.g. save minified document, clean up temporary directory, etc
 *         } else if (e instanceof DocumentTranslationError) {
 *           // handle general DocTrans error (mostly useful if document is translated between minification
 *           // and deminification)
 *         }
 *       }
 *     }
 *
 * @deprecated Document minification is deprecated and will be removed in the next major version.
 * The DeepL API accepts larger documents; see the usage limits:
 * https://developers.deepl.com/docs/resources/usage-limits
 */
export class DocumentMinifier implements IDocumentMinifier {
    /** Which input document types are supported for minification. */
    private static readonly SUPPORTED_DOCUMENT_TYPES: string[] = ['.pptx', '.docx'];

    /** Which media formats in the documents are supported for minification. */
    private static readonly SUPPORTED_MEDIA_FORMATS: string[] = [
        // Image formats
        '.png',
        '.jpg',
        '.jpeg',
        '.emf',
        '.bmp',
        '.tiff',
        '.wdp',
        '.svg',
        '.gif',
        // Video formats
        // Taken from https://support.microsoft.com/en-gb/office/video-and-audio-file-formats-supported-in-powerpoint-d8b12450-26db-4c7b-a5c1-593d3418fb59
        '.mp4',
        '.asf',
        '.avi',
        '.m4v',
        '.mpg',
        '.mpeg',
        '.wmv',
        '.mov',
        // Audio formats, taken from the same URL as video
        '.aiff',
        '.au',
        '.mid',
        '.midi',
        '.mp3',
        '.m4a',
        '.wav',
        '.wma',
    ];

    private static readonly EXTRACTED_DOC_DIR_NAME = 'extracted_doc';
    private static readonly ORIGINAL_MEDIA_DIR_NAME = 'original_media';
    private static readonly MINIFIED_DOC_FILE_BASE_NAME = 'minifiedDoc';
    private static readonly MINIFIED_DOC_SIZE_LIMIT_WARNING = 5000000;

    private static readonly MEDIA_PLACEHOLDER_TEXT = 'DeepL Media Placeholder';

    private readonly _tempDir: string;

    constructor(tempDir?: string) {
        this._tempDir = tempDir ?? DocumentMinifier.createTemporaryDirectory();
    }

    /**
     * Checks if a given file can be minified or not
     * @param inputFilePath The path to the file
     * @returns true if the file can be minified, otherwise false
     */
    public static canMinifyFile(inputFilePath: string): boolean {
        return (
            inputFilePath !== undefined &&
            inputFilePath !== null &&
            inputFilePath.trim() !== '' &&
            DocumentMinifier.SUPPORTED_DOCUMENT_TYPES.includes(
                path.extname(inputFilePath).toLowerCase(),
            )
        );
    }

    /**
     * Gets the path for where the minified version of the input file will live
     * @param inputFilePath The path to the file
     * @returns The path to the minified version of the file
     */
    public getMinifiedDocFile(inputFilePath: string): string {
        const minifiedDocFileName =
            DocumentMinifier.MINIFIED_DOC_FILE_BASE_NAME + path.extname(inputFilePath);
        return path.join(this._tempDir, minifiedDocFileName);
    }

    /**
     * Gets the path to the directory where the input file will be extracted to
     * @returns The path to the directory where the input file will be extracted to
     */
    public getExtractedDocDirectory(): string {
        return path.join(this._tempDir, DocumentMinifier.EXTRACTED_DOC_DIR_NAME);
    }

    /**
     * Gets the path to the directory where the original media was extracted to
     * @returns The path to the media directory containing the original media
     */
    public getOriginalMediaDirectory(): string {
        return path.join(this._tempDir, DocumentMinifier.ORIGINAL_MEDIA_DIR_NAME);
    }

    public minifyDocument(inputFilePath: string, cleanup = false): string {
        const extractedDocDirectory = this.getExtractedDocDirectory();
        const mediaDir = this.getOriginalMediaDirectory();
        const minifiedDocFilePath = this.getMinifiedDocFile(inputFilePath);

        try {
            this.extractZipToDirectory(inputFilePath, extractedDocDirectory);
        } catch (error) {
            throw new DocumentMinificationError(
                `Error when extracting document: Failed to extract ${inputFilePath} to ${extractedDocDirectory}. Error: ${error}`,
            );
        }

        this.exportMediaToMediaDirAndReplace(extractedDocDirectory, mediaDir);

        try {
            this.createZipFromDirectory(extractedDocDirectory, minifiedDocFilePath);
        } catch (error) {
            throw new DocumentMinificationError(
                `Failed creating a zip file at ${minifiedDocFilePath}. Error: ${error}`,
            );
        }

        if (cleanup) {
            try {
                FsHelper.removeSyncRecursive(extractedDocDirectory);
            } catch (error) {
                throw new DocumentMinificationError(
                    `Failed to delete directory ${extractedDocDirectory}. Error: ${error}`,
                );
            }
        }

        const fileSize = fs.statSync(minifiedDocFilePath).size;
        if (fileSize > DocumentMinifier.MINIFIED_DOC_SIZE_LIMIT_WARNING) {
            console.error(
                'The input file could not be minified below 5 MB, likely a media type is missing. ' +
                    'This might cause the translation to fail.',
            );
        }

        return minifiedDocFilePath;
    }

    public deminifyDocument(inputFilePath: string, outputFilePath: string, cleanup = false): void {
        const extractedDocDirectory = this.getExtractedDocDirectory();
        const mediaDir = this.getOriginalMediaDirectory();

        if (!fs.existsSync(extractedDocDirectory)) {
            try {
                fs.mkdirSync(extractedDocDirectory);
            } catch (error) {
                throw new DocumentDeminificationError(
                    `Error when deminifying, could not create directory at ${extractedDocDirectory}. Error: ${error}`,
                );
            }
        }

        try {
            this.extractZipToDirectory(inputFilePath, extractedDocDirectory);
        } catch (error) {
            throw new DocumentDeminificationError(
                `Error when extracting document: Failed to extract ${inputFilePath} to ${extractedDocDirectory}. Error: ${error}`,
            );
        }

        try {
            this.replaceMediaInDir(extractedDocDirectory, mediaDir);
        } catch (error) {
            throw new DocumentDeminificationError(`Error when deminifying images. Error: ${error}`);
        }

        try {
            if (fs.existsSync(outputFilePath)) {
                fs.unlinkSync(outputFilePath);
            }
            this.createZipFromDirectory(extractedDocDirectory, outputFilePath);
        } catch (error) {
            throw new DocumentMinificationError(
                `Failed creating a zip file at ${outputFilePath}. Error: ${error}`,
            );
        }

        if (cleanup) {
            try {
                FsHelper.removeSyncRecursive(this._tempDir);
            } catch (error) {
                throw new DocumentMinificationError(
                    `Failed to delete directory ${extractedDocDirectory}. Error: ${error}`,
                );
            }
        }
    }

    /**
     * Creates a temporary directory for use in the {@link DocumentMinifier}.
     * Uses the system's temporary directory.
     *
     * @returns The path of the created temporary directory
     * @throws {DocumentMinificationError} If the temporary directory could not be created
     */
    private static createTemporaryDirectory(): string {
        const tempDir = path.join(os.tmpdir(), 'document_minification_' + randomUUID());

        if (fs.existsSync(tempDir)) {
            throw new DocumentMinificationError(
                `Temporary directory already exists at ${tempDir}. Please try again.`,
            );
        }

        try {
            fs.mkdirSync(tempDir);
        } catch (error) {
            throw new DocumentMinificationError(`Failed creating temporary directory at ${error}`);
        }

        return tempDir;
    }

    /**
     * Extracts a zip file to a given directory
     * @param zippedDocumentPath The path to the zip file
     * @param extractionDir The path to the directory where the contents of the zip file will be extracted to
     */
    private extractZipToDirectory(zippedDocumentPath: string, extractionDir: string): void {
        if (!fs.existsSync(extractionDir)) {
            fs.mkdirSync(extractionDir);
        }

        const zip = new AdmZip(zippedDocumentPath);
        zip.extractAllTo(extractionDir, true);
    }

    /**
     * Creates a zip file from a given directory.
     * @param sourceDir The path to the directory that needs to be zipped
     * @param outputPath The path to the output zip file
     */
    private createZipFromDirectory(sourceDir: string, outputPath: string): void {
        const zip = new AdmZip();
        zip.addLocalFolder(sourceDir);
        zip.writeZip(outputPath);
    }

    /**
     * Iterates through the inputDirectory and if it contains a supported media file, will export that media
     * to the mediaDirectory and replace the media in the inputDirectory with a placeholder. The
     * relative path will be preserved when moving the file to the mediaDirectory (e.g. a file located at
     * "/inputDirectory/foo/bar.png" will be exported to "/mediaDirectory/foo/bar.png")
     *
     * @param inputDirectory The path to the input directory
     * @param mediaDirectory The path to the directory where the supported media from inputDirectory will be exported to
     * @throws {DocumentMinificationError} If a problem occurred when exporting the original media from inputDirectory to mediaDirectory
     */
    private exportMediaToMediaDirAndReplace(inputDirectory: string, mediaDirectory: string): void {
        const files = FsHelper.readdirSyncRecursive(inputDirectory);
        for (const file of files) {
            const ext = path.extname(file).toLowerCase();
            const isSupportedFile = DocumentMinifier.SUPPORTED_MEDIA_FORMATS.includes(ext);
            if (isSupportedFile) {
                const filePath = path.join(inputDirectory, file);
                const mediaPath = path.join(mediaDirectory, file);

                try {
                    const mediaPathParentDir = path.dirname(mediaPath);
                    if (!fs.existsSync(mediaPathParentDir)) {
                        fs.mkdirSync(mediaPathParentDir, { recursive: true });
                    }

                    fs.renameSync(filePath, mediaPath);
                    fs.writeFileSync(filePath, DocumentMinifier.MEDIA_PLACEHOLDER_TEXT);
                } catch (error) {
                    throw new DocumentMinificationError(
                        'Error when exporting and replacing media files',
                        error as Error,
                    );
                }
            }
        }
    }

    /**
     * Iterates through `mediaDirectory` and moves all files into the `inputDirectory` while preserving
     * the relative paths. (e.g. /mediaDirectory/foo/bar.png will be moved to the path /inputDirectory/foo/bar.png
     * and replace any file if it exists at that path. Any subdirectories in `mediaDirectory` will also be
     * created in `inputDirectory`.
     *
     * @param inputDirectory The path to the input directory
     * @param mediaDirectory The path to the directory where the original media lives. This media will be reinserted back and replace any
     * placeholder media.
     * @throws {DocumentMinificationError} If a problem occurred when trying to reinsert the media
     */
    private replaceMediaInDir(inputDirectory: string, mediaDirectory: string): void {
        if (!fs.existsSync(mediaDirectory)) {
            // if document has no images
            return;
        }

        const filesAndDirs = FsHelper.readdirSyncRecursive(mediaDirectory);
        const files = filesAndDirs.filter((file) => {
            const ext = path.extname(file).toLowerCase();
            const isSupportedFile = DocumentMinifier.SUPPORTED_MEDIA_FORMATS.includes(ext);
            return isSupportedFile;
        });
        for (const file of files) {
            const mediaPath = path.join(mediaDirectory, file);
            const inputPath = path.join(inputDirectory, file);
            const inputPathParentDir = path.dirname(inputPath);

            if (!fs.existsSync(inputPathParentDir)) {
                try {
                    fs.mkdirSync(inputPathParentDir, { recursive: true });
                } catch (error) {
                    throw new DocumentMinificationError(
                        `Error when reinserting media. Failed to create directory at ${inputPathParentDir}.`,
                        error as Error,
                    );
                }
            }

            try {
                if (fs.existsSync(inputPath)) {
                    fs.unlinkSync(inputPath);
                }

                fs.renameSync(mediaPath, inputPath);
            } catch (error) {
                throw new DocumentMinificationError(
                    `Error when reinserting media. Failed to move media back to ${inputPath}`,
                    error as Error,
                );
            }
        }
    }
}
