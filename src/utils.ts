// Copyright 2022 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import loglevel from 'loglevel';
import { IncomingMessage, STATUS_CODES } from 'http';
import {
    ArgumentError,
    AuthorizationError,
    ConnectionError,
    DeepLError,
    DocumentNotReadyError,
    NotFoundError,
    QuotaExceededError,
    TooManyRequestsError,
} from './errors';
import {
    Formality,
    GlossaryInfo,
    GlossaryId,
    LanguageCode,
    LanguageCodeInput,
    NonRegionalLanguageCode,
    RequestParameters,
    StyleId,
    TagList,
    TranslateTextOptions,
    MultilingualGlossaryInfo,
    SpokenTerms,
    StyleProfile,
    MultilingualGlossaryDictionaryEntries,
    StyleRuleInfo,
    TranslationMemoryId,
    TranslationMemoryInfo,
} from './types';

const logger = loglevel.getLogger('deepl');

// Stringify a value safely for logging. Default `${value}` interpolation
// throws "Cannot convert object to primitive value" on objects whose
// `[Symbol.toPrimitive]`/`toString`/`valueOf` returns an object instead of a
// primitive (some axios error fields fall into this category in certain
// releases). Fall back to JSON.stringify, and finally to a sentinel string.
function safeStringify(value: unknown): string {
    try {
        return String(value);
    } catch {
        try {
            return JSON.stringify(value) ?? '<unprintable>';
        } catch {
            return '<unprintable>';
        }
    }
}

function concatLoggingArgs(args?: object): string {
    let detail = '';
    if (args) {
        for (const [key, value] of Object.entries(args)) {
            detail += `, ${key} = ${safeStringify(value)}`;
        }
    }
    return detail;
}

export function logDebug(message: string, args?: object) {
    logger.debug(message + concatLoggingArgs(args));
}

export function logInfo(message: string, args?: object) {
    logger.info(message + concatLoggingArgs(args));
}

/**
 * Converts contents of given stream to a Buffer.
 * @private
 */
export async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('error', (err) => reject(err));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
}

/**
 * Converts contents of given stream to a string using UTF-8 encoding.
 * @private
 */
export async function streamToString(stream: NodeJS.ReadableStream): Promise<string> {
    return (await streamToBuffer(stream)).toString('utf8');
}

/**
 * Returns the reason the given signal was aborted with: the value passed to
 * AbortController.abort(), or the AbortError DOMException if none was given.
 * @private
 */
export function abortReason(signal: AbortSignal): unknown {
    // The pinned @types/node does not declare AbortSignal.reason; Node.js >= 17.2 sets it.
    return (signal as AbortSignal & { reason?: unknown }).reason;
}

/**
 * Rejects with the signal's abort reason, unwrapped, if the signal is aborted.
 * @private
 */
export function throwIfAborted(signal?: AbortSignal): void {
    if (signal?.aborted) {
        throw abortReason(signal);
    }
}

/**
 * Resolves after the given time, or rejects with the signal's abort reason when it is aborted.
 * @private
 */
export const timeout = (ms: number, signal?: AbortSignal) =>
    new Promise<void>((resolve, reject) => {
        if (signal?.aborted) {
            reject(abortReason(signal));
            return;
        }
        let timer: NodeJS.Timeout | undefined = undefined;
        const onAbort = () => {
            clearTimeout(timer);
            reject(abortReason(signal as AbortSignal));
        };
        timer = setTimeout(() => {
            signal?.removeEventListener('abort', onAbort);
            resolve();
        }, ms);
        signal?.addEventListener('abort', onAbort, { once: true });
    });

/**
 * Builds a URL query string, encoding names and values with encodeURIComponent, so a space is
 * sent as %20 rather than the "+" of URLSearchParams.
 * @private
 */
export function buildQueryString(params: Record<string, string>): string {
    return Object.entries(params)
        .map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(value)}`)
        .join('&');
}

/**
 * Pipes a response stream to the given writable, rejecting if either side errors and destroying
 * the other so neither is left dangling. A response-stream error means the connection failed
 * mid-download, so it rejects with a ConnectionError.
 * @private
 */
export function pipeToStream(
    content: IncomingMessage,
    outputStream: NodeJS.WritableStream & { destroy(error?: Error): unknown },
    signal?: AbortSignal,
): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        let onAbort: (() => void) | undefined = undefined;
        const fail = (error: unknown) => {
            if (onAbort) signal?.removeEventListener('abort', onAbort);
            content.destroy();
            outputStream.destroy();
            reject(error);
        };
        onAbort = () => fail(abortReason(signal as AbortSignal));
        if (signal?.aborted) {
            onAbort();
            return;
        }
        signal?.addEventListener('abort', onAbort, { once: true });
        content.on('error', (error: Error) =>
            fail(
                signal?.aborted
                    ? abortReason(signal)
                    : new ConnectionError(`Connection failure: ${error.message}`, true, error),
            ),
        );
        outputStream.on('error', fail);
        outputStream.on('finish', () => {
            if (onAbort) signal?.removeEventListener('abort', onAbort);
            resolve();
        });
        content.pipe(outputStream);
    });
}

/**
 * Returns true if the given argument is a string.
 * @param arg Argument to check.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isString(arg: any): arg is string {
    return typeof arg === 'string';
}

/**
 * Returns '1' if the given arg is truthy, '0' otherwise.
 * @param arg Argument to check.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toBoolString(arg: any): string {
    return arg ? '1' : '0';
}

/**
 * Returns true if the specified DeepL Authentication Key is associated with a free account,
 * otherwise false.
 * @param authKey The authentication key to check.
 * @return True if the key is associated with a free account, otherwise false.
 */
export function isFreeAccountAuthKey(authKey: string): boolean {
    return authKey.endsWith(':fx');
}

/**
 * Changes the upper- and lower-casing of the given language code to match ISO 639-1 with an
 * optional regional code from ISO 3166-1.
 * For example, input 'EN-US' returns 'en-US'.
 * @param langCode String containing language code to standardize.
 * @return Standardized language code.
 */
export function standardizeLanguageCode(langCode: string): LanguageCode {
    if (!isString(langCode) || langCode.length === 0) {
        throw new ArgumentError('langCode must be a non-empty string');
    }
    const [lang, region] = langCode.split('-', 2);
    return (
        region === undefined ? lang.toLowerCase() : `${lang.toLowerCase()}-${region.toUpperCase()}`
    ) as LanguageCode;
}

/**
 * Removes the regional variant from a language, for example inputs 'en' and 'en-US' both return
 * 'en'.
 * @param langCode String containing language code to convert.
 * @return Language code with regional variant removed.
 */
export function nonRegionalLanguageCode(langCode: string): NonRegionalLanguageCode {
    if (!isString(langCode) || langCode.length === 0) {
        throw new ArgumentError('langCode must be a non-empty string');
    }
    return langCode.split('-', 2)[0].toLowerCase() as NonRegionalLanguageCode;
}

/**
 * Converts the given TagList to an array of tags; a string may hold several comma-separated tags.
 * @private
 */
function toTagArray(tagList: TagList): string[] {
    const tags = isString(tagList) ? [tagList] : tagList;
    return tags.flatMap((tag) => tag.split(',')).map((tag) => tag.trim());
}

/**
 * Validates and prepares the body fields common to text and document translation.
 * `glossary_ids` is an array; the multipart document request joins it with commas.
 * @private
 */
export function buildTranslationBody(
    sourceLang: LanguageCodeInput | null,
    targetLang: LanguageCodeInput,
    formality: Formality | undefined,
    glossary: GlossaryId | GlossaryInfo | MultilingualGlossaryInfo | undefined,
    glossaryIds?: Array<GlossaryId | GlossaryInfo | MultilingualGlossaryInfo>,
): Record<string, unknown> {
    targetLang = standardizeLanguageCode(targetLang);
    if (sourceLang !== null) {
        sourceLang = standardizeLanguageCode(sourceLang);
    }

    // A null option is unset, like undefined. Treat an empty glossaryIds array as
    // "no glossaries" so it doesn't send an empty glossary_ids field.
    const hasGlossary = glossary !== undefined && glossary !== null;
    const hasGlossaryIds =
        glossaryIds !== undefined && glossaryIds !== null && glossaryIds.length > 0;

    if (hasGlossary && hasGlossaryIds) {
        throw new ArgumentError(
            'glossary and glossaryIds options cannot be used together, please use only one.',
        );
    }

    if (hasGlossaryIds && glossaryIds.length > 5) {
        throw new ArgumentError('glossaryIds option supports at most 5 glossaries.');
    }

    const body: Record<string, unknown> = { target_lang: targetLang };
    if (sourceLang !== null) {
        body.source_lang = sourceLang;
    }
    if (formality !== undefined) {
        body.formality = String(formality).toLowerCase();
    }
    if (glossary !== undefined && glossary !== null) {
        if (!isString(glossary)) {
            if (glossary.glossaryId === undefined) {
                throw new ArgumentError(
                    'glossary option should be a string containing the Glossary ID or a GlossaryInfo object.',
                );
            }
            glossary = glossary.glossaryId;
        }
        body.glossary_id = glossary;
    }
    if (hasGlossaryIds) {
        body.glossary_ids = glossaryIds.map((glossaryId) => {
            if (!isString(glossaryId)) {
                if (glossaryId?.glossaryId === undefined) {
                    throw new ArgumentError(
                        'glossaryIds entries should be strings containing the Glossary ID or GlossaryInfo objects.',
                    );
                }
                return glossaryId.glossaryId;
            }
            return glossaryId;
        });
    }
    return body;
}

/**
 * Converts body fields to form parameters for the multipart document request: arrays are
 * joined with commas, other values converted to strings.
 * @private
 */
export function toFormParameters(body: Record<string, unknown>): URLSearchParams {
    const data = new URLSearchParams();
    for (const [name, value] of Object.entries(body)) {
        data.append(name, Array.isArray(value) ? value.join(',') : String(value));
    }
    return data;
}

/**
 * Sets the extra body parameters on the request, replacing parameters of the same name. Call it
 * after all other parameters are appended.
 * @private
 */
export function setExtraBodyParameters(
    data: URLSearchParams,
    extraBodyParameters: RequestParameters | undefined,
) {
    if (extraBodyParameters === undefined) return;
    for (const [name, value] of Object.entries(extraBodyParameters)) {
        if (value === undefined) continue;
        if (value === null) {
            data.delete(name);
        } else if (isString(value)) {
            data.set(name, value);
        } else if (Array.isArray(value)) {
            data.set(name, value.join(','));
        } else if (typeof value === 'object') {
            data.set(name, JSON.stringify(value));
        } else {
            data.set(name, String(value));
        }
    }
}

/**
 * Returns the JSON body with the extra body parameters added last, replacing fields of the same
 * name. A `null` value is sent as JSON `null`; an `undefined` value is ignored.
 * @private
 */
export function mergeExtraBodyParameters(
    body: Record<string, unknown>,
    extraBodyParameters: RequestParameters | undefined,
): Record<string, unknown> {
    if (extraBodyParameters === undefined) return body;
    const merged = { ...body };
    for (const [name, value] of Object.entries(extraBodyParameters)) {
        if (value === undefined) continue;
        merged[name] = value;
    }
    return merged;
}

/**
 * Validates texts and sets them as the `text` array of the request body, and returns whether a
 * single text argument was provided.
 * @param body JSON request body.
 * @param texts User-supplied texts to be checked.
 * @return True if only a single text was provided.
 * @private
 */
export function setTextsAndReturnIsSingular(
    body: Record<string, unknown>,
    texts: string | string[],
): boolean {
    const singular = !Array.isArray(texts);
    const textArray: unknown[] = singular ? [texts] : texts;
    for (const text of textArray) {
        if (!isString(text) || text.length === 0) {
            throw new ArgumentError(
                'texts parameter must be a non-empty string or array of non-empty strings',
            );
        }
    }
    body.text = textArray;
    return singular;
}

/**
 * Validates and sets style-rule, style-profile and translation-memory options in a request body.
 * These options are shared between text and document translation requests.
 * @param body Request body fields.
 * @param options Options containing style-rule and translation-memory fields.
 * @private
 */
export function setStyleAndTranslationMemoryOptions(
    body: Record<string, unknown>,
    options: {
        styleRule?: StyleId | StyleRuleInfo;
        styleProfile?: string | StyleProfile;
        translationMemory?: TranslationMemoryId | TranslationMemoryInfo;
        translationMemoryThreshold?: number;
    },
) {
    // A null option is unset, like undefined.
    if (options.styleRule !== undefined && options.styleRule !== null) {
        if (!isString(options.styleRule)) {
            if (options.styleRule.styleId === undefined) {
                throw new ArgumentError(
                    'styleRule option should be a StyleId (string) containing the Style Rule ID or a StyleRuleInfo object.',
                );
            }
            body.style_id = options.styleRule.styleId;
        } else {
            body.style_id = options.styleRule;
        }
    }
    if (options.styleProfile !== undefined && options.styleProfile !== null) {
        if (!isString(options.styleProfile)) {
            if (options.styleProfile.styleProfileId === undefined) {
                throw new ArgumentError(
                    'styleProfile option should be a string containing the style profile ID or a StyleProfile object.',
                );
            }
            body.style_profile_id = options.styleProfile.styleProfileId;
        } else {
            body.style_profile_id = options.styleProfile;
        }
    }
    if (options.translationMemory !== undefined && options.translationMemory !== null) {
        if (!isString(options.translationMemory)) {
            if (options.translationMemory.translationMemoryId === undefined) {
                throw new ArgumentError(
                    'translationMemory option should be a TranslationMemoryId (string) or a TranslationMemoryInfo object.',
                );
            }
            body.translation_memory_id = options.translationMemory.translationMemoryId;
        } else {
            body.translation_memory_id = options.translationMemory;
        }
    }
    if (options.translationMemoryThreshold !== undefined) {
        if (options.translationMemory === undefined || options.translationMemory === null) {
            throw new ArgumentError('translationMemoryThreshold requires translationMemory');
        }
        if (options.translationMemoryThreshold < 0 || options.translationMemoryThreshold > 100) {
            throw new ArgumentError(
                'translationMemoryThreshold must be a number between 0 and 100.',
            );
        }
        body.translation_memory_threshold = options.translationMemoryThreshold;
    }
}

/**
 * Validates and sets text options in the JSON request body.
 * @param body JSON request body.
 * @param options Options for translate text request.
 * Note the formality and glossaryId options are handled separately, because these options
 * overlap with the translateDocument function.
 * @private
 */
export function validateAndSetTextOptions(
    body: Record<string, unknown>,
    options?: TranslateTextOptions,
) {
    if (!options) {
        return;
    }
    if (options.splitSentences !== undefined) {
        const splitSentences = options.splitSentences.toLowerCase();
        body.split_sentences = splitSentences === 'off' ? '0' : splitSentences;
    }
    if (options.preserveFormatting !== undefined) {
        body.preserve_formatting = Boolean(options.preserveFormatting);
    }
    if (options.tagHandling !== undefined) {
        body.tag_handling = options.tagHandling;
    }
    if (options.tagHandlingVersion !== undefined) {
        body.tag_handling_version = options.tagHandlingVersion;
    }
    if (options.outlineDetection !== undefined) {
        body.outline_detection = Boolean(options.outlineDetection);
    }
    if (options.context !== undefined) {
        body.context = options.context;
    }
    if (options.modelType !== undefined) {
        body.model_type = options.modelType;
    }
    if (options.nonSplittingTags !== undefined) {
        body.non_splitting_tags = toTagArray(options.nonSplittingTags);
    }
    if (options.splittingTags !== undefined) {
        body.splitting_tags = toTagArray(options.splittingTags);
    }
    if (options.ignoreTags !== undefined) {
        body.ignore_tags = toTagArray(options.ignoreTags);
    }
    setStyleAndTranslationMemoryOptions(body, options);
    if (options.customInstructions !== undefined && options.customInstructions.length > 0) {
        body.custom_instructions = [...options.customInstructions];
    }
}

/**
 * Converts glossary dictionaries to the `dictionaries` array of a v3 glossary request body.
 * @param dictionaries Glossary dictionaries to convert.
 * @private
 */
export function dictionaryEntriesToJson(
    dictionaries: MultilingualGlossaryDictionaryEntries[],
): Record<string, string>[] {
    for (const dict of dictionaries) {
        if (!dict?.entries || Object.keys(dict.entries.entries()).length === 0) {
            throw new ArgumentError('glossary dictionary entries must not be empty');
        }
    }
    return dictionaries.map((dict) => ({
        source_lang: dict.sourceLangCode,
        target_lang: dict.targetLangCode,
        entries: dict.entries.toTsv(),
        entries_format: 'tsv',
    }));
}

/**
 * Converts a glossary dictionary with CSV entries to an entry of the `dictionaries` array of a
 * v3 glossary request body.
 * @param sourceLanguageCode Source language code of the dictionary.
 * @param targetLanguageCode Target language code of the dictionary.
 * @param csvContent CSV-formatted string containing the dictionary entries.
 * @private
 */
export function csvDictionaryToJson(
    sourceLanguageCode: string,
    targetLanguageCode: string,
    csvContent: string,
): Record<string, string> {
    return {
        source_lang: sourceLanguageCode,
        target_lang: targetLanguageCode,
        entries: csvContent,
        entries_format: 'csv',
    };
}

/**
 * Extract the glossary ID from the argument.
 * @param glossary The glossary as a string, GlossaryInfo, or MultilingualGlossaryInfo.
 * @private
 */
export function extractGlossaryId(glossary: GlossaryId | GlossaryInfo | MultilingualGlossaryInfo) {
    return typeof glossary === 'string' ? glossary : glossary.glossaryId;
}

/**
 * Extract the spoken terms ID from the argument.
 * @param spokenTerms The spoken terms collection as an ID string or SpokenTerms object.
 * @private
 */
export function extractSpokenTermsId(spokenTerms: string | SpokenTerms): string {
    const spokenTermsId = isString(spokenTerms) ? spokenTerms : spokenTerms?.spokenTermsId;
    if (!spokenTermsId) {
        throw new ArgumentError('Parameter "spokenTerms" must not be empty');
    }
    return spokenTermsId;
}

/**
 * Extract the style profile ID from the argument.
 * @param styleProfile The style profile as an ID string or StyleProfile object.
 * @private
 */
export function extractStyleProfileId(styleProfile: string | StyleProfile): string {
    const styleProfileId = isString(styleProfile) ? styleProfile : styleProfile?.styleProfileId;
    if (!styleProfileId) {
        throw new ArgumentError('Parameter "styleProfile" must not be empty');
    }
    return styleProfileId;
}

/**
 * Extract the translation memory ID from the argument.
 * @param translationMemory The translation memory as a string or TranslationMemoryInfo.
 * @private
 */
export function extractTranslationMemoryId(
    translationMemory: TranslationMemoryId | TranslationMemoryInfo,
): TranslationMemoryId {
    const translationMemoryId = isString(translationMemory)
        ? translationMemory
        : translationMemory?.translationMemoryId;
    if (!translationMemoryId) {
        throw new ArgumentError(
            'translationMemory should be a TranslationMemoryId (string) or a TranslationMemoryInfo object.',
        );
    }
    return translationMemoryId;
}

function createStatusCodeError(
    statusCode: number,
    message: string,
    content: string,
    inDocumentDownload: boolean,
): DeepLError {
    switch (statusCode) {
        case 401:
        case 403:
            return new AuthorizationError(`Authorization failure, check auth_key${message}`);
        case 456:
            return new QuotaExceededError(
                `Quota for this billing period has been exceeded${message}`,
            );
        case 404:
            return new NotFoundError(`Not found${message}`);
        case 400:
            return new DeepLError(`Bad request${message}`);
        case 429:
            return new TooManyRequestsError(
                `Too many requests, DeepL servers are currently experiencing high load${message}`,
            );
        case 503:
            if (inDocumentDownload) {
                return new DocumentNotReadyError(`Document not ready${message}`);
            } else {
                return new DeepLError(`Service unavailable${message}`);
            }
        default: {
            const statusName = STATUS_CODES[statusCode] || 'Unknown';
            return new DeepLError(
                `Unexpected status code: ${statusCode} ${statusName}${message}, content: ${content}`,
            );
        }
    }
}

/**
 * Checks the HTTP status code, and in case of failure, throws an exception with diagnostic information.
 * @private
 */
export async function checkStatusCode(
    statusCode: number,
    content: string | IncomingMessage,
    inDocumentDownload = false,
): Promise<void> {
    if (200 <= statusCode && statusCode < 300) return;

    if (content instanceof IncomingMessage) {
        try {
            content = await streamToString(content);
        } catch (e) {
            content = `Error occurred while reading response: ${e}`;
        }
    }

    let message = '';
    try {
        const jsonObj = JSON.parse(content);
        if (jsonObj.message !== undefined) {
            message += `, message: ${jsonObj.message}`;
        }
        if (jsonObj.detail !== undefined) {
            message += `, detail: ${jsonObj.detail}`;
        }
    } catch (error) {
        // JSON parsing errors are ignored, and we fall back to the raw content
        message = ', ' + content;
    }

    const error = createStatusCodeError(statusCode, message, content, inDocumentDownload);
    error.httpStatusCode = statusCode;
    error.shouldRetry = statusCode === 429 || statusCode >= 500;
    throw error;
}
