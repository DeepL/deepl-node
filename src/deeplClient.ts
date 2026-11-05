// Copyright 2025 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import { HttpClient, SendRequestOptions, buildRequestHeaders, createHttpClient } from './client';
import {
    BaseRequestOptions,
    RequestOptions,
    DocumentHandle,
    DocumentStatus,
    DocumentTranslateOptions,
    GlossaryInfo,
    GlossaryLanguagePair,
    Language,
    LanguageCodeInput,
    SourceLanguageCodeInput,
    TargetLanguageCodeInput,
    TextResult,
    TranslateTextOptions,
    Usage,
    CreateMultilingualGlossaryOptions,
    DeepLClientOptions,
    ReplaceMultilingualGlossaryDictionaryOptions,
    UpdateMultilingualGlossaryOptions,
    WriteResult,
    MultilingualGlossaryDictionaryEntries,
    MultilingualGlossaryInfo,
    MultilingualGlossaryDictionaryInfo,
    GlossaryId,
    CorrectTextOptions,
    CreateSpokenTermsOptions,
    ReplaceSpokenTermsListOptions,
    SpokenTerms,
    SpokenTermsEntries,
    SpokenTermsList,
    UpdateSpokenTermsOptions,
    StyleProfile,
    CreateStyleProfileOptions,
    UpdateStyleProfileOptions,
    StyleRuleInfo,
    StyleId,
    CustomInstruction,
    CreateStyleRuleOptions,
    UpdateStyleRuleNameOptions,
    UpdateStyleRuleConfiguredRulesOptions,
    CreateStyleRuleCustomInstructionOptions,
    UpdateStyleRuleCustomInstructionOptions,
    TranslationMemoryId,
    TranslationMemoryInfo,
    TranslationMemoryExport,
    TranslationMemoryImport,
    TranslationMemoryJob,
    TranslationMemorySegments,
    TranslationMemorySegmentsOptions,
    CreateTranslationMemoryImportOptions,
    ImportTranslationMemoryOptions,
    WaitOptions,
    LanguageResource,
    LanguageResourceName,
    GetLanguagesForResourceOptions,
    LanguageSupport,
    RephraseTextOptions,
} from './types';
import {
    parseMultilingualGlossaryDictionaryInfo,
    parseDocumentHandle,
    parseDocumentStatus,
    parseGlossaryInfo,
    parseGlossaryInfoList,
    parseGlossaryLanguagePairArrayV3,
    parseSourceLanguageArrayV3,
    parseTargetLanguageArrayV3,
    parseTextResultArray,
    parseUsage,
    parseMultilingualGlossaryInfo,
    parseWriteResultArray,
    parseMultilingualGlossaryDictionaryEntries,
    parseListMultilingualGlossaries,
    parseSpokenTerms,
    parseSpokenTermsArray,
    parseSpokenTermsEntries,
    parseSpokenTermsList,
    parseStyleProfile,
    parseStyleProfileList,
    parseStyleRuleInfoList,
    parseStyleRuleInfo,
    parseCustomInstruction,
    parseTranslationMemoryExport,
    parseTranslationMemoryImport,
    parseTranslationMemoryInfoJson,
    parseTranslationMemoryInfoList,
    parseTranslationMemoryJob,
    parseTranslationMemorySegments,
    parseLanguageResourceList,
    parseLanguageSupportList,
    parseResponse,
} from './parsing';
import {
    buildTranslationBody,
    checkStatusCode,
    csvDictionaryToJson,
    dictionaryEntriesToJson,
    isFreeAccountAuthKey,
    mergeExtraBodyParameters,
    nonRegionalLanguageCode,
    setStyleAndTranslationMemoryOptions,
    setTextsAndReturnIsSingular,
    toFormParameters,
    validateAndSetTextOptions,
    extractGlossaryId,
    extractSpokenTermsId,
    extractStyleProfileId,
    extractTranslationMemoryId,
    isString,
    streamToBuffer,
    streamToString,
    logInfo,
    buildQueryString,
    setExtraBodyParameters,
    timeout,
    pipeToStream,
} from './utils';
import {
    ArgumentError,
    DeepLError,
    DocumentTranslationError,
    NotFoundError,
    TranslationMemoryJobError,
} from './errors';
import { GlossaryEntries } from './glossaryEntries';
import { IncomingMessage } from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';

/**
 * Returns an ArgumentError for a missing input file, or undefined for any other error.
 */
function missingInputFileError(inputFile: string, error: unknown): ArgumentError | undefined {
    if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
        return undefined;
    }
    return new ArgumentError(
        `input file '${inputFile}' does not exist: ${(error as Error).message}`,
        error as Error,
    );
}

/**
 * Rejects with an ArgumentError, before any request, if the input file path does not exist.
 * Other failures are left to the read, so they surface where the file is read.
 */
async function checkInputFileExists(inputFile: string): Promise<void> {
    try {
        await fs.promises.access(inputFile, fs.constants.F_OK);
    } catch (error) {
        const argumentError = missingInputFileError(inputFile, error);
        if (argumentError) throw argumentError;
    }
}

/**
 * Wraps a failure of a translation memory file helper in a TranslationMemoryJobError. Caller
 * cancellation is never wrapped.
 */
function toTranslationMemoryJobError(
    error: unknown,
    jobId: string | undefined,
    job: TranslationMemoryJob | undefined,
    signal: AbortSignal | undefined,
): unknown {
    if (signal?.aborted || error instanceof TranslationMemoryJobError) {
        return error;
    }
    const cause =
        error instanceof Error || util.types.isNativeError(error) ? (error as Error) : undefined;
    return new TranslationMemoryJobError(cause?.message ?? String(error), jobId, job, cause);
}

function spokenTermsEntriesToJson(entries: SpokenTermsEntries): Record<string, unknown> {
    // Terms are trimmed, then validated and sent trimmed. Terms are sent newline-separated, so a
    // newline inside a term would split it
    const terms = entries.entries.map((term) => (typeof term === 'string' ? term.trim() : term));
    terms.forEach((term) => GlossaryEntries.validateGlossaryTerm(term));
    return { lang: entries.lang, entries: terms.join('\n') };
}

/**
 * Throws a plain DeepLError for a failed upload to a pre-signed storage URL. These are not
 * DeepL API responses, so the API's status code mapping (e.g. 403 to AuthorizationError) does
 * not apply.
 */
async function throwStorageError(
    action: string,
    statusCode: number,
    content: string | IncomingMessage,
): Promise<never> {
    if (content instanceof IncomingMessage) {
        // Reading the body drains the response, so the socket is not left held
        content = await streamToString(content).catch((e) => `error reading response: ${e}`);
    }
    const error = new DeepLError(`${action}, HTTP status: ${statusCode}, content: ${content}`);
    error.httpStatusCode = statusCode;
    error.shouldRetry = statusCode === 429 || statusCode >= 500;
    throw error;
}

function multilingualGlossaryPath(glossary: GlossaryId | MultilingualGlossaryInfo): string {
    if (!glossary || !extractGlossaryId(glossary)) {
        throw new ArgumentError('Parameter "glossary" must not be empty/null');
    }
    return `/v3/glossaries/${encodeURIComponent(extractGlossaryId(glossary))}`;
}

function addExtraBodyParametersToJson(
    body: Record<string, unknown>,
    options: BaseRequestOptions | undefined,
): Record<string, unknown> {
    return mergeExtraBodyParameters(body, options?.extraBodyParameters);
}

function styleProfileOptionsToJson(
    options: CreateStyleProfileOptions | undefined,
): Record<string, unknown> {
    const body: Record<string, unknown> = {};
    if (options === undefined) return body;
    // Unset fields are not sent; '' and [] are sent, as they clear or unlink in an update
    if (options.description !== undefined) body.description = options.description;
    if (options.industry !== undefined) body.industry = options.industry;
    if (options.glossaryIds !== undefined) {
        body.glossary_ids = options.glossaryIds.map(extractGlossaryId);
    }
    if (options.styleRuleIds !== undefined) {
        body.style_rule_ids = options.styleRuleIds.map((styleRule) =>
            isString(styleRule) ? styleRule : styleRule.styleId,
        );
    }
    if (options.translationMemoryIds !== undefined) {
        body.translation_memory_ids = options.translationMemoryIds.map(extractTranslationMemoryId);
    }
    if (options.glossaryPriorityOrderEnabled !== undefined) {
        body.glossary_priority_order_enabled = options.glossaryPriorityOrderEnabled;
    }
    return body;
}

export type CustomInstructionRequestBody = {
    label: string;
    prompt: string;
    source_language?: string;
};

type CreateStyleRuleRequestBody = {
    name: string;
    language: string;
    configured_rules?: Record<string, Record<string, string>>;
    custom_instructions?: CustomInstructionRequestBody[];
};

function extractStyleRuleId(styleRule: StyleId | StyleRuleInfo): StyleId {
    const styleId = isString(styleRule) ? styleRule : styleRule?.styleId;
    if (!styleId) {
        throw new ArgumentError('Parameter "styleRule" must not be empty');
    }
    return styleId;
}

function extractCustomInstructionId(instruction: string | CustomInstruction): string {
    const instructionId = isString(instruction) ? instruction : instruction?.id;
    if (!instructionId) {
        throw new ArgumentError('Parameter "instructionId" must not be empty');
    }
    return instructionId;
}

function customInstructionPath(styleId: StyleId, instructionId: string): string {
    return `/v3/style_rules/${encodeURIComponent(styleId)}/custom_instructions/${encodeURIComponent(
        instructionId,
    )}`;
}

function customInstructionToWire(
    label: string,
    prompt: string,
    sourceLanguage?: string,
): CustomInstructionRequestBody {
    const body: CustomInstructionRequestBody = { label, prompt };
    if (sourceLanguage !== undefined) body.source_language = sourceLanguage;
    return body;
}

export enum WritingStyle {
    ACADEMIC = 'academic',
    BUSINESS = 'business',
    CASUAL = 'casual',
    DEFAULT = 'default',
    PREFER_ACADEMIC = 'prefer_academic',
    PREFER_BUSINESS = 'prefer_business',
    PREFER_CASUAL = 'prefer_casual',
    PREFER_SIMPLE = 'prefer_simple',
    SIMPLE = 'simple',
}

export enum WritingTone {
    CONFIDENT = 'confident',
    DEFAULT = 'default',
    DIPLOMATIC = 'diplomatic',
    ENTHUSIASTIC = 'enthusiastic',
    FRIENDLY = 'friendly',
    PREFER_CONFIDENT = 'prefer_confident',
    PREFER_DIPLOMATIC = 'prefer_diplomatic',
    PREFER_ENTHUSIASTIC = 'prefer_enthusiastic',
    PREFER_FRIENDLY = 'prefer_friendly',
}

/**
 * Wrapper for the DeepL API: text and document translation, glossaries, writing, style rules,
 * translation memories and the other DeepL API resources.
 */
export class DeepLClient {
    /**
     * Construct a DeepLClient object wrapping the DeepL API using your authentication key.
     * This does not connect to the API, and returns immediately.
     * @param authKey Authentication key as specified in your account.
     * @param options Additional options controlling DeepLClient behavior.
     */
    constructor(authKey: string, options: DeepLClientOptions = {}) {
        if (isString(authKey)) authKey = authKey.trim();
        if (!isString(authKey) || authKey.length === 0) {
            throw new ArgumentError('authKey must be a non-empty string');
        }

        let serverUrl;
        if (options.serverUrl !== undefined) {
            serverUrl = options.serverUrl;
        } else if (isFreeAccountAuthKey(authKey)) {
            serverUrl = 'https://api-free.deepl.com';
        } else {
            serverUrl = 'https://api.deepl.com';
        }
        const headers = buildRequestHeaders(authKey, options);
        this.httpClient = createHttpClient(serverUrl, headers, options);
        // Deliberately built from scratch rather than by subtracting Authorization from the
        // headers above: uploads and downloads of translation memory files go to pre-signed
        // Asset Store URLs outside the DeepL API, and a client that never holds the auth key
        // cannot leak it. Only the User-Agent is carried over; per-request headers such as
        // Content-Type are still supplied by the caller.
        this.storageHttpClient = createHttpClient(
            serverUrl,
            { 'User-Agent': headers['User-Agent'] },
            options,
        );
    }

    /**
     * Queries character and document usage during the current billing period.
     * @param options Optional `signal` to cancel the request, see {@link RequestOptions}.
     * @return Fulfills with Usage object on success.
     */
    public async getUsage(options?: RequestOptions): Promise<Usage> {
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'GET',
            '/v2/usage',
            { signal: options?.signal },
        );
        await checkStatusCode(statusCode, content);
        return parseUsage(content);
    }

    /**
     * Queries source languages supported by DeepL API.
     * @param options Optional `signal` to cancel the request, see {@link RequestOptions}.
     * @return Fulfills with array of Language objects containing available source languages.
     */
    async getSourceLanguages(options?: RequestOptions): Promise<readonly Language[]> {
        const data = new URLSearchParams({ resource: 'translate_text' });
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'GET',
            '/v3/languages',
            {
                data,
                signal: options?.signal,
            },
        );
        await checkStatusCode(statusCode, content);
        return parseSourceLanguageArrayV3(content);
    }

    /**
     * Queries target languages supported by DeepL API.
     * @param options Optional `signal` to cancel the request, see {@link RequestOptions}.
     * @return Fulfills with array of Language objects containing available target languages.
     */
    async getTargetLanguages(options?: RequestOptions): Promise<readonly Language[]> {
        const data = new URLSearchParams({ resource: 'translate_text' });
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'GET',
            '/v3/languages',
            {
                data,
                signal: options?.signal,
            },
        );
        await checkStatusCode(statusCode, content);
        return parseTargetLanguageArrayV3(content);
    }

    /**
     * Queries language pairs supported for glossaries by DeepL API.
     * @param options Optional `signal` to cancel the request, see {@link RequestOptions}.
     * @return Fulfills with an array of GlossaryLanguagePair objects containing languages supported for glossaries.
     */
    async getGlossaryLanguagePairs(
        options?: RequestOptions,
    ): Promise<readonly GlossaryLanguagePair[]> {
        const data = new URLSearchParams({ resource: 'glossary' });
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'GET',
            '/v3/languages',
            {
                data,
                signal: options?.signal,
            },
        );
        await checkStatusCode(statusCode, content);
        return parseGlossaryLanguagePairArrayV3(content);
    }

    /**
     * Translates specified text string or array of text strings into the target language.
     * @param texts Text string or array of strings containing input text(s) to translate.
     * @param sourceLang Language code of input text language, or null to use auto-detection.
     * @param targetLang Language code of language to translate into.
     * @param options Optional TranslateTextOptions object containing additional options controlling translation.
     * @return Fulfills with a TextResult object or an array of TextResult objects corresponding to input texts; use the `TextResult.text` property to access the translated text.
     */
    async translateText<T extends string | string[]>(
        texts: T,
        sourceLang: SourceLanguageCodeInput | null,
        targetLang: TargetLanguageCodeInput,
        options?: TranslateTextOptions,
    ): Promise<T extends string ? TextResult : TextResult[]> {
        const body = buildTranslationBody(
            sourceLang,
            targetLang,
            options?.formality,
            options?.glossary,
            options?.glossaryIds,
        );
        // Always send show_billed_characters, remove when the API default is changed to true
        body.show_billed_characters = true;
        const singular = setTextsAndReturnIsSingular(body, texts);
        validateAndSetTextOptions(body, options);

        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'POST',
            '/v2/translate',
            { jsonBody: addExtraBodyParametersToJson(body, options), signal: options?.signal },
        );
        await checkStatusCode(statusCode, content);
        const textResults = parseTextResultArray(content);
        return (singular ? textResults[0] : textResults) as T extends string
            ? TextResult
            : TextResult[];
    }

    /**
     * Uploads specified document to DeepL to translate into given target language, waits for
     * translation to complete, then downloads translated document to specified output path.
     * The create request is retried only when it was not sent, so a retry never duplicates it.
     * @param inputFile String containing file path of document to be translated, or a Stream,
     *     Buffer, or FileHandle containing file data. Note: unless file path is used, then
     *     `options.filename` must be specified. For a file path, `options.filename` defaults to
     *     the path's base name.
     * @param outputFile String containing file path to create translated document, or Stream or
     *     FileHandle to write translated document content.
     * @param sourceLang Language code of input document, or null to use auto-detection.
     * @param targetLang Language code of language to translate into.
     * @param options Optional DocumentTranslateOptions object containing additional options controlling translation.
     * @return Fulfills with a DocumentStatus object for the completed translation. You can use the
     *     billedCharacters property to check how many characters were billed for the document.
     * @throws {ArgumentError} If the input file path does not exist; no request is sent.
     * @throws {DocumentTranslationError} If any other error occurs, including an unreadable input
     *     file (the Node error, e.g. `EACCES` or `EISDIR`, is in `error`), an existing output
     *     file or a missing or unwritable output directory (checked before any request), upload,
     *     translation or download. The `documentHandle` property of the error may be used to
     *     recover the document, and `httpStatusCode` and `shouldRetry` are copied from a
     *     DeepLError cause.
     */
    async translateDocument(
        inputFile: string | Buffer | fs.ReadStream | fs.promises.FileHandle,
        outputFile: string | fs.WriteStream | fs.promises.FileHandle,
        sourceLang: SourceLanguageCodeInput | null,
        targetLang: TargetLanguageCodeInput,
        options?: DocumentTranslateOptions,
    ): Promise<DocumentStatus> {
        if (isString(inputFile)) {
            await checkInputFileExists(inputFile);
        }

        // Only a file created here is removed on error.
        let onError: (() => Promise<void>) | undefined;
        let documentHandle = undefined;
        try {
            let outputHandle: fs.WriteStream | fs.promises.FileHandle;
            if (isString(outputFile)) {
                const createdHandle = await fs.promises.open(outputFile, 'wx');
                outputHandle = createdHandle;
                onError = async () => {
                    try {
                        await createdHandle.close();
                        await util.promisify(fs.unlink)(outputFile);
                    } catch {
                        // Ignore errors
                    }
                };
            } else {
                outputHandle = outputFile;
            }

            documentHandle = await this.translateDocumentUpload(
                inputFile,
                sourceLang,
                targetLang,
                options,
            );
            const status = await this.translateDocumentWaitUntilDone(documentHandle, {
                timeoutMs: options?.timeoutMs,
                signal: options?.signal,
            });
            await this.translateDocumentDownload(documentHandle, outputHandle, {
                signal: options?.signal,
            });
            return status;
        } catch (errorUnknown: unknown) {
            if (onError) await onError();
            if (options?.signal?.aborted) {
                // Caller cancellation is never wrapped.
                throw errorUnknown;
            }
            const error =
                errorUnknown instanceof Error || util.types.isNativeError(errorUnknown)
                    ? (errorUnknown as Error)
                    : undefined;
            const message =
                'Error occurred while translating document: ' +
                (error?.message ? error?.message : errorUnknown);
            throw new DocumentTranslationError(message, documentHandle, error);
        }
    }

    /**
     * Uploads specified document to DeepL to translate into target language, and returns handle associated with the document.
     * The create request is retried only when it was not sent, so a retry never duplicates it.
     * @param inputFile String containing file path, stream containing file data, or FileHandle.
     *     Note: if a Buffer, Stream, or FileHandle is used, then `options.filename` must be specified.
     *     For a file path, `options.filename` defaults to the path's base name.
     * @param sourceLang Language code of input document, or null to use auto-detection.
     * @param targetLang Language code of language to translate into.
     * @param options Optional DocumentTranslateOptions object containing additional options controlling translation.
     * @return Fulfills with DocumentHandle associated with the in-progress translation.
     * @throws {ArgumentError} If the input file path does not exist, or a Buffer, stream or
     *     FileHandle is given without `options.filename`; no request is sent.
     * @throws {Error} The Node error (e.g. `EACCES` or `EISDIR`) if an existing input file path
     *     cannot be read; no request is sent.
     */
    async translateDocumentUpload(
        inputFile: string | Buffer | fs.ReadStream | fs.promises.FileHandle,
        sourceLang: SourceLanguageCodeInput | null,
        targetLang: TargetLanguageCodeInput,
        options?: DocumentTranslateOptions,
    ): Promise<DocumentHandle> {
        if (isString(inputFile)) {
            let buffer: Buffer;
            try {
                buffer = await fs.promises.readFile(inputFile);
            } catch (error) {
                throw missingInputFileError(inputFile, error) ?? error;
            }
            return this.internalUploadDocument(
                buffer,
                sourceLang,
                targetLang,
                options?.filename ?? path.basename(inputFile),
                options,
            );
        } else {
            if (options?.filename === undefined) {
                throw new ArgumentError(
                    'options.filename must be specified unless using input file path',
                );
            }

            if (inputFile instanceof fs.ReadStream) {
                const buffer = await streamToBuffer(inputFile);
                return this.internalUploadDocument(
                    buffer,
                    sourceLang,
                    targetLang,
                    options.filename,
                    options,
                );
            } else if (inputFile instanceof Buffer) {
                return this.internalUploadDocument(
                    inputFile,
                    sourceLang,
                    targetLang,
                    options.filename,
                    options,
                );
            } else {
                // FileHandle
                const buffer = await inputFile.readFile();
                const handle = await this.internalUploadDocument(
                    buffer,
                    sourceLang,
                    targetLang,
                    options.filename,
                    options,
                );
                await inputFile.close();
                return handle;
            }
        }
    }

    /**
     * Retrieves the status of the document translation associated with the given document handle.
     * @param handle Document handle associated with document.
     * @param options Optional `signal` to cancel the request, see {@link RequestOptions}.
     * @return Fulfills with a DocumentStatus giving the document translation status.
     */
    async translateDocumentGetStatus(
        handle: DocumentHandle,
        options?: RequestOptions,
    ): Promise<DocumentStatus> {
        const data = new URLSearchParams({ document_key: handle.documentKey });
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'POST',
            `/v2/document/${encodeURIComponent(handle.documentId)}`,
            { data, signal: options?.signal },
        );
        await checkStatusCode(statusCode, content);
        return parseDocumentStatus(content, handle.documentId);
    }

    /**
     * Downloads the translated document associated with the given document handle to the specified output file path or stream.handle.
     * @param handle Document handle associated with document.
     * @param outputFile String containing output file path, or Stream or FileHandle to store file data.
     * @param options Optional `signal` to cancel the request, see {@link RequestOptions}.
     * @return Fulfills with undefined, or rejects if the document translation has not been completed.
     * @throws {DocumentNotReadyError} If the document translation has not completed yet.
     * @throws {ConnectionError} If the connection fails while the document is downloaded.
     * @throws {Error} If the output file path already exists or cannot be created; this happens
     *     before any request is sent.
     */
    async translateDocumentDownload(
        handle: DocumentHandle,
        outputFile: string | fs.WriteStream | fs.promises.FileHandle,
        options?: RequestOptions,
    ): Promise<void> {
        if (isString(outputFile)) {
            // Created before the request, so an existing or unwritable path rejects at once
            // instead of emitting an unhandled 'error' event on the stream later.
            const fd = await util.promisify(fs.open)(outputFile, 'wx');
            const fileStream = fs.createWriteStream(outputFile, { fd });
            const streamClosed = new Promise<void>((resolve) => fileStream.once('close', resolve));
            try {
                await this.internalDownloadDocument(handle, fileStream, options);
                await streamClosed;
            } catch (e) {
                fileStream.destroy();
                await streamClosed;
                await fs.promises.unlink(outputFile).catch(() => undefined);
                throw e;
            }
        } else if (outputFile instanceof fs.WriteStream) {
            return this.internalDownloadDocument(handle, outputFile, options);
        } else {
            // FileHandle
            const dummyFilePath = '';
            const outputStream = fs.createWriteStream(dummyFilePath, { fd: outputFile.fd });
            await this.internalDownloadDocument(handle, outputStream, options);
            try {
                await outputFile.close();
            } catch {
                // Ignore errors
            }
        }
    }

    /**
     * Polls the status of the given document translation every 5 seconds until it completes.
     * Statuses this library does not know are polled through.
     * @param handle {DocumentHandle} Handle to the document translation.
     * @param options {WaitOptions} Optional `timeoutMs`: maximum time to wait in milliseconds, and
     *     `signal` to cancel the wait.
     * @return Fulfills with the final DocumentStatus when the document translation completes
     * successfully, rejects with a DeepLError if the translation fails, the timeout expires or a
     * communication error occurs.
     */
    async translateDocumentWaitUntilDone(
        handle: DocumentHandle,
        options?: WaitOptions,
    ): Promise<DocumentStatus> {
        const timeoutMs = options?.timeoutMs;
        const deadline = timeoutMs !== undefined ? Date.now() + timeoutMs : undefined;
        let status = await this.translateDocumentGetStatus(handle, options);
        while (!status.done() && status.ok()) {
            // status.secondsRemaining is currently unreliable, so just poll equidistantly
            let sleepMs = 5000;
            if (deadline !== undefined) {
                const remainingMs = deadline - Date.now();
                if (remainingMs <= 0) {
                    throw new DeepLError(
                        `Timeout of ${timeoutMs}ms exceeded for document translation`,
                    );
                }
                sleepMs = Math.min(sleepMs, remainingMs);
            }
            await timeout(sleepMs, options?.signal);
            logInfo(`Rechecking document translation status after sleeping for ${sleepMs} ms.`);
            status = await this.translateDocumentGetStatus(handle, options);
        }
        if (!status.ok()) {
            const message = status.errorMessage || 'unknown error';
            throw new DeepLError(message);
        }
        return status;
    }

    /**
     * Creates a new glossary on the DeepL server with given name, languages, and entries.
     * The create request is retried only when it was not sent, so a retry never duplicates it.
     * @param name User-defined name to assign to the glossary.
     * @param sourceLang Language code of the glossary source terms.
     * @param targetLang Language code of the glossary target terms.
     * @param entries The source- & target-term pairs to add to the glossary.
     * @param options Optional `signal` to cancel the request, see {@link RequestOptions}.
     * @return Fulfills with a GlossaryInfo containing details about the created glossary.
     */
    async createGlossary(
        name: string,
        sourceLang: LanguageCodeInput,
        targetLang: LanguageCodeInput,
        entries: GlossaryEntries,
        options?: RequestOptions,
    ): Promise<GlossaryInfo> {
        if (Object.keys(entries.entries()).length === 0) {
            throw new ArgumentError('glossary entries must not be empty');
        }

        const tsv = entries.toTsv();
        return this.internalCreateGlossary(name, sourceLang, targetLang, 'tsv', tsv, options);
    }

    /**
     * Creates a new glossary on DeepL server with given name, languages, and CSV data.
     * The create request is retried only when it was not sent, so a retry never duplicates it.
     * @param name User-defined name to assign to the glossary.
     * @param sourceLang Language code of the glossary source terms.
     * @param targetLang Language code of the glossary target terms.
     * @param csvFile String containing the path of the CSV file to be translated, or a Stream,
     *     Buffer, or a FileHandle containing CSV file content.
     * @param options Optional `signal` to cancel the request, see {@link RequestOptions}.
     * @return Fulfills with a GlossaryInfo containing details about the created glossary.
     */
    async createGlossaryWithCsv(
        name: string,
        sourceLang: LanguageCodeInput,
        targetLang: LanguageCodeInput,
        csvFile: string | Buffer | fs.ReadStream | fs.promises.FileHandle,
        options?: RequestOptions,
    ): Promise<GlossaryInfo> {
        let csvContent;
        if (isString(csvFile)) {
            csvContent = (await fs.promises.readFile(csvFile)).toString();
        } else if (csvFile instanceof fs.ReadStream) {
            csvContent = (await streamToBuffer(csvFile)).toString();
        } else if (csvFile instanceof Buffer) {
            csvContent = csvFile.toString();
        } else {
            // FileHandle
            csvContent = (await csvFile.readFile()).toString();
            await csvFile.close();
        }

        return this.internalCreateGlossary(
            name,
            sourceLang,
            targetLang,
            'csv',
            csvContent,
            options,
        );
    }

    /**
     * Gets information about an existing glossary.
     * @param glossaryId Glossary ID of the glossary.
     * @param options Optional `signal` to cancel the request, see {@link RequestOptions}.
     * @return Fulfills with a GlossaryInfo containing details about the glossary.
     */
    async getGlossary(glossaryId: GlossaryId, options?: RequestOptions): Promise<GlossaryInfo> {
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'GET',
            `/v2/glossaries/${glossaryId}`,
            { signal: options?.signal },
        );
        await checkStatusCode(statusCode, content);
        return parseGlossaryInfo(content);
    }

    /**
     * Gets information about all existing glossaries.
     * @param options Optional `signal` to cancel the request, see {@link RequestOptions}.
     * @return Fulfills with an array of GlossaryInfos containing details about all existing glossaries.
     */
    async listGlossaries(options?: RequestOptions): Promise<GlossaryInfo[]> {
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'GET',
            '/v2/glossaries',
            { signal: options?.signal },
        );
        await checkStatusCode(statusCode, content);
        return parseGlossaryInfoList(content);
    }

    /**
     * Retrieves the entries stored with the glossary with the given glossary ID or GlossaryInfo.
     * @param glossary Glossary ID or GlossaryInfo of glossary to retrieve entries of.
     * @param options Optional `signal` to cancel the request, see {@link RequestOptions}.
     * @return Fulfills with GlossaryEntries holding the glossary entries.
     */
    async getGlossaryEntries(
        glossary: GlossaryId | GlossaryInfo,
        options?: RequestOptions,
    ): Promise<GlossaryEntries> {
        glossary = isString(glossary) ? glossary : glossary.glossaryId;

        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'GET',
            `/v2/glossaries/${glossary}/entries`,
            { signal: options?.signal },
        );
        await checkStatusCode(statusCode, content);
        return new GlossaryEntries({ tsv: content });
    }

    /**
     * Deletes the glossary with the given glossary ID or GlossaryInfo.
     * @param glossary Glossary ID or GlossaryInfo of glossary to be deleted.
     * @param options Optional `signal` to cancel the request, see {@link RequestOptions}.
     * @return Fulfills with undefined when the glossary is deleted.
     */
    async deleteGlossary(
        glossary: GlossaryId | GlossaryInfo,
        options?: RequestOptions,
    ): Promise<void> {
        glossary = isString(glossary) ? glossary : glossary.glossaryId;
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'DELETE',
            `/v2/glossaries/${glossary}`,
            { signal: options?.signal },
        );
        await checkStatusCode(statusCode, content);
    }

    /**
     * Sends a POST that creates a resource. Only a request the API cannot have processed is
     * retried (429 or a request that was not sent), so a retry never creates a duplicate.
     * @private
     */
    private async sendCreateRequest(
        url: string,
        options: Omit<SendRequestOptions, 'retryOnlyUnprocessed'>,
    ): Promise<{ statusCode: number; content: string }> {
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'POST',
            url,
            { ...options, retryOnlyUnprocessed: true },
        );
        try {
            await checkStatusCode(statusCode, content);
        } catch (error) {
            // A 5xx may come after the server processed the request, so only a 429 is safe to repeat.
            if (error instanceof DeepLError) {
                error.shouldRetry = statusCode === 429;
            }
            throw error;
        }
        return { statusCode, content };
    }

    /**
     * Upload given stream for document translation and returns document handle.
     * @private
     */
    private async internalUploadDocument(
        fileBuffer: Buffer,
        sourceLang: SourceLanguageCodeInput | null,
        targetLang: TargetLanguageCodeInput,
        filename: string,
        options?: DocumentTranslateOptions,
    ): Promise<DocumentHandle> {
        const body = buildTranslationBody(
            sourceLang,
            targetLang,
            options?.formality,
            options?.glossary,
            options?.glossaryIds,
        );
        // Text translation detects the source language for a glossary; document translation
        // with a glossary requires sourceLang.
        const hasGlossary =
            options?.glossary !== undefined ||
            (options?.glossaryIds !== undefined && options.glossaryIds.length > 0);
        if (hasGlossary && sourceLang === null) {
            throw new ArgumentError('sourceLang is required if using a glossary');
        }
        setStyleAndTranslationMemoryOptions(body, options ?? {});
        const data = toFormParameters(body);
        if (options?.outputFormat !== undefined) {
            data.append('output_format', options.outputFormat);
        }
        if (options?.enableWatermark !== undefined) {
            // The API ignores '1'/'0' for this parameter; only 'true'/'false' take effect.
            data.append('enable_watermark', String(options.enableWatermark));
        }
        setExtraBodyParameters(data, options?.extraBodyParameters);
        const { content } = await this.sendCreateRequest('/v2/document', {
            data,
            fileBuffer,
            filename,
            signal: options?.signal,
        });
        return parseDocumentHandle(content);
    }

    /**
     * Download translated document associated with specified handle to given stream.
     * @private
     * @param options Optional `signal` to cancel the request, see {@link RequestOptions}.
     */
    private async internalDownloadDocument(
        handle: DocumentHandle,
        outputStream: fs.WriteStream,
        options?: RequestOptions,
    ): Promise<void> {
        const data = new URLSearchParams({ document_key: handle.documentKey });
        const { statusCode, content } =
            await this.httpClient.sendRequestWithBackoff<IncomingMessage>(
                'POST',
                `/v2/document/${encodeURIComponent(handle.documentId)}/result`,
                { data, signal: options?.signal },
                true,
            );
        await checkStatusCode(statusCode, content, true);

        return pipeToStream(content, outputStream, options?.signal);
    }

    /**
     * Create glossary with given details.
     * @private
     * @param options Optional `signal` to cancel the request, see {@link RequestOptions}.
     */
    private async internalCreateGlossary(
        name: string,
        sourceLang: LanguageCodeInput,
        targetLang: LanguageCodeInput,
        entriesFormat: string,
        entries: string,
        options?: RequestOptions,
    ): Promise<GlossaryInfo> {
        // Glossaries are only supported for base language types
        sourceLang = nonRegionalLanguageCode(sourceLang);
        targetLang = nonRegionalLanguageCode(targetLang);

        if (!isString(name) || name.length === 0) {
            throw new ArgumentError('glossary name must be a non-empty string');
        }

        const body = {
            name: name,
            source_lang: sourceLang,
            target_lang: targetLang,
            entries_format: entriesFormat,
            entries: entries,
        };

        const { content } = await this.sendCreateRequest('/v2/glossaries', {
            jsonBody: body,
            signal: options?.signal,
        });
        return parseGlossaryInfo(content);
    }

    /**
     * Rephrases the given text(s), optionally in a writing style or tone.
     * @param texts Text to rephrase, or an array of texts.
     * @param targetLang Target language code, or `null` to keep the language of the input text.
     * @param options Rephrasing options, see {@link RephraseTextOptions}.
     * @return Promise of a {@link WriteResult}, or an array of them if `texts` is an array.
     * @throws {ArgumentError} If `options` is not an object.
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async rephraseText<T extends string | string[]>(
        texts: T,
        targetLang?: string | null,
        options?: RephraseTextOptions,
    ): Promise<T extends string ? WriteResult : WriteResult[]> {
        // JavaScript callers may still pass the writing style positionally
        if (options !== undefined && options !== null && typeof options !== 'object') {
            throw new ArgumentError('options must be a RephraseTextOptions object');
        }
        const writingStyle = options?.writingStyle;
        const tone = options?.tone;

        const body: Record<string, unknown> = {};
        if (targetLang) {
            body.target_lang = targetLang;
        }

        if (writingStyle) {
            body.writing_style = writingStyle;
        }

        if (tone) {
            body.tone = tone;
        }

        const singular = setTextsAndReturnIsSingular(body, texts);
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'POST',
            '/v2/write/rephrase',
            { jsonBody: addExtraBodyParametersToJson(body, options), signal: options?.signal },
        );

        await checkStatusCode(statusCode, content);
        const writeResults = parseWriteResultArray(content, singular ? 1 : texts.length);
        return (singular ? writeResults[0] : writeResults) as T extends string
            ? WriteResult
            : WriteResult[];
    }

    /**
     * Corrects grammar, spelling and punctuation of the given text(s).
     * @param texts Text to correct, or an array of texts.
     * @param targetLang Target language code, or `null` to keep the language of the input text.
     * @param options Additional options, see {@link CorrectTextOptions}.
     * @return Promise of a {@link WriteResult}, or an array of them if `texts` is an array.
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async correctText<T extends string | string[]>(
        texts: T,
        targetLang?: string | null,
        options?: CorrectTextOptions,
    ): Promise<T extends string ? WriteResult : WriteResult[]> {
        const body: Record<string, unknown> = {};
        if (targetLang) {
            body.target_lang = targetLang;
        }

        const singular = setTextsAndReturnIsSingular(body, texts);
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'POST',
            '/v2/write/correct',
            { jsonBody: addExtraBodyParametersToJson(body, options), signal: options?.signal },
        );

        await checkStatusCode(statusCode, content);
        const writeResults = parseWriteResultArray(content, singular ? 1 : texts.length);
        return (singular ? writeResults[0] : writeResults) as T extends string
            ? WriteResult
            : WriteResult[];
    }

    /**
     * Creates a glossary with given name with all of the specified
     * dictionaries, each with their own language pair and entries. The
     * glossary may be used in the translateText functions.
     *
     * Only certain language pairs are supported. The available language pairs
     * can be queried using getGlossaryLanguages(). Glossaries are not
     * regional specific: a glossary with target language EN may be used to
     * translate texts into both EN-US and EN-GB.
     *
     * This function requires the glossary entries for each dictionary to be
     * provided as a dictionary of source-target terms. To create a glossary
     * from a CSV file downloaded from the DeepL website, see
     * {@link createMultilingualGlossaryFromCsv}.
     *
     * The create request is retried only when it was not sent, so a retry never duplicates it.
     * @param name user-defined name to attach to glossary.
     * @param glossaryDicts the dictionaries of the glossary, see {@link MultilingualGlossaryDictionaryEntries}.
     * @param options Additional options, see {@link CreateMultilingualGlossaryOptions}.
     * @return {Promise<MultilingualGlossaryInfo>} object with details about the newly created glossary.
     *
     * @throws {ArgumentError} If any argument is invalid.
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API
     */
    async createMultilingualGlossary(
        name: string,
        glossaryDicts: MultilingualGlossaryDictionaryEntries[],
        options?: CreateMultilingualGlossaryOptions,
    ): Promise<MultilingualGlossaryInfo> {
        if (!name) {
            throw new ArgumentError('glossary name must not be empty');
        }
        if (!glossaryDicts || glossaryDicts.length === 0) {
            throw new ArgumentError('Parameter "glossaryDicts" must not be empty');
        }

        const body = { name, dictionaries: dictionaryEntriesToJson(glossaryDicts) };

        const { content } = await this.sendCreateRequest('/v3/glossaries', {
            jsonBody: addExtraBodyParametersToJson(body, options),
            signal: options?.signal,
        });
        return parseMultilingualGlossaryInfo(content);
    }

    /**
     * Creates a multilingual glossary with the given name using entries from a CSV file.
     * The CSV file must contain two columns: source terms and target terms.
     * The glossary may be used in the translateText() functions.
     *
     * Only certain language pairs are supported. The available language pairs
     * can be queried using getGlossaryLanguages(). Glossaries are not
     * regional specific: a glossary with target language EN may be used to
     * translate texts into both EN-US and EN-GB.
     *
     * The create request is retried only when it was not sent, so a retry never duplicates it.
     * @param name User-defined name to attach to the glossary.
     * @param sourceLanguageCode Source language code for the glossary.
     * @param targetLanguageCode Target language code for the glossary.
     * @param csvContent String in CSV format containing the entries.
     * @param options Additional options, see {@link CreateMultilingualGlossaryOptions}.
     * @returns {Promise<MultilingualGlossaryInfo>} Object with details about the newly created glossary.
     *
     * @throws {ArgumentError} If any argument is invalid.
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async createMultilingualGlossaryFromCsv(
        name: string,
        sourceLanguageCode: string,
        targetLanguageCode: string,
        csvContent: string,
        options?: CreateMultilingualGlossaryOptions,
    ): Promise<MultilingualGlossaryInfo> {
        if (!name) {
            throw new ArgumentError('Parameter "name" must not be empty');
        }
        if (!sourceLanguageCode) {
            throw new ArgumentError('Parameter "sourceLanguageCode" must not be empty');
        }
        if (!targetLanguageCode) {
            throw new ArgumentError('Parameter "targetLanguageCode" must not be empty');
        }
        if (!csvContent) {
            throw new ArgumentError('Parameter "csvContent" must not be empty');
        }

        const body = {
            name,
            dictionaries: [csvDictionaryToJson(sourceLanguageCode, targetLanguageCode, csvContent)],
        };

        const { content } = await this.sendCreateRequest('/v3/glossaries', {
            jsonBody: addExtraBodyParametersToJson(body, options),
            signal: options?.signal,
        });
        return parseMultilingualGlossaryInfo(content);
    }

    /**
     * Retrieves information about the glossary with the specified ID.
     * This does not retrieve the glossary entries.
     * @param glossary The ID of the glossary or MultilingualGlossaryInfo object to retrieve.
     * @param options Optional `signal` to cancel the request, see {@link RequestOptions}.
     * @returns {Promise<MultilingualGlossaryInfo>} object with details about the specified glossary.
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async getMultilingualGlossary(
        glossary: GlossaryId | MultilingualGlossaryInfo,
        options?: RequestOptions,
    ): Promise<MultilingualGlossaryInfo> {
        if (!glossary || !extractGlossaryId(glossary)) {
            throw new ArgumentError('glossaryId must not be empty');
        }

        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'GET',
            multilingualGlossaryPath(glossary),
            { signal: options?.signal },
        );

        await checkStatusCode(statusCode, content);
        return parseMultilingualGlossaryInfo(content);
    }

    /**
     * Retrieves the dictionary entries for a specific glossary and language pair.
     *
     * If the source and target language codes are specified, there should be at most one dictionary returned.
     *
     * @param glossary The ID of the glossary or MultilingualGlossaryInfo object to query.
     * @param sourceLanguageCode Source language code of the dictionary.
     * @param targetLanguageCode Target language code of the dictionary.
     * @param options Optional `signal` to cancel the request, see {@link RequestOptions}.
     * @returns {Promise<MultilingualGlossaryDictionaryEntries>} Object containing the dictionary entries.
     *
     * @throws {ArgumentError} If any argument is invalid.
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     * @throws {NotFoundError} If the glossary or the dictionary for the given source and target language codes does not exist.
     */
    async getMultilingualGlossaryDictionaryEntries(
        glossary: GlossaryId | MultilingualGlossaryInfo,
        sourceLanguageCode: string,
        targetLanguageCode: string,
        options?: RequestOptions,
    ): Promise<MultilingualGlossaryDictionaryEntries> {
        if (!glossary || !extractGlossaryId(glossary)) {
            throw new ArgumentError('Parameter "glossary" must not be empty/null');
        }
        if (!sourceLanguageCode) {
            throw new ArgumentError('Parameter "sourceLanguageCode" must not be empty');
        }
        if (!targetLanguageCode) {
            throw new ArgumentError('Parameter "targetLanguageCode" must not be empty');
        }

        const queryParams = new URLSearchParams();
        queryParams.append('source_lang', sourceLanguageCode);
        queryParams.append('target_lang', targetLanguageCode);

        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'GET',
            `${multilingualGlossaryPath(glossary)}/entries`,
            { data: queryParams, signal: options?.signal },
        );

        await checkStatusCode(statusCode, content);
        const dictionaryEntriesList = parseResponse(
            content,
            parseMultilingualGlossaryDictionaryEntries,
        );

        if (!dictionaryEntriesList || dictionaryEntriesList.length === 0) {
            throw new NotFoundError('Glossary dictionary not found');
        }
        return dictionaryEntriesList[0];
    }

    /**
     * Retrieves a list of all multilingual glossaries available for the authenticated user.
     *
     * @param options Optional `signal` to cancel the request, see {@link RequestOptions}.
     * @returns {Promise<MultilingualGlossaryInfo[]>} An array of objects containing details about each glossary.
     *
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async listMultilingualGlossaries(
        options?: RequestOptions,
    ): Promise<MultilingualGlossaryInfo[]> {
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'GET',
            '/v3/glossaries',
            { signal: options?.signal },
        );

        await checkStatusCode(statusCode, content);
        return parseResponse(content, parseListMultilingualGlossaries);
    }

    /**
     * Deletes the glossary with the specified ID or MultilingualGlossaryInfo object.
     * @param glossary The ID of the glossary or MultilingualGlossaryInfo object to delete.
     * @param options Optional `signal` to cancel the request, see {@link RequestOptions}.
     * @throws {ArgumentError} If the glossary ID is empty.
     * @throws {DeepLError} If the glossary could not be deleted.
     */
    async deleteMultilingualGlossary(
        glossary: GlossaryId | MultilingualGlossaryInfo,
        options?: RequestOptions,
    ): Promise<void> {
        if (!glossary || !extractGlossaryId(glossary)) {
            throw new ArgumentError('glossaryId must not be empty');
        }
        const glossaryId = extractGlossaryId(glossary);

        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'DELETE',
            multilingualGlossaryPath(glossaryId),
            { signal: options?.signal },
        );

        await checkStatusCode(statusCode, content);
    }

    /**
     * Deletes a specific dictionary from a multilingual glossary based on the source and target language codes.
     *
     * @param glossary ID of the glossary or MultilingualGlossaryInfo object from which the dictionary will be deleted.
     * @param sourceLanguageCode Source language code of the dictionary to delete.
     * @param targetLanguageCode Target language code of the dictionary to delete.
     * @param options Optional `signal` to cancel the request, see {@link RequestOptions}.
     * @throws {ArgumentError} If any argument is invalid.
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async deleteMultilingualGlossaryDictionary(
        glossary: GlossaryId | MultilingualGlossaryInfo,
        sourceLanguageCode: string,
        targetLanguageCode: string,
        options?: RequestOptions,
    ): Promise<void> {
        if (!glossary || !extractGlossaryId(glossary)) {
            throw new ArgumentError('Parameter "glossary" must not be empty/null');
        }
        if (!sourceLanguageCode) {
            throw new ArgumentError('Parameter "sourceLanguageCode" must not be empty');
        }
        if (!targetLanguageCode) {
            throw new ArgumentError('Parameter "targetLanguageCode" must not be empty');
        }

        const query = buildQueryString({
            source_lang: sourceLanguageCode,
            target_lang: targetLanguageCode,
        });

        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'DELETE',
            `${multilingualGlossaryPath(glossary)}/dictionaries?${query}`,
            { signal: options?.signal },
        );

        await checkStatusCode(statusCode, content);
    }

    /**
     * Replaces the dictionary entries for a specific source and target language pair in a multilingual glossary.
     *
     * @param glossary ID of the glossary or MultilingualGlossaryInfo object containing the dictionary.
     * @param glossaryDict The language pair and the new entries of the dictionary.
     * @param options Additional options, see {@link ReplaceMultilingualGlossaryDictionaryOptions}.
     * @returns {Promise<MultilingualGlossaryDictionaryInfo>} Object containing details about the updated dictionary.
     *
     * @throws {ArgumentError} If any argument is invalid.
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async replaceMultilingualGlossaryDictionary(
        glossary: GlossaryId | MultilingualGlossaryInfo,
        glossaryDict: MultilingualGlossaryDictionaryEntries,
        options?: ReplaceMultilingualGlossaryDictionaryOptions,
    ): Promise<MultilingualGlossaryDictionaryInfo> {
        if (!glossary || !extractGlossaryId(glossary)) {
            throw new ArgumentError('Parameter "glossary" must not be empty/null');
        }
        if (!glossaryDict) {
            throw new ArgumentError('Parameter "glossaryDict" must not be null');
        }

        const [dictionary] = dictionaryEntriesToJson([glossaryDict]);
        return this.putMultilingualGlossaryDictionary(glossary, dictionary, options);
    }

    /**
     * Replaces the dictionary entries for a specific source and target language pair in a multilingual glossary
     * using entries from a CSV file.
     *
     * @param glossary ID of the glossary or MultilingualGlossaryInfo object containing the dictionary.
     * @param sourceLanguageCode Source language code of the dictionary to replace.
     * @param targetLanguageCode Target language code of the dictionary to replace.
     * @param csvContent String in CSV format containing the new entries.
     * @param options Additional options, see {@link ReplaceMultilingualGlossaryDictionaryOptions}.
     * @returns {Promise<MultilingualGlossaryDictionaryInfo>} Object containing details about the updated dictionary.
     *
     * @throws {ArgumentError} If any argument is invalid.
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async replaceMultilingualGlossaryDictionaryFromCsv(
        glossary: GlossaryId | MultilingualGlossaryInfo,
        sourceLanguageCode: string,
        targetLanguageCode: string,
        csvContent: string,
        options?: ReplaceMultilingualGlossaryDictionaryOptions,
    ): Promise<MultilingualGlossaryDictionaryInfo> {
        if (!glossary || !extractGlossaryId(glossary)) {
            throw new ArgumentError('Parameter "glossary" must not be empty/null');
        }
        if (!sourceLanguageCode) {
            throw new ArgumentError('Parameter "sourceLanguageCode" must not be empty');
        }
        if (!targetLanguageCode) {
            throw new ArgumentError('Parameter "targetLanguageCode" must not be empty');
        }
        if (!csvContent) {
            throw new ArgumentError('Parameter "csvContent" must not be empty');
        }

        return this.putMultilingualGlossaryDictionary(
            glossary,
            csvDictionaryToJson(sourceLanguageCode, targetLanguageCode, csvContent),
            options,
        );
    }

    /** @private */
    private async putMultilingualGlossaryDictionary(
        glossary: GlossaryId | MultilingualGlossaryInfo,
        body: Record<string, unknown>,
        options: ReplaceMultilingualGlossaryDictionaryOptions | undefined,
    ): Promise<MultilingualGlossaryDictionaryInfo> {
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'PUT',
            `${multilingualGlossaryPath(glossary)}/dictionaries`,
            { jsonBody: addExtraBodyParametersToJson(body, options), signal: options?.signal },
        );

        await checkStatusCode(statusCode, content);
        return parseResponse(content, parseMultilingualGlossaryDictionaryInfo);
    }

    /**
     * Updates the name and/or dictionaries of a multilingual glossary. The entries of each given
     * dictionary are merged into the existing dictionary of the same language pair, which is
     * created if it does not exist; fields left unset are not changed.
     *
     * @param glossary ID of the glossary or MultilingualGlossaryInfo object to update.
     * @param options Fields to change, see {@link UpdateMultilingualGlossaryOptions}. If omitted
     *     or empty, an empty body is sent.
     * @returns {Promise<MultilingualGlossaryInfo>} Object containing details about the updated glossary.
     *
     * @throws {ArgumentError} If any argument is invalid.
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async updateMultilingualGlossary(
        glossary: GlossaryId | MultilingualGlossaryInfo,
        options?: UpdateMultilingualGlossaryOptions,
    ): Promise<MultilingualGlossaryInfo> {
        if (!glossary || !extractGlossaryId(glossary)) {
            throw new ArgumentError('Parameter "glossary" must not be empty/null');
        }

        const body: Record<string, unknown> = {};
        if (options?.name !== undefined) {
            body.name = options.name;
        }
        if (options?.dictionaries !== undefined) {
            body.dictionaries = dictionaryEntriesToJson(options.dictionaries);
        }

        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'PATCH',
            multilingualGlossaryPath(glossary),
            { jsonBody: addExtraBodyParametersToJson(body, options), signal: options?.signal },
        );

        await checkStatusCode(statusCode, content);
        return parseMultilingualGlossaryInfo(content);
    }

    /**
     * Updates the name of a multilingual glossary.
     *
     * @param glossary ID of the glossary or MultilingualGlossaryInfo object to update.
     * @param name New name for the glossary.
     * @param options Additional options, see {@link BaseRequestOptions}.
     * @returns {Promise<MultilingualGlossaryInfo>} Object containing details about the updated glossary.
     *
     * @throws {ArgumentError} If the glossary ID or the name is empty.
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async updateMultilingualGlossaryName(
        glossary: GlossaryId | MultilingualGlossaryInfo,
        name: string,
        options?: BaseRequestOptions,
    ): Promise<MultilingualGlossaryInfo> {
        if (!name) {
            throw new ArgumentError('Parameter "name" must not be empty');
        }

        return this.patchMultilingualGlossary(glossary, { name }, options);
    }

    /**
     * Updates the dictionary entries for a specific source and target language pair in a multilingual glossary.
     *
     * @param glossary ID of the glossary or MultilingualGlossaryInfo object to update.
     * @param glossaryDict The new or updated glossary dictionary.
     * @param options Additional options, see {@link BaseRequestOptions}.
     * @returns {Promise<MultilingualGlossaryInfo>} Object containing details about the updated glossary.
     *
     * @throws {ArgumentError} If any argument is invalid.
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async updateMultilingualGlossaryDictionary(
        glossary: GlossaryId | MultilingualGlossaryInfo,
        glossaryDict: MultilingualGlossaryDictionaryEntries,
        options?: BaseRequestOptions,
    ): Promise<MultilingualGlossaryInfo> {
        if (!glossary || !extractGlossaryId(glossary)) {
            throw new ArgumentError('Parameter "glossary" must not be empty/null');
        }
        if (!glossaryDict) {
            throw new ArgumentError('Parameter "glossaryDict" must not be null');
        }

        return this.patchMultilingualGlossary(
            glossary,
            { dictionaries: dictionaryEntriesToJson([glossaryDict]) },
            options,
        );
    }

    /**
     * Updates the dictionary entries for a specific source and target language pair in a multilingual glossary
     * using entries from a CSV file.
     *
     * @param glossary ID of the glossary or MultilingualGlossaryInfo object to update.
     * @param sourceLanguageCode Source language code of the dictionary to update.
     * @param targetLanguageCode Target language code of the dictionary to update.
     * @param csvContent String in CSV format containing the new entries.
     * @param options Additional options, see {@link BaseRequestOptions}.
     * @returns {Promise<MultilingualGlossaryInfo>} Object containing details about the updated glossary.
     *
     * @throws {ArgumentError} If any argument is invalid.
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async updateMultilingualGlossaryDictionaryFromCsv(
        glossary: GlossaryId | MultilingualGlossaryInfo,
        sourceLanguageCode: string,
        targetLanguageCode: string,
        csvContent: string,
        options?: BaseRequestOptions,
    ): Promise<MultilingualGlossaryInfo> {
        if (!glossary || !extractGlossaryId(glossary)) {
            throw new ArgumentError('Parameter "glossary" must not be empty/null');
        }
        if (!sourceLanguageCode) {
            throw new ArgumentError('Parameter "sourceLanguageCode" must not be empty');
        }
        if (!targetLanguageCode) {
            throw new ArgumentError('Parameter "targetLanguageCode" must not be empty');
        }
        if (!csvContent) {
            throw new ArgumentError('Parameter "csvContent" must not be empty');
        }

        return this.patchMultilingualGlossary(
            glossary,
            {
                dictionaries: [
                    csvDictionaryToJson(sourceLanguageCode, targetLanguageCode, csvContent),
                ],
            },
            options,
        );
    }

    /** @private */
    private async patchMultilingualGlossary(
        glossary: GlossaryId | MultilingualGlossaryInfo,
        body: Record<string, unknown>,
        options: BaseRequestOptions | undefined,
    ): Promise<MultilingualGlossaryInfo> {
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'PATCH',
            multilingualGlossaryPath(glossary),
            { jsonBody: addExtraBodyParametersToJson(body, options), signal: options?.signal },
        );

        await checkStatusCode(statusCode, content);
        return parseMultilingualGlossaryInfo(content);
    }

    /**
     * Creates a spoken terms collection with the given name and term lists. Spoken terms
     * improve the transcription of the given terms in speech recognition.
     *
     * The create request is retried only when it was not sent, so a retry never duplicates it.
     * @param name User-defined name of the collection.
     * @param termLists The term lists of the collection, one per language,
     *     see {@link SpokenTermsEntries}.
     * @param options Additional options, see {@link CreateSpokenTermsOptions}.
     * @returns {Promise<SpokenTerms>} Object with details about the new collection.
     *
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async createSpokenTerms(
        name: string,
        termLists: SpokenTermsEntries[],
        options?: CreateSpokenTermsOptions,
    ): Promise<SpokenTerms> {
        const body = addExtraBodyParametersToJson(
            { name, term_lists: termLists.map(spokenTermsEntriesToJson) },
            options,
        );
        const { content } = await this.sendCreateRequest('/v3/spoken-terms', {
            jsonBody: body,
            signal: options?.signal,
        });
        return parseSpokenTerms(content);
    }

    /**
     * Lists all spoken terms collections of the account.
     *
     * @param options Optional `signal` to cancel the request, see {@link RequestOptions}.
     * @returns {Promise<SpokenTerms[]>} Details about each collection, excluding the terms.
     *
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async listSpokenTerms(options?: RequestOptions): Promise<SpokenTerms[]> {
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'GET',
            '/v3/spoken-terms',
            { signal: options?.signal },
        );
        await checkStatusCode(statusCode, content);
        return parseSpokenTermsArray(content);
    }

    /**
     * Retrieves details about a spoken terms collection, excluding the terms.
     *
     * @param spokenTerms ID of the collection, or a SpokenTerms object.
     * @param options Optional `signal` to cancel the request, see {@link RequestOptions}.
     * @returns {Promise<SpokenTerms>} Object with details about the collection.
     *
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async getSpokenTerms(
        spokenTerms: string | SpokenTerms,
        options?: RequestOptions,
    ): Promise<SpokenTerms> {
        const spokenTermsId = extractSpokenTermsId(spokenTerms);
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'GET',
            `/v3/spoken-terms/${encodeURIComponent(spokenTermsId)}`,
            { signal: options?.signal },
        );
        await checkStatusCode(statusCode, content);
        return parseSpokenTerms(content);
    }

    /**
     * Updates the name and/or term lists of a spoken terms collection. The terms of each given
     * list are merged into the existing list of that language; fields left unset are not changed.
     *
     * @param spokenTerms ID of the collection, or a SpokenTerms object.
     * @param options Fields to change, see {@link UpdateSpokenTermsOptions}. If omitted or
     *     empty, an empty body is sent.
     * @returns {Promise<SpokenTerms>} Object with details about the updated collection.
     *
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async updateSpokenTerms(
        spokenTerms: string | SpokenTerms,
        options?: UpdateSpokenTermsOptions,
    ): Promise<SpokenTerms> {
        const spokenTermsId = extractSpokenTermsId(spokenTerms);
        const body: Record<string, unknown> = {};
        if (options?.name !== undefined) {
            body.name = options.name;
        }
        if (options?.termLists !== undefined) {
            body.term_lists = options.termLists.map(spokenTermsEntriesToJson);
        }
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'PATCH',
            `/v3/spoken-terms/${encodeURIComponent(spokenTermsId)}`,
            { jsonBody: addExtraBodyParametersToJson(body, options), signal: options?.signal },
        );
        await checkStatusCode(statusCode, content);
        return parseSpokenTerms(content);
    }

    /**
     * Retrieves the terms of one language in a spoken terms collection.
     *
     * @param spokenTerms ID of the collection, or a SpokenTerms object.
     * @param lang Language code of the term list, for example 'en'.
     * @param options Optional `signal` to cancel the request, see {@link RequestOptions}.
     * @returns {Promise<SpokenTermsEntries>} The terms of the list.
     *
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async getSpokenTermsEntries(
        spokenTerms: string | SpokenTerms,
        lang: string,
        options?: RequestOptions,
    ): Promise<SpokenTermsEntries> {
        const spokenTermsId = extractSpokenTermsId(spokenTerms);
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'GET',
            `/v3/spoken-terms/${encodeURIComponent(spokenTermsId)}/entries`,
            { data: new URLSearchParams({ lang }), signal: options?.signal },
        );
        await checkStatusCode(statusCode, content);
        return parseSpokenTermsEntries(content);
    }

    /**
     * Replaces the term list of one language in a spoken terms collection, or adds it if the
     * collection has no list for that language.
     *
     * @param spokenTerms ID of the collection, or a SpokenTerms object.
     * @param entries The language and its new terms.
     * @param options Additional options, see {@link ReplaceSpokenTermsListOptions}.
     * @returns {Promise<SpokenTermsList>} Details about the new term list.
     *
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async replaceSpokenTermsList(
        spokenTerms: string | SpokenTerms,
        entries: SpokenTermsEntries,
        options?: ReplaceSpokenTermsListOptions,
    ): Promise<SpokenTermsList> {
        const spokenTermsId = extractSpokenTermsId(spokenTerms);
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'PUT',
            `/v3/spoken-terms/${encodeURIComponent(spokenTermsId)}/term-lists`,
            {
                jsonBody: addExtraBodyParametersToJson(spokenTermsEntriesToJson(entries), options),
                signal: options?.signal,
            },
        );
        await checkStatusCode(statusCode, content);
        return parseSpokenTermsList(content);
    }

    /**
     * Deletes a spoken terms collection.
     *
     * @param spokenTerms ID of the collection, or a SpokenTerms object.
     *
     * @param options Optional `signal` to cancel the request, see {@link RequestOptions}.
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async deleteSpokenTerms(
        spokenTerms: string | SpokenTerms,
        options?: RequestOptions,
    ): Promise<void> {
        const spokenTermsId = extractSpokenTermsId(spokenTerms);
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'DELETE',
            `/v3/spoken-terms/${encodeURIComponent(spokenTermsId)}`,
            { signal: options?.signal },
        );
        await checkStatusCode(statusCode, content);
    }

    /**
     * Deletes the term list of one language from a spoken terms collection.
     *
     * @param spokenTerms ID of the collection, or a SpokenTerms object.
     * @param lang Language code of the term list to delete, for example 'de'.
     *
     * @param options Optional `signal` to cancel the request, see {@link RequestOptions}.
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async deleteSpokenTermsList(
        spokenTerms: string | SpokenTerms,
        lang: string,
        options?: RequestOptions,
    ): Promise<void> {
        const spokenTermsId = extractSpokenTermsId(spokenTerms);
        const query = buildQueryString({ lang });
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'DELETE',
            `/v3/spoken-terms/${encodeURIComponent(spokenTermsId)}/term-lists?${query}`,
            { signal: options?.signal },
        );
        await checkStatusCode(statusCode, content);
    }

    /**
     * Retrieves the languages supported by the given DeepL API resource, along with whether each
     * language is usable as source and/or target language and the features it supports.
     *
     * @param {LanguageResourceName} resource - The resource to query languages for, e.g.
     *     'translate_text' or 'glossary'.
     * @param {GetLanguagesForResourceOptions} [options] - Optional settings; `include` adds beta languages and
     *     features, or features relying on third-party providers.
     * @returns {Promise<LanguageSupport[]>} An array of objects, one per supported language.
     *
     * @throws {ArgumentError} If the resource is empty.
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async getLanguagesForResource(
        resource: LanguageResourceName,
        options?: GetLanguagesForResourceOptions,
    ): Promise<LanguageSupport[]> {
        if (!resource) {
            throw new ArgumentError('resource must be a non-empty string');
        }
        const data = new URLSearchParams({ resource });
        for (const include of options?.include ?? []) {
            data.append('include', include);
        }

        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'GET',
            '/v3/languages',
            { data, signal: options?.signal },
        );

        await checkStatusCode(statusCode, content);
        return parseLanguageSupportList(content);
    }

    /**
     * Retrieves the resources supported by the DeepL API, along with their features and whether
     * each feature requires support from the source and/or target language.
     *
     * @param options Optional `signal` to cancel the request, see {@link RequestOptions}.
     * @returns {Promise<LanguageResource[]>} An array of objects, one per supported resource.
     *
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async getLanguageResources(options?: RequestOptions): Promise<LanguageResource[]> {
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'GET',
            '/v3/languages/resources',
            { signal: options?.signal },
        );

        await checkStatusCode(statusCode, content);
        return parseLanguageResourceList(content);
    }

    /**
     * Retrieves a list of all style rules available for the authenticated user.
     *
     * @param page: Page number for pagination, 0-indexed (optional).
     * @param pageSize: Number of items per page (optional).
     * @param detailed: Whether to include detailed configuration rules in the `configuredRules` property (optional).
     * @param options Optional `signal` to cancel the request, see {@link RequestOptions}.
     * @returns {Promise<StyleRuleInfo[]>} An array of objects containing details about each style rule.
     *
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async getAllStyleRules(
        page?: number,
        pageSize?: number,
        detailed?: boolean,
        options?: RequestOptions,
    ): Promise<StyleRuleInfo[]> {
        const queryParams = new URLSearchParams();
        if (page !== undefined) {
            queryParams.append('page', String(page));
        }
        if (pageSize !== undefined) {
            queryParams.append('page_size', String(pageSize));
        }
        if (detailed !== undefined) {
            queryParams.append('detailed', String(detailed).toLowerCase());
        }

        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'GET',
            '/v3/style_rules',
            { data: queryParams, signal: options?.signal },
        );

        await checkStatusCode(statusCode, content);
        return parseStyleRuleInfoList(content);
    }

    /**
     * Retrieves a list of available translation memories. The maximum number of translation
     * memories returned is controlled by pageSize (max 25).
     *
     * @param page: Page number for pagination, 0-indexed (optional).
     * @param pageSize: Number of items per page (optional).
     * @param options Optional `signal` to cancel the request, see {@link RequestOptions}.
     * @returns {Promise<TranslationMemoryInfo[]>} An array of objects containing details about each translation memory.
     *
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async listTranslationMemories(
        page?: number,
        pageSize?: number,
        options?: RequestOptions,
    ): Promise<TranslationMemoryInfo[]> {
        const queryParams = new URLSearchParams();
        if (page !== undefined) {
            queryParams.append('page', String(page));
        }
        if (pageSize !== undefined) {
            queryParams.append('page_size', String(pageSize));
        }

        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'GET',
            '/v3/translation_memories',
            { data: queryParams, signal: options?.signal },
        );

        await checkStatusCode(statusCode, content);
        return parseTranslationMemoryInfoList(content);
    }

    /**
     * Retrieves a single translation memory by ID.
     *
     * @param translationMemory: Translation memory ID, or TranslationMemoryInfo object.
     * @param options Optional `signal` to cancel the request, see {@link RequestOptions}.
     * @returns {Promise<TranslationMemoryInfo>} Details of the translation memory.
     *
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async getTranslationMemory(
        translationMemory: TranslationMemoryId | TranslationMemoryInfo,
        options?: RequestOptions,
    ): Promise<TranslationMemoryInfo> {
        const translationMemoryId = extractTranslationMemoryId(translationMemory);
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'GET',
            `/v3/translation_memories/${encodeURIComponent(translationMemoryId)}`,
            { signal: options?.signal },
        );

        await checkStatusCode(statusCode, content);
        return parseTranslationMemoryInfoJson(content);
    }

    /**
     * Retrieves one page of the segments of a translation memory.
     *
     * Pagination is cursor-based: omit pageCursor on the first call, then pass the previous
     * response's nextPageCursor to fetch the next page. An absent nextPageCursor means the last
     * page has been returned. Note that segmentCount is the translation-memory total and is not
     * reduced by filterText.
     *
     * @param translationMemory: Translation memory ID, or TranslationMemoryInfo object.
     * @param options: Optional pagination and filtering options.
     * @returns {Promise<TranslationMemorySegments>} One page of segments.
     *
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async listTranslationMemorySegments(
        translationMemory: TranslationMemoryId | TranslationMemoryInfo,
        options?: TranslationMemorySegmentsOptions,
    ): Promise<TranslationMemorySegments> {
        const translationMemoryId = extractTranslationMemoryId(translationMemory);
        const queryParams = new URLSearchParams();
        if (options?.pageSize !== undefined) {
            queryParams.append('page_size', String(options.pageSize));
        }
        if (options?.pageCursor !== undefined) {
            queryParams.append('page_cursor', options.pageCursor);
        }
        if (options?.filterText !== undefined) {
            queryParams.append('filter_text', options.filterText);
        }
        if (options?.filterCaseSensitive !== undefined) {
            queryParams.append(
                'filter_case_sensitive',
                String(options.filterCaseSensitive).toLowerCase(),
            );
        }

        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'GET',
            `/v3/translation_memories/${encodeURIComponent(translationMemoryId)}/segments`,
            { data: queryParams, signal: options?.signal },
        );

        await checkStatusCode(statusCode, content);
        return parseTranslationMemorySegments(content);
    }

    /**
     * Deletes the specified translation memory.
     *
     * @param translationMemory: Translation memory ID, or TranslationMemoryInfo object.
     *
     * @param options Optional `signal` to cancel the request, see {@link RequestOptions}.
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async deleteTranslationMemory(
        translationMemory: TranslationMemoryId | TranslationMemoryInfo,
        options?: RequestOptions,
    ): Promise<void> {
        const translationMemoryId = extractTranslationMemoryId(translationMemory);
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'DELETE',
            `/v3/translation_memories/${encodeURIComponent(translationMemoryId)}`,
            { signal: options?.signal },
        );

        await checkStatusCode(statusCode, content);
    }

    /**
     * Creates an import job for a new translation memory.
     *
     * The job only declares the file; upload the TMX file itself to the returned upload URL with
     * uploadTranslationMemoryFile(), then poll getTranslationMemoryJob() for the outcome. Use
     * importTranslationMemoryFromFilepath() to do all three steps at once.
     *
     * The create request is retried only when it was not sent, so a retry never duplicates it.
     * @param fileName: Name of the TMX file to import, for example 'legal.tmx'.
     * @param contentLength: Size of the TMX file in bytes.
     * @param options: Optional contentType (defaults to 'application/xml'), displayName for the
     * resulting translation memory (defaults to the file name) and extraBodyParameters, see
     * {@link CreateTranslationMemoryImportOptions}.
     * @returns {Promise<TranslationMemoryImport>} The job ID and upload URL.
     *
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async createTranslationMemoryImport(
        fileName: string,
        contentLength: number,
        options?: CreateTranslationMemoryImportOptions,
    ): Promise<TranslationMemoryImport> {
        if (!fileName) {
            throw new ArgumentError('fileName must not be empty');
        }
        if (!(contentLength > 0)) {
            throw new ArgumentError('contentLength must be greater than 0');
        }

        const sourceFile: Record<string, unknown> = {
            file_name: fileName,
            content_length: contentLength,
        };
        if (options?.contentType !== undefined) {
            sourceFile.content_type = options.contentType;
        }
        const jsonBody: Record<string, unknown> = { source_file: sourceFile };
        if (options?.displayName !== undefined) {
            jsonBody.parameters = { display_name: options.displayName };
        }

        const { content } = await this.sendCreateRequest('/v3/translation_memories/import', {
            jsonBody: addExtraBodyParametersToJson(jsonBody, options),
            signal: options?.signal,
        });
        return parseTranslationMemoryImport(content);
    }

    /**
     * Uploads a TMX file to the upload URL of an import job.
     *
     * The upload URL is a pre-signed storage URL outside of the DeepL API, so the authentication
     * key is not sent with this request, and any 2xx response counts as success. The API detects
     * the upload asynchronously, so the job keeps reporting 'awaiting_input' for a while afterwards
     * before it starts processing.
     *
     * @param translationMemoryImport: The import returned by createTranslationMemoryImport(), or
     * its upload URL.
     * @param fileBuffer: TMX file content.
     * @param contentType: MIME type of the file, which must match the content type declared when
     * the import job was created. Defaults to 'application/xml'.
     *
     * @param options Optional `signal` to cancel the request, see {@link RequestOptions}.
     * @throws {DeepLError} If any error occurs while uploading the file. An error response from the
     * upload URL is a plain DeepLError carrying httpStatusCode, never one of its subclasses.
     */
    async uploadTranslationMemoryFile(
        translationMemoryImport: string | TranslationMemoryImport,
        fileBuffer: Buffer,
        contentType = 'application/xml',
        options?: RequestOptions,
    ): Promise<void> {
        const uploadUrl =
            typeof translationMemoryImport === 'string'
                ? translationMemoryImport
                : translationMemoryImport.uploadUrl;
        if (!uploadUrl) {
            throw new ArgumentError('uploadUrl must not be empty');
        }

        const { statusCode, content } = await this.storageHttpClient.sendRequestWithBackoff<string>(
            'PUT',
            uploadUrl,
            {
                rawBody: fileBuffer,
                headers: { 'Content-Type': contentType },
                signal: options?.signal,
            },
        );

        if (statusCode < 200 || statusCode >= 300) {
            await throwStorageError('Error uploading translation memory file', statusCode, content);
        }
    }

    /**
     * Creates an export job for a translation memory.
     *
     * Poll getTranslationMemoryJob() for the download URL of the exported TMX file. Use
     * exportTranslationMemoryToFilepath() to do both steps and write the file at once.
     *
     * The create request is retried only when it was not sent, so a retry never duplicates it.
     * @param translationMemory: Translation memory ID, or TranslationMemoryInfo object.
     * @param options Optional `signal` to cancel the request, see {@link RequestOptions}.
     * @returns {Promise<TranslationMemoryExport>} The job ID, and whether the API reused a
     * previously completed export.
     *
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async createTranslationMemoryExport(
        translationMemory: TranslationMemoryId | TranslationMemoryInfo,
        options?: RequestOptions,
    ): Promise<TranslationMemoryExport> {
        const translationMemoryId = extractTranslationMemoryId(translationMemory);
        const { statusCode, content } = await this.sendCreateRequest(
            `/v3/translation_memories/${encodeURIComponent(translationMemoryId)}/export`,
            { signal: options?.signal },
        );
        // 200 means the API reused a previously completed export, 202 that it started a new one.
        return parseTranslationMemoryExport(content, statusCode === 200);
    }

    /**
     * Retrieves the status of a translation memory import or export job.
     *
     * @param job: ID of the job to query, or a TranslationMemoryJob object.
     * @param options Optional `signal` to cancel the request, see {@link RequestOptions}.
     * @returns {Promise<TranslationMemoryJob>} The current status of the job.
     *
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async getTranslationMemoryJob(
        job: string | TranslationMemoryJob,
        options?: RequestOptions,
    ): Promise<TranslationMemoryJob> {
        const jobId = typeof job === 'string' ? job : job?.jobId;
        if (!jobId) {
            throw new ArgumentError('jobId must not be empty');
        }
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'GET',
            `/v3/translation_memories/jobs/${encodeURIComponent(jobId)}`,
            { signal: options?.signal },
        );

        await checkStatusCode(statusCode, content);
        return parseTranslationMemoryJob(content);
    }

    /**
     * Polls a translation memory job every 5 seconds until it completes (status 'completed'), and
     * resolves with the completed job.
     *
     * Note that an import job keeps reporting 'awaiting_input' for a while after its file has been
     * uploaded, because the API detects the upload asynchronously. That status, and statuses this
     * library does not know, are polled through. A job whose file is never uploaded does not finish
     * on its own, so set a timeout when that is a possibility.
     *
     * @param job: ID of the job to wait for, or a TranslationMemoryJob object.
     * @param options: (Optional) WaitOptions with timeoutMs and signal, or the timeout in
     * milliseconds as a number. timeoutMs is the maximum time to wait before rejecting; signal
     * cancels the wait. The job is polled every 5 seconds.
     * @returns {Promise<TranslationMemoryJob>} The completed job.
     *
     * @throws {DeepLError} If the job fails or expires (with the job's error message), the timeout
     * is exceeded, or any error occurs while communicating with the DeepL API.
     */
    async waitUntilTranslationMemoryJobDone(
        job: string | TranslationMemoryJob,
        options?: WaitOptions | number,
    ): Promise<TranslationMemoryJob> {
        return this.internalWaitUntilTranslationMemoryJobDone(job, options);
    }

    /**
     * Implements waitUntilTranslationMemoryJobDone(); onStatus receives every job status received.
     * @private
     */
    private async internalWaitUntilTranslationMemoryJobDone(
        job: string | TranslationMemoryJob,
        options?: WaitOptions | number,
        onStatus?: (job: TranslationMemoryJob) => void,
    ): Promise<TranslationMemoryJob> {
        const timeoutMs = typeof options === 'number' ? options : options?.timeoutMs;
        const signal = typeof options === 'number' ? undefined : options?.signal;
        const deadline = timeoutMs !== undefined ? Date.now() + timeoutMs : undefined;
        let current = await this.getTranslationMemoryJob(job, { signal });
        onStatus?.(current);
        while (!current.done() && current.ok()) {
            let sleepMs = 5000;
            if (deadline !== undefined) {
                const remainingMs = deadline - Date.now();
                if (remainingMs <= 0) {
                    throw new DeepLError(
                        `Timeout of ${timeoutMs}ms exceeded for translation memory job`,
                    );
                }
                sleepMs = Math.min(sleepMs, remainingMs);
            }
            await timeout(sleepMs, signal);
            logInfo(`Rechecking translation memory job status after sleeping for ${sleepMs} ms.`);
            current = await this.getTranslationMemoryJob(current.jobId, { signal });
            onStatus?.(current);
        }
        if (!current.ok()) {
            throw new DeepLError(current.result?.errorMessage || `Job ${current.status}`);
        }
        return current;
    }

    /**
     * Downloads the TMX file of a completed export job to the given output file path or stream.
     *
     * @param job: Completed export job carrying the download URL.
     * @param outputFile: String containing output file path, or a WriteStream to store file data.
     *
     * @param options Optional `signal` to cancel the request, see {@link RequestOptions}.
     * @throws {DeepLError} If the job has no download URL (it has not completed, or is not an
     * export), or the download fails. An error response from the download URL, which is not part
     * of the DeepL API, is a plain DeepLError carrying httpStatusCode, never one of its subclasses.
     * @throws {Error} The Node error (e.g. `EEXIST`, `ENOENT`, `EACCES`) if the output file path
     * already exists or cannot be created, which is checked before any request, or if writing the
     * output fails.
     */
    async downloadTranslationMemoryExport(
        job: Omit<TranslationMemoryJob, 'done' | 'ok' | 'creationTime' | 'updatedTime'>,
        outputFile: string | fs.WriteStream,
        options?: RequestOptions,
    ): Promise<void> {
        const downloadUrl = job.results[0]?.downloadUrl;
        if (!downloadUrl) {
            throw new DeepLError(
                'translation memory export job has no download URL; it may not have completed yet',
            );
        }

        // The file is created before the request, so that an existing file is rejected with
        // EEXIST at once on every Node version, and nothing is downloaded. Node 16 and 17 never
        // call back from close() on a write stream that failed to open, so this cannot be left
        // to the stream.
        let fd: number | undefined;
        let fileStream: fs.WriteStream | undefined;
        let streamClosed: Promise<void> | undefined;
        if (typeof outputFile === 'string') {
            fd = await util.promisify(fs.open)(outputFile, 'wx');
        }
        try {
            // Streamed rather than buffered as text, mirroring translateDocumentDownload(): a TMX export
            // can be large, and decoding it to a string would both hold it all in memory and
            // risk corrupting bytes that are not valid UTF-8.
            const { statusCode, content } =
                await this.storageHttpClient.sendRequestWithBackoff<IncomingMessage>(
                    'GET',
                    downloadUrl,
                    { signal: options?.signal },
                    true,
                );
            if (statusCode < 200 || statusCode >= 300) {
                await throwStorageError(
                    'Error downloading translation memory export',
                    statusCode,
                    content,
                );
            }

            if (fd === undefined) {
                return await pipeToStream(content, outputFile as fs.WriteStream, options?.signal);
            }
            // The stream owns the descriptor from here on and closes it when it finishes or is
            // destroyed, so it must not be closed a second time.
            fileStream = fs.createWriteStream(outputFile as string, { fd });
            streamClosed = new Promise<void>((resolve) => fileStream?.once('close', resolve));
            await pipeToStream(content, fileStream, options?.signal);
            await streamClosed;
        } catch (e) {
            if (fd !== undefined) {
                if (streamClosed !== undefined) {
                    await streamClosed;
                } else {
                    await util
                        .promisify(fs.close)(fd)
                        .catch(() => undefined);
                }
                // Never leave a truncated TMX behind: a caller that logs and continues would
                // otherwise see a file that looks like a successful export.
                await fs.promises.unlink(outputFile as string).catch(() => undefined);
            }
            throw e;
        }
    }

    /**
     * Imports a TMX file as a new translation memory: creates the import job, uploads the file,
     * and waits for processing to finish.
     *
     * Note that the API detects the upload asynchronously, so the job keeps reporting
     * 'awaiting_input' for a while (usually well under a minute) before it completes.
     *
     * The create request is retried only when it was not sent, so a retry never duplicates it.
     * @param input: Path of the TMX file to import, or a Buffer or ReadStream with its content.
     * @param options: Optional displayName for the resulting translation memory (defaults to the
     * file name), contentType (defaults to 'application/xml'), fileName (required for a Buffer or
     * stream unless displayName is set), extraBodyParameters, and timeoutMs limiting how long to
     * wait for the import to finish, see {@link ImportTranslationMemoryOptions}.
     * @returns {Promise<TranslationMemoryJob>} The completed import job; its result carries the
     * new translation memory ID.
     *
     * @throws {ArgumentError} If the input file path does not exist; no request is sent.
     * @throws {TranslationMemoryJobError} For any other failure: the input cannot be read (no
     * request is sent), a Buffer or stream is given without fileName or displayName, the job
     * creation, upload or wait fails (failure status, timeout), or any error occurs while
     * communicating with the DeepL API. The cause is in `error`; `jobId` is set once the job was
     * created and `job` after the first status check; `httpStatusCode` and `shouldRetry` are
     * copied from a DeepLError cause.
     */
    async importTranslationMemoryFromFilepath(
        input: string | Buffer | fs.ReadStream,
        options?: ImportTranslationMemoryOptions,
    ): Promise<TranslationMemoryJob> {
        let fileBuffer: Buffer | undefined;
        if (isString(input)) {
            try {
                fileBuffer = await fs.promises.readFile(input);
            } catch (error) {
                if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
                    // A missing input file is the one failure that is not wrapped.
                    throw new ArgumentError(`input file '${input}' does not exist`, error as Error);
                }
                throw toTranslationMemoryJobError(error, undefined, undefined, options?.signal);
            }
        }
        let jobId: string | undefined;
        let job: TranslationMemoryJob | undefined;
        try {
            let fileName: string | undefined;
            if (isString(input)) {
                fileName = options?.fileName ?? path.basename(input);
            } else {
                fileName = options?.fileName ?? options?.displayName;
                if (!fileName) {
                    throw new ArgumentError(
                        'options.fileName or options.displayName must be specified unless using an input file path',
                    );
                }
                fileBuffer = input instanceof fs.ReadStream ? await streamToBuffer(input) : input;
            }
            const buffer = fileBuffer as Buffer;
            const created = await this.createTranslationMemoryImport(fileName, buffer.length, {
                displayName: options?.displayName,
                contentType: options?.contentType,
                extraBodyParameters: options?.extraBodyParameters,
                signal: options?.signal,
            });
            jobId = created.jobId;
            await this.uploadTranslationMemoryFile(
                created,
                buffer,
                options?.contentType ?? 'application/xml',
                { signal: options?.signal },
            );
            return await this.internalWaitUntilTranslationMemoryJobDone(
                created.jobId,
                options,
                (status) => {
                    job = status;
                },
            );
        } catch (error) {
            throw toTranslationMemoryJobError(error, jobId, job, options?.signal);
        }
    }

    /**
     * Exports a translation memory to a TMX file: creates the export job, waits for it to finish,
     * and writes the result to outputFile.
     *
     * The create request is retried only when it was not sent, so a retry never duplicates it.
     * @param translationMemory: Translation memory ID, or TranslationMemoryInfo object.
     * @param outputFile: String containing output file path, or a WriteStream to store file data.
     * @param options: Optional WaitOptions with timeoutMs limiting how long to wait for the export
     * to finish, and signal to cancel the export.
     * @returns {Promise<TranslationMemoryJob>} The completed export job.
     *
     * @throws {TranslationMemoryJobError} For any failure: a file already exists at the output
     * path or the output directory is missing or not writable (checked before the export job is
     * created, `jobId` and `job` unset), the job creation, wait (failure status, timeout) or
     * download fails, writing the output fails, or any error occurs while communicating with the
     * DeepL API. The cause is in `error`; `jobId` is set once the job was created and `job` after
     * the first status check; `httpStatusCode` and `shouldRetry` are copied from a DeepLError
     * cause.
     */
    async exportTranslationMemoryToFilepath(
        translationMemory: TranslationMemoryId | TranslationMemoryInfo,
        outputFile: string | fs.WriteStream,
        options?: WaitOptions,
    ): Promise<TranslationMemoryJob> {
        let jobId: string | undefined;
        let job: TranslationMemoryJob | undefined;
        try {
            if (isString(outputFile)) {
                if (fs.existsSync(outputFile)) {
                    throw new DeepLError(`output file '${outputFile}' already exists`);
                }
                await fs.promises.access(path.dirname(outputFile), fs.constants.W_OK);
            }
            const created = await this.createTranslationMemoryExport(translationMemory, options);
            jobId = created.jobId;
            const completed = await this.internalWaitUntilTranslationMemoryJobDone(
                created.jobId,
                options,
                (status) => {
                    job = status;
                },
            );
            await this.downloadTranslationMemoryExport(completed, outputFile, options);
            return completed;
        } catch (error) {
            throw toTranslationMemoryJobError(error, jobId, job, options?.signal);
        }
    }

    /**
     * Creates a new style rule.
     *
     * The create request is retried only when it was not sent, so a retry never duplicates it.
     * @param name: The name of the style rule.
     * @param language: The language code of the style rule.
     * @param configuredRules: Optional configured rules, sent as given as `configured_rules`,
     *     e.g. `{ dates_and_times: { calendar_era: 'use_bc_and_ad' } }`.
     * @param customInstructions: Optional custom instructions, sent as given as
     *     `custom_instructions`, e.g. `[{ label, prompt, source_language: 'de' }]`.
     * @param options: Optional request options, see {@link CreateStyleRuleOptions}.
     * @returns {Promise<StyleRuleInfo>} The created style rule info.
     *
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async createStyleRule(
        name: string,
        language: string,
        configuredRules?: Record<string, Record<string, string>>,
        customInstructions?: CustomInstructionRequestBody[],
        options?: CreateStyleRuleOptions,
    ): Promise<StyleRuleInfo> {
        if (!name) {
            throw new ArgumentError('Parameter "name" must not be empty');
        }
        if (!language) {
            throw new ArgumentError('Parameter "language" must not be empty');
        }
        const body: CreateStyleRuleRequestBody = { name, language };
        if (configuredRules !== undefined) body.configured_rules = configuredRules;
        if (customInstructions !== undefined) body.custom_instructions = customInstructions;
        const { content } = await this.sendCreateRequest('/v3/style_rules', {
            jsonBody: addExtraBodyParametersToJson(body, options),
            signal: options?.signal,
        });
        return parseResponse(content, parseStyleRuleInfo);
    }

    /**
     * Retrieves a single style rule by ID.
     *
     * @param styleRule: The style rule to retrieve, as an ID or a StyleRuleInfo object.
     * @param options Optional `signal` to cancel the request, see {@link RequestOptions}.
     * @returns {Promise<StyleRuleInfo>} The style rule info.
     *
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async getStyleRule(
        styleRule: StyleId | StyleRuleInfo,
        options?: RequestOptions,
    ): Promise<StyleRuleInfo> {
        const styleId = extractStyleRuleId(styleRule);
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'GET',
            `/v3/style_rules/${encodeURIComponent(styleId)}`,
            { signal: options?.signal },
        );
        await checkStatusCode(statusCode, content);
        return parseResponse(content, parseStyleRuleInfo);
    }

    /**
     * Updates the name of a style rule.
     *
     * @param styleRule: The style rule to update, as an ID or a StyleRuleInfo object.
     * @param name: The new name for the style rule.
     * @param options: Optional request options, see {@link UpdateStyleRuleNameOptions}.
     * @returns {Promise<StyleRuleInfo>} The updated style rule info.
     *
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async updateStyleRuleName(
        styleRule: StyleId | StyleRuleInfo,
        name: string,
        options?: UpdateStyleRuleNameOptions,
    ): Promise<StyleRuleInfo> {
        const styleId = extractStyleRuleId(styleRule);
        if (!name) {
            throw new ArgumentError('Parameter "name" must not be empty');
        }
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'PATCH',
            `/v3/style_rules/${encodeURIComponent(styleId)}`,
            { jsonBody: addExtraBodyParametersToJson({ name }, options), signal: options?.signal },
        );
        await checkStatusCode(statusCode, content);
        return parseResponse(content, parseStyleRuleInfo);
    }

    /**
     * Deletes a style rule.
     *
     * @param styleRule: The style rule to delete, as an ID or a StyleRuleInfo object.
     *
     * @param options Optional `signal` to cancel the request, see {@link RequestOptions}.
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async deleteStyleRule(
        styleRule: StyleId | StyleRuleInfo,
        options?: RequestOptions,
    ): Promise<void> {
        const styleId = extractStyleRuleId(styleRule);
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'DELETE',
            `/v3/style_rules/${encodeURIComponent(styleId)}`,
            { signal: options?.signal },
        );
        await checkStatusCode(statusCode, content);
    }

    /**
     * Updates the configured rules of a style rule.
     *
     * @param styleRule: The style rule to update, as an ID or a StyleRuleInfo object.
     * @param configuredRules: The new configured rules mapping.
     * @param options: Optional request options, see {@link UpdateStyleRuleConfiguredRulesOptions}.
     * @returns {Promise<StyleRuleInfo>} The updated style rule info.
     *
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async updateStyleRuleConfiguredRules(
        styleRule: StyleId | StyleRuleInfo,
        configuredRules: Record<string, Record<string, string>>,
        options?: UpdateStyleRuleConfiguredRulesOptions,
    ): Promise<StyleRuleInfo> {
        const styleId = extractStyleRuleId(styleRule);
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'PUT',
            `/v3/style_rules/${encodeURIComponent(styleId)}/configured_rules`,
            {
                jsonBody: addExtraBodyParametersToJson(configuredRules, options),
                signal: options?.signal,
            },
        );
        await checkStatusCode(statusCode, content);
        return parseResponse(content, parseStyleRuleInfo);
    }

    /**
     * Creates a custom instruction for a style rule.
     *
     * The create request is retried only when it was not sent, so a retry never duplicates it.
     * @param styleRule: The style rule, as an ID or a StyleRuleInfo object.
     * @param label: The label of the custom instruction.
     * @param prompt: The prompt text of the custom instruction.
     * @param sourceLanguage: Optional source language code the instruction applies to.
     * @param options: Optional request options, see {@link CreateStyleRuleCustomInstructionOptions}.
     * @returns {Promise<CustomInstruction>} The created custom instruction.
     *
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async createStyleRuleCustomInstruction(
        styleRule: StyleId | StyleRuleInfo,
        label: string,
        prompt: string,
        sourceLanguage?: string,
        options?: CreateStyleRuleCustomInstructionOptions,
    ): Promise<CustomInstruction> {
        const styleId = extractStyleRuleId(styleRule);
        if (!label) {
            throw new ArgumentError('Parameter "label" must not be empty');
        }
        if (!prompt) {
            throw new ArgumentError('Parameter "prompt" must not be empty');
        }
        const instruction = customInstructionToWire(label, prompt, sourceLanguage);
        const { content } = await this.sendCreateRequest(
            `/v3/style_rules/${encodeURIComponent(styleId)}/custom_instructions`,
            {
                jsonBody: addExtraBodyParametersToJson(instruction, options),
                signal: options?.signal,
            },
        );
        return parseResponse(content, parseCustomInstruction);
    }

    /**
     * Retrieves a custom instruction for a style rule.
     *
     * @param styleRule: The style rule, as an ID or a StyleRuleInfo object.
     * @param instructionId: The custom instruction, as an ID or a CustomInstruction object.
     * @param options Optional `signal` to cancel the request, see {@link RequestOptions}.
     * @returns {Promise<CustomInstruction>} The custom instruction.
     *
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async getStyleRuleCustomInstruction(
        styleRule: StyleId | StyleRuleInfo,
        instructionId: string | CustomInstruction,
        options?: RequestOptions,
    ): Promise<CustomInstruction> {
        const styleId = extractStyleRuleId(styleRule);
        const id = extractCustomInstructionId(instructionId);
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'GET',
            customInstructionPath(styleId, id),
            { signal: options?.signal },
        );
        await checkStatusCode(statusCode, content);
        return parseResponse(content, parseCustomInstruction);
    }

    /**
     * Updates a custom instruction for a style rule.
     *
     * @param styleRule: The style rule, as an ID or a StyleRuleInfo object.
     * @param instructionId: The custom instruction to update, as an ID or a CustomInstruction object.
     * @param label: The new label of the custom instruction.
     * @param prompt: The new prompt text of the custom instruction.
     * @param sourceLanguage: Optional source language code the instruction applies to.
     * @param options: Optional request options, see {@link UpdateStyleRuleCustomInstructionOptions}.
     * @returns {Promise<CustomInstruction>} The updated custom instruction.
     *
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async updateStyleRuleCustomInstruction(
        styleRule: StyleId | StyleRuleInfo,
        instructionId: string | CustomInstruction,
        label: string,
        prompt: string,
        sourceLanguage?: string,
        options?: UpdateStyleRuleCustomInstructionOptions,
    ): Promise<CustomInstruction> {
        const styleId = extractStyleRuleId(styleRule);
        const id = extractCustomInstructionId(instructionId);
        if (!label) {
            throw new ArgumentError('Parameter "label" must not be empty');
        }
        if (!prompt) {
            throw new ArgumentError('Parameter "prompt" must not be empty');
        }
        const instruction = customInstructionToWire(label, prompt, sourceLanguage);
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'PUT',
            customInstructionPath(styleId, id),
            {
                jsonBody: addExtraBodyParametersToJson(instruction, options),
                signal: options?.signal,
            },
        );
        await checkStatusCode(statusCode, content);
        return parseResponse(content, parseCustomInstruction);
    }

    /**
     * Deletes a custom instruction from a style rule.
     *
     * @param styleRule: The style rule, as an ID or a StyleRuleInfo object.
     * @param instructionId: The custom instruction to delete, as an ID or a CustomInstruction object.
     *
     * @param options Optional `signal` to cancel the request, see {@link RequestOptions}.
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async deleteStyleRuleCustomInstruction(
        styleRule: StyleId | StyleRuleInfo,
        instructionId: string | CustomInstruction,
        options?: RequestOptions,
    ): Promise<void> {
        const styleId = extractStyleRuleId(styleRule);
        const id = extractCustomInstructionId(instructionId);
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'DELETE',
            customInstructionPath(styleId, id),
            { signal: options?.signal },
        );
        await checkStatusCode(statusCode, content);
    }

    /**
     * Retrieves a page of the style profiles of the account.
     *
     * @param page: Page number for pagination, 0-indexed (optional, API default 0).
     * @param pageSize: Number of items per page (optional, API default 10, at most 100).
     * @param options Optional `signal` to cancel the request, see {@link RequestOptions}.
     * @returns {Promise<StyleProfile[]>} The style profiles on the page.
     *
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async listStyleProfiles(
        page?: number,
        pageSize?: number,
        options?: RequestOptions,
    ): Promise<StyleProfile[]> {
        const queryParams = new URLSearchParams();
        if (page !== undefined) {
            queryParams.append('page', String(page));
        }
        if (pageSize !== undefined) {
            queryParams.append('page_size', String(pageSize));
        }
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'GET',
            '/v3/style_profiles',
            { data: queryParams, signal: options?.signal },
        );
        await checkStatusCode(statusCode, content);
        return parseStyleProfileList(content);
    }

    /**
     * Creates a style profile. Only the name is required; options left undefined are not sent.
     * If any of the linked IDs cannot be used, the API rejects the request and creates nothing.
     *
     * The create request is retried only when it was not sent, so a retry never duplicates it.
     * @param name: Name of the style profile.
     * @param options: Description, industry and the IDs of the glossaries, style rule lists and
     *     translation memories to link, see {@link CreateStyleProfileOptions}.
     * @returns {Promise<StyleProfile>} The created style profile.
     *
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async createStyleProfile(
        name: string,
        options?: CreateStyleProfileOptions,
    ): Promise<StyleProfile> {
        const body = addExtraBodyParametersToJson(
            { name, ...styleProfileOptionsToJson(options) },
            options,
        );
        const { content } = await this.sendCreateRequest('/v3/style_profiles', {
            jsonBody: body,
            signal: options?.signal,
        });
        return parseStyleProfile(content);
    }

    /**
     * Retrieves a style profile.
     *
     * @param styleProfile: ID of the style profile, or a StyleProfile object.
     * @param options Optional `signal` to cancel the request, see {@link RequestOptions}.
     * @returns {Promise<StyleProfile>} The style profile.
     *
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async getStyleProfile(
        styleProfile: string | StyleProfile,
        options?: RequestOptions,
    ): Promise<StyleProfile> {
        const styleProfileId = extractStyleProfileId(styleProfile);
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'GET',
            `/v3/style_profiles/${encodeURIComponent(styleProfileId)}`,
            { signal: options?.signal },
        );
        await checkStatusCode(statusCode, content);
        return parseStyleProfile(content);
    }

    /**
     * Updates a style profile. Options left undefined are not changed. An empty string clears
     * the description or industry; an ID array replaces the linked components of that kind in
     * full, and an empty array unlinks all of them. With no options set, `{}` is sent and nothing
     * changes.
     *
     * @param styleProfile: ID of the style profile, or a StyleProfile object.
     * @param options: The fields to change (optional), see {@link UpdateStyleProfileOptions}.
     * @returns {Promise<StyleProfile>} The updated style profile.
     *
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async updateStyleProfile(
        styleProfile: string | StyleProfile,
        options?: UpdateStyleProfileOptions,
    ): Promise<StyleProfile> {
        const styleProfileId = extractStyleProfileId(styleProfile);
        const fields = styleProfileOptionsToJson(options);
        if (options?.name !== undefined) {
            fields.name = options.name;
        }
        const body = addExtraBodyParametersToJson(fields, options);
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'PATCH',
            `/v3/style_profiles/${encodeURIComponent(styleProfileId)}`,
            { jsonBody: body, signal: options?.signal },
        );
        await checkStatusCode(statusCode, content);
        return parseStyleProfile(content);
    }

    /**
     * Deletes a style profile. The linked glossaries, style rule lists and translation memories
     * are not deleted.
     *
     * @param styleProfile: ID of the style profile, or a StyleProfile object.
     *
     * @param options Optional `signal` to cancel the request, see {@link RequestOptions}.
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async deleteStyleProfile(
        styleProfile: string | StyleProfile,
        options?: RequestOptions,
    ): Promise<void> {
        const styleProfileId = extractStyleProfileId(styleProfile);
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'DELETE',
            `/v3/style_profiles/${encodeURIComponent(styleProfileId)}`,
            { signal: options?.signal },
        );
        await checkStatusCode(statusCode, content);
    }

    /**
     * HttpClient implements all HTTP requests and retries.
     * @protected
     */
    protected readonly httpClient: HttpClient;
    /**
     * Client for requests to pre-signed storage URLs, which are served by the Asset Store rather
     * than the DeepL API. It is constructed without the DeepL Authorization header — and without
     * any caller-configured headers — so credentials cannot reach a third-party host even by
     * mistake. See {@link DeepLClient.constructor}.
     */
    protected readonly storageHttpClient: HttpClient;
}
