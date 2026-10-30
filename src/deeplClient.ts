// Copyright 2025 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import { Translator, checkStatusCode } from './translator';
import {
    BaseRequestOptions,
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
    RequestParameters,
} from './types';
import {
    parseMultilingualGlossaryDictionaryInfo,
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
    appendCsvDictionaryEntries,
    appendDictionaryEntries,
    appendTextsAndReturnIsSingular,
    extractGlossaryId,
    extractSpokenTermsId,
    extractStyleProfileId,
    extractTranslationMemoryId,
    isString,
    streamToBuffer,
    logInfo,
    resolveExtraBodyParameters,
    buildQueryString,
    setExtraBodyParameters,
    timeout,
} from './utils';
import { ArgumentError, DeepLError, GlossaryNotFoundError } from './errors';
import { GlossaryEntries } from './glossaryEntries';
import { IncomingMessage } from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';

function spokenTermsEntriesToJson(entries: SpokenTermsEntries): Record<string, unknown> {
    // Terms are trimmed, then validated and sent trimmed. Terms are sent newline-separated, so a
    // newline inside a term would split it
    const terms = entries.entries.map((term) => (typeof term === 'string' ? term.trim() : term));
    terms.forEach((term) => GlossaryEntries.validateGlossaryTerm(term));
    return { lang: entries.lang, entries: terms.join('\n') };
}

function multilingualGlossaryPath(glossary: GlossaryId | MultilingualGlossaryInfo): string {
    return `/v3/glossaries/${encodeURIComponent(extractGlossaryId(glossary))}`;
}

function addExtraBodyParametersToJson(
    body: Record<string, unknown>,
    options: BaseRequestOptions | undefined,
): Record<string, unknown> {
    // Added last, so they replace library-set fields with the same key
    const extraBodyParameters = resolveExtraBodyParameters(options);
    return extraBodyParameters === undefined ? body : { ...body, ...extraBodyParameters };
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

/**
 * @deprecated Pass the name, language, configured rules and custom instructions as separate
 * arguments to `createStyleRule()`. This type will be removed in the next major version.
 */
export type CreateStyleRuleRequestBody = {
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

export class DeepLClient extends Translator {
    constructor(authKey: string, options: DeepLClientOptions = {}) {
        super(authKey, options);
    }

    /**
     * @deprecated Pass the writing style in a {@link RephraseTextOptions} object as the third
     * argument instead. The positional parameters will be removed in the next major version.
     */
    async rephraseText<T extends string | string[]>(
        texts: T,
        targetLang: string | null | undefined,
        writingStyle: string,
        tone?: string | null,
    ): Promise<T extends string ? WriteResult : WriteResult[]>;
    /**
     * Rephrases the given text(s), optionally in a writing style or tone.
     * @param texts Text to rephrase, or an array of texts.
     * @param targetLang Target language code, or `null` to keep the language of the input text.
     * @param options Rephrasing options, see {@link RephraseTextOptions}. Passing the writing
     *     style as a string here is deprecated.
     * @param tone Deprecated, use {@link RephraseTextOptions.tone}.
     * @return Promise of a {@link WriteResult}, or an array of them if `texts` is an array.
     * @throws {ArgumentError} If an options object is combined with a `tone` argument.
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async rephraseText<T extends string | string[]>(
        texts: T,
        targetLang?: string | null,
        // string and the undefined tone keep subclass overrides with the old positional
        // signature compiling; a null tone would make string styles skip the deprecated overload
        options?: RephraseTextOptions | string | null,
        tone?: undefined,
    ): Promise<T extends string ? WriteResult : WriteResult[]>;
    /**
     * @deprecated Pass the writing style and tone in a {@link RephraseTextOptions} object as the
     * third argument instead. The positional parameters will be removed in the next major version.
     */
    async rephraseText<T extends string | string[]>(
        texts: T,
        targetLang?: string | null,
        writingStyle?: string | null,
        tone?: string | null,
    ): Promise<T extends string ? WriteResult : WriteResult[]>;
    async rephraseText<T extends string | string[]>(
        texts: T,
        targetLang?: string | null,
        writingStyleOrOptions?: string | RephraseTextOptions | null,
        tone?: string | null,
    ): Promise<T extends string ? WriteResult : WriteResult[]> {
        let writingStyle: string | null | undefined;
        let extraBodyParameters: RequestParameters | undefined;
        if (typeof writingStyleOrOptions === 'object' && writingStyleOrOptions !== null) {
            if (tone !== undefined && tone !== null) {
                throw new ArgumentError(
                    'tone cannot be passed as a separate argument together with an options object',
                );
            }
            ({ writingStyle, tone } = writingStyleOrOptions);
            extraBodyParameters = resolveExtraBodyParameters(writingStyleOrOptions);
        } else {
            writingStyle = writingStyleOrOptions;
        }

        const data = new URLSearchParams();
        if (targetLang) {
            data.append('target_lang', targetLang);
        }

        if (writingStyle) {
            data.append('writing_style', writingStyle);
        }

        if (tone) {
            data.append('tone', tone);
        }

        const singular = appendTextsAndReturnIsSingular(data, texts);
        setExtraBodyParameters(data, extraBodyParameters);
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'POST',
            '/v2/write/rephrase',
            { data },
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
        const data = new URLSearchParams();
        if (targetLang) {
            data.append('target_lang', targetLang);
        }

        const singular = appendTextsAndReturnIsSingular(data, texts);
        setExtraBodyParameters(data, resolveExtraBodyParameters(options));
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'POST',
            '/v2/write/correct',
            { data },
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

        const data = new URLSearchParams();
        data.append('name', name);
        appendDictionaryEntries(data, glossaryDicts);
        setExtraBodyParameters(data, resolveExtraBodyParameters(options));

        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'POST',
            '/v3/glossaries',
            { data: data },
        );

        await checkStatusCode(statusCode, content, true /* usingGlossary */);
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

        const data = new URLSearchParams();
        data.append('name', name);
        appendCsvDictionaryEntries(data, sourceLanguageCode, targetLanguageCode, csvContent);
        setExtraBodyParameters(data, resolveExtraBodyParameters(options));

        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'POST',
            '/v3/glossaries',
            { data: data },
        );

        await checkStatusCode(statusCode, content, true /* usingGlossary */);
        return parseMultilingualGlossaryInfo(content);
    }

    /**
     * @deprecated Use {@link createMultilingualGlossaryFromCsv} instead. Will be removed in the
     * next major version.
     */
    async createMultilingualGlossaryWithCsv(
        name: string,
        sourceLanguageCode: string,
        targetLanguageCode: string,
        csvContent: string,
    ): Promise<MultilingualGlossaryInfo> {
        return this.createMultilingualGlossaryFromCsv(
            name,
            sourceLanguageCode,
            targetLanguageCode,
            csvContent,
        );
    }

    /**
     * Retrieves information about the glossary with the specified ID.
     * This does not retrieve the glossary entries.
     * @param glossary The ID of the glossary or MultilingualGlossaryInfo object to retrieve.
     * @returns {Promise<MultilingualGlossaryInfo>} object with details about the specified glossary.
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async getMultilingualGlossary(
        glossary: GlossaryId | MultilingualGlossaryInfo,
    ): Promise<MultilingualGlossaryInfo> {
        if (!glossary || !extractGlossaryId(glossary)) {
            throw new ArgumentError('glossaryId must not be empty');
        }

        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'GET',
            multilingualGlossaryPath(glossary),
        );

        await checkStatusCode(statusCode, content, true /* usingGlossary */);
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
     * @returns {Promise<MultilingualGlossaryDictionaryEntries>} Object containing the dictionary entries.
     *
     * @throws {ArgumentError} If any argument is invalid.
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     * @throws {GlossaryNotFoundError} If no dictionary is found for the given source and target language codes.
     */
    async getMultilingualGlossaryDictionaryEntries(
        glossary: GlossaryId | MultilingualGlossaryInfo,
        sourceLanguageCode: string,
        targetLanguageCode: string,
    ): Promise<MultilingualGlossaryDictionaryEntries> {
        if (!glossary) {
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
            { data: queryParams },
        );

        await checkStatusCode(statusCode, content, true /* usingGlossary */);
        const dictionaryEntriesList = parseResponse(
            content,
            parseMultilingualGlossaryDictionaryEntries,
        );

        if (!dictionaryEntriesList || dictionaryEntriesList.length === 0) {
            throw new GlossaryNotFoundError('Glossary dictionary not found');
        }
        return dictionaryEntriesList[0];
    }

    /**
     * Retrieves a list of all multilingual glossaries available for the authenticated user.
     *
     * @returns {Promise<MultilingualGlossaryInfo[]>} An array of objects containing details about each glossary.
     *
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async listMultilingualGlossaries(): Promise<MultilingualGlossaryInfo[]> {
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'GET',
            '/v3/glossaries',
        );

        await checkStatusCode(statusCode, content, true /* usingGlossary */);
        return parseResponse(content, parseListMultilingualGlossaries);
    }

    /**
     * Deletes the glossary with the specified ID or MultilingualGlossaryInfo object.
     * @param glossary The ID of the glossary or MultilingualGlossaryInfo object to delete.
     * @throws {Error} If the glossaryId is empty.
     * @throws {DeepLError} If the glossary could not be deleted.
     */
    async deleteMultilingualGlossary(
        glossary: GlossaryId | MultilingualGlossaryInfo,
    ): Promise<void> {
        const glossaryId = extractGlossaryId(glossary);

        if (!glossaryId) {
            throw new Error('glossaryId must not be empty');
        }

        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'DELETE',
            multilingualGlossaryPath(glossaryId),
        );

        await checkStatusCode(statusCode, content, true /* usingGlossary */);
    }

    /**
     * Deletes a specific dictionary from a multilingual glossary based on the source and target language codes.
     *
     * @param glossary ID of the glossary or MultilingualGlossaryInfo object from which the dictionary will be deleted.
     * @param sourceLanguageCode Source language code of the dictionary to delete.
     * @param targetLanguageCode Target language code of the dictionary to delete.
     * @throws {ArgumentError} If any argument is invalid.
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async deleteMultilingualGlossaryDictionary(
        glossary: GlossaryId | MultilingualGlossaryInfo,
        sourceLanguageCode: string,
        targetLanguageCode: string,
    ): Promise<void> {
        if (!glossary) {
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
        );

        await checkStatusCode(statusCode, content, true /* usingGlossary */);
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
        if (!glossary) {
            throw new ArgumentError('Parameter "glossary" must not be empty/null');
        }
        if (!glossaryDict) {
            throw new ArgumentError('Parameter "glossaryDict" must not be null');
        }

        return this.putMultilingualGlossaryDictionary(
            glossary,
            {
                source_lang: glossaryDict.sourceLangCode,
                target_lang: glossaryDict.targetLangCode,
                entries: glossaryDict.entries.toTsv(),
                entries_format: 'tsv',
            },
            options,
        );
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
        if (!glossary) {
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
            {
                source_lang: sourceLanguageCode,
                target_lang: targetLanguageCode,
                entries: csvContent,
                entries_format: 'csv',
            },
            options,
        );
    }

    /**
     * @deprecated Use {@link replaceMultilingualGlossaryDictionaryFromCsv} instead. Will be
     * removed in the next major version.
     */
    async replaceMultilingualGlossaryDictionaryWithCsv(
        glossary: GlossaryId | MultilingualGlossaryInfo,
        sourceLanguageCode: string,
        targetLanguageCode: string,
        csvContent: string,
    ): Promise<MultilingualGlossaryDictionaryInfo> {
        return this.replaceMultilingualGlossaryDictionaryFromCsv(
            glossary,
            sourceLanguageCode,
            targetLanguageCode,
            csvContent,
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
            { jsonBody: addExtraBodyParametersToJson(body, options) },
        );

        await checkStatusCode(statusCode, content, true /* usingGlossary */);
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
            body.dictionaries = options.dictionaries.map((dict) => ({
                source_lang: dict.sourceLangCode,
                target_lang: dict.targetLangCode,
                entries: dict.entries.toTsv(),
                entries_format: 'tsv',
            }));
        }

        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'PATCH',
            multilingualGlossaryPath(glossary),
            { jsonBody: addExtraBodyParametersToJson(body, options) },
        );

        await checkStatusCode(statusCode, content, true /* usingGlossary */);
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
     * @throws {ArgumentError} If the name is invalid.
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

        const data = new URLSearchParams();
        data.append('name', name);
        return this.patchMultilingualGlossaryForm(glossary, data, options);
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
        if (!glossary) {
            throw new ArgumentError('Parameter "glossary" must not be empty/null');
        }
        if (!glossaryDict) {
            throw new ArgumentError('Parameter "glossaryDict" must not be null');
        }

        const data = new URLSearchParams();
        appendDictionaryEntries(data, [glossaryDict]);
        return this.patchMultilingualGlossaryForm(glossary, data, options);
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
        if (!glossary) {
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

        const data = new URLSearchParams();
        appendCsvDictionaryEntries(data, sourceLanguageCode, targetLanguageCode, csvContent);
        return this.patchMultilingualGlossaryForm(glossary, data, options);
    }

    /**
     * @deprecated Use {@link updateMultilingualGlossaryDictionaryFromCsv} instead. Will be
     * removed in the next major version.
     */
    async updateMultilingualGlossaryDictionaryWithCsv(
        glossary: GlossaryId | MultilingualGlossaryInfo,
        sourceLanguageCode: string,
        targetLanguageCode: string,
        csvContent: string,
    ): Promise<MultilingualGlossaryInfo> {
        return this.updateMultilingualGlossaryDictionaryFromCsv(
            glossary,
            sourceLanguageCode,
            targetLanguageCode,
            csvContent,
        );
    }

    /** @private */
    private async patchMultilingualGlossaryForm(
        glossary: GlossaryId | MultilingualGlossaryInfo,
        data: URLSearchParams,
        options: BaseRequestOptions | undefined,
    ): Promise<MultilingualGlossaryInfo> {
        setExtraBodyParameters(data, resolveExtraBodyParameters(options));

        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'PATCH',
            multilingualGlossaryPath(glossary),
            { data: data },
        );

        await checkStatusCode(statusCode, content, true /* usingGlossary */);
        return parseMultilingualGlossaryInfo(content);
    }

    /**
     * Creates a spoken terms collection with the given name and term lists. Spoken terms
     * improve the transcription of the given terms in speech recognition.
     *
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
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'POST',
            '/v3/spoken-terms',
            { jsonBody: body },
        );
        await checkStatusCode(statusCode, content);
        return parseSpokenTerms(content);
    }

    /**
     * Lists all spoken terms collections of the account.
     *
     * @returns {Promise<SpokenTerms[]>} Details about each collection, excluding the terms.
     *
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async listSpokenTerms(): Promise<SpokenTerms[]> {
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'GET',
            '/v3/spoken-terms',
        );
        await checkStatusCode(statusCode, content);
        return parseSpokenTermsArray(content);
    }

    /**
     * Retrieves details about a spoken terms collection, excluding the terms.
     *
     * @param spokenTerms ID of the collection, or a SpokenTerms object.
     * @returns {Promise<SpokenTerms>} Object with details about the collection.
     *
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async getSpokenTerms(spokenTerms: string | SpokenTerms): Promise<SpokenTerms> {
        const spokenTermsId = extractSpokenTermsId(spokenTerms);
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'GET',
            `/v3/spoken-terms/${encodeURIComponent(spokenTermsId)}`,
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
            { jsonBody: addExtraBodyParametersToJson(body, options) },
        );
        await checkStatusCode(statusCode, content);
        return parseSpokenTerms(content);
    }

    /**
     * Retrieves the terms of one language in a spoken terms collection.
     *
     * @param spokenTerms ID of the collection, or a SpokenTerms object.
     * @param lang Language code of the term list, for example 'en'.
     * @returns {Promise<SpokenTermsEntries>} The terms of the list.
     *
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async getSpokenTermsEntries(
        spokenTerms: string | SpokenTerms,
        lang: string,
    ): Promise<SpokenTermsEntries> {
        const spokenTermsId = extractSpokenTermsId(spokenTerms);
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'GET',
            `/v3/spoken-terms/${encodeURIComponent(spokenTermsId)}/entries`,
            { data: new URLSearchParams({ lang }) },
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
            { jsonBody: addExtraBodyParametersToJson(spokenTermsEntriesToJson(entries), options) },
        );
        await checkStatusCode(statusCode, content);
        return parseSpokenTermsList(content);
    }

    /**
     * Deletes a spoken terms collection.
     *
     * @param spokenTerms ID of the collection, or a SpokenTerms object.
     *
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async deleteSpokenTerms(spokenTerms: string | SpokenTerms): Promise<void> {
        const spokenTermsId = extractSpokenTermsId(spokenTerms);
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'DELETE',
            `/v3/spoken-terms/${encodeURIComponent(spokenTermsId)}`,
        );
        await checkStatusCode(statusCode, content);
    }

    /**
     * Deletes the term list of one language from a spoken terms collection.
     *
     * @param spokenTerms ID of the collection, or a SpokenTerms object.
     * @param lang Language code of the term list to delete, for example 'de'.
     *
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async deleteSpokenTermsList(spokenTerms: string | SpokenTerms, lang: string): Promise<void> {
        const spokenTermsId = extractSpokenTermsId(spokenTerms);
        const query = buildQueryString({ lang });
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'DELETE',
            `/v3/spoken-terms/${encodeURIComponent(spokenTermsId)}/term-lists?${query}`,
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
            { data },
        );

        await checkStatusCode(statusCode, content);
        return parseLanguageSupportList(content);
    }

    /**
     * Retrieves the resources supported by the DeepL API, along with their features and whether
     * each feature requires support from the source and/or target language.
     *
     * @returns {Promise<LanguageResource[]>} An array of objects, one per supported resource.
     *
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async getLanguageResources(): Promise<LanguageResource[]> {
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'GET',
            '/v3/languages/resources',
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
     * @returns {Promise<StyleRuleInfo[]>} An array of objects containing details about each style rule.
     *
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async getAllStyleRules(
        page?: number,
        pageSize?: number,
        detailed?: boolean,
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
            { data: queryParams },
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
     * @returns {Promise<TranslationMemoryInfo[]>} An array of objects containing details about each translation memory.
     *
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async listTranslationMemories(
        page?: number,
        pageSize?: number,
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
            { data: queryParams },
        );

        await checkStatusCode(statusCode, content);
        return parseTranslationMemoryInfoList(content);
    }

    /**
     * Retrieves a single translation memory by ID.
     *
     * @param translationMemory: Translation memory ID, or TranslationMemoryInfo object.
     * @returns {Promise<TranslationMemoryInfo>} Details of the translation memory.
     *
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async getTranslationMemory(
        translationMemory: TranslationMemoryId | TranslationMemoryInfo,
    ): Promise<TranslationMemoryInfo> {
        const translationMemoryId = extractTranslationMemoryId(translationMemory);
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'GET',
            `/v3/translation_memories/${encodeURIComponent(translationMemoryId)}`,
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
            { data: queryParams },
        );

        await checkStatusCode(statusCode, content);
        return parseTranslationMemorySegments(content);
    }

    /**
     * Deletes the specified translation memory.
     *
     * @param translationMemory: Translation memory ID, or TranslationMemoryInfo object.
     *
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async deleteTranslationMemory(
        translationMemory: TranslationMemoryId | TranslationMemoryInfo,
    ): Promise<void> {
        const translationMemoryId = extractTranslationMemoryId(translationMemory);
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'DELETE',
            `/v3/translation_memories/${encodeURIComponent(translationMemoryId)}`,
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

        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'POST',
            '/v3/translation_memories/import',
            { jsonBody: addExtraBodyParametersToJson(jsonBody, options) },
        );

        await checkStatusCode(statusCode, content);
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
     * @throws {DeepLError} If any error occurs while uploading the file.
     */
    async uploadTranslationMemoryFile(
        translationMemoryImport: string | TranslationMemoryImport,
        fileBuffer: Buffer,
        contentType = 'application/xml',
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
            { rawBody: fileBuffer, headers: { 'Content-Type': contentType } },
        );

        if (statusCode < 200 || statusCode >= 300) {
            const error = new DeepLError(
                `Error uploading translation memory file, HTTP status: ${statusCode}, content: ${content}`,
            );
            error.httpStatusCode = statusCode;
            error.shouldRetry = statusCode === 429 || statusCode >= 500;
            throw error;
        }
    }

    /**
     * Creates an export job for a translation memory.
     *
     * Poll getTranslationMemoryJob() for the download URL of the exported TMX file. Use
     * exportTranslationMemoryToFilepath() to do both steps and write the file at once.
     *
     * @param translationMemory: Translation memory ID, or TranslationMemoryInfo object.
     * @returns {Promise<TranslationMemoryExport>} The job ID, and whether the API reused a
     * previously completed export.
     *
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async createTranslationMemoryExport(
        translationMemory: TranslationMemoryId | TranslationMemoryInfo,
    ): Promise<TranslationMemoryExport> {
        const translationMemoryId = extractTranslationMemoryId(translationMemory);
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'POST',
            `/v3/translation_memories/${encodeURIComponent(translationMemoryId)}/export`,
        );

        await checkStatusCode(statusCode, content);
        // 200 means the API reused a previously completed export, 202 that it started a new one.
        return parseTranslationMemoryExport(content, statusCode === 200);
    }

    /**
     * Retrieves the status of a translation memory import or export job.
     *
     * @param job: ID of the job to query, or a TranslationMemoryJob object.
     * @returns {Promise<TranslationMemoryJob>} The current status of the job.
     *
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async getTranslationMemoryJob(
        job: string | TranslationMemoryJob,
    ): Promise<TranslationMemoryJob> {
        const jobId = typeof job === 'string' ? job : job?.jobId;
        if (!jobId) {
            throw new ArgumentError('jobId must not be empty');
        }
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'GET',
            `/v3/translation_memories/jobs/${encodeURIComponent(jobId)}`,
        );

        await checkStatusCode(statusCode, content);
        return parseTranslationMemoryJob(content);
    }

    /**
     * Polls a translation memory job every 5 seconds until it completes, and resolves with the
     * completed job.
     *
     * Note that an import job keeps reporting 'awaiting_input' for a while after its file has been
     * uploaded, because the API detects the upload asynchronously. That status, and statuses this
     * library does not know, are polled through. A job whose file is never uploaded does not finish
     * on its own, so set a timeout when that is a possibility.
     *
     * @param job: ID of the job to wait for, or a TranslationMemoryJob object.
     * @param options: (Optional) WaitOptions with timeoutMs, or the timeout in milliseconds as a
     * number: maximum time to wait before rejecting. Note that this is not accurate to the
     * millisecond, as the job is only polled every 5 seconds.
     * @returns {Promise<TranslationMemoryJob>} The completed job.
     *
     * @throws {DeepLError} If the job fails or expires (with the job's error message), the timeout
     * is exceeded, or any error occurs while communicating with the DeepL API.
     */
    async waitUntilTranslationMemoryJobDone(
        job: string | TranslationMemoryJob,
        options?: WaitOptions | number,
    ): Promise<TranslationMemoryJob> {
        const timeoutMs = typeof options === 'number' ? options : options?.timeoutMs;
        const deadline = timeoutMs !== undefined ? Date.now() + timeoutMs : undefined;
        let current = await this.getTranslationMemoryJob(job);
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
            await timeout(sleepMs);
            logInfo(`Rechecking translation memory job status after sleeping for ${sleepMs} ms.`);
            current = await this.getTranslationMemoryJob(current.jobId);
        }
        if (!current.ok()) {
            throw new DeepLError(current.result?.errorMessage || `Job ${current.status}`);
        }
        return current;
    }

    /**
     * Polls a translation memory job until it completes, and resolves with the completed job.
     *
     * @deprecated Use {@link waitUntilTranslationMemoryJobDone} instead. Will be removed in the
     * next major version.
     */
    async isTranslationMemoryJobComplete(
        job: string | TranslationMemoryJob,
        timeoutMs?: number | WaitOptions,
    ): Promise<TranslationMemoryJob> {
        return this.waitUntilTranslationMemoryJobDone(job, timeoutMs);
    }

    /**
     * Downloads the TMX file of a completed export job to the given output file path or stream.
     *
     * @param job: Completed export job carrying the download URL.
     * @param outputFile: String containing output file path, or a WriteStream to store file data.
     *
     * @throws {DeepLError} If the job has no download URL, or any error occurs while downloading.
     */
    async downloadTranslationMemoryExport(
        job: Omit<TranslationMemoryJob, 'done' | 'ok'>,
        outputFile: string | fs.WriteStream,
    ): Promise<void> {
        const downloadUrl = job.results[0]?.downloadUrl;
        if (!downloadUrl) {
            throw new ArgumentError(
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
            // Streamed rather than buffered as text, mirroring downloadDocument(): a TMX export
            // can be large, and decoding it to a string would both hold it all in memory and
            // risk corrupting bytes that are not valid UTF-8.
            const { statusCode, content } =
                await this.storageHttpClient.sendRequestWithBackoff<IncomingMessage>(
                    'GET',
                    downloadUrl,
                    {},
                    true,
                );
            // Routed through checkStatusCode so the storage service's error body ends up in the
            // message and the response stream is drained rather than left holding the socket.
            await checkStatusCode(statusCode, content, false, true);

            if (fd === undefined) {
                return await DeepLClient.pipeToStream(content, outputFile as fs.WriteStream);
            }
            // The stream owns the descriptor from here on and closes it when it finishes or is
            // destroyed, so it must not be closed a second time.
            fileStream = fs.createWriteStream(outputFile as string, { fd });
            streamClosed = new Promise<void>((resolve) => fileStream?.once('close', resolve));
            await DeepLClient.pipeToStream(content, fileStream);
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
     * Pipes a response stream to the given writable, rejecting if either side errors and
     * destroying the other so neither is left dangling.
     * @private
     */
    private static pipeToStream(content: IncomingMessage, outputStream: fs.WriteStream) {
        return new Promise<void>((resolve, reject) => {
            const fail = (error: Error) => {
                content.destroy();
                outputStream.destroy();
                reject(error);
            };
            content.on('error', fail);
            outputStream.on('error', fail);
            outputStream.on('finish', resolve);
            content.pipe(outputStream);
        });
    }

    /**
     * Imports a TMX file as a new translation memory: creates the import job, uploads the file,
     * and waits for processing to finish.
     *
     * Note that the API detects the upload asynchronously, so the job keeps reporting
     * 'awaiting_input' for a while (usually well under a minute) before it completes.
     *
     * @param input: Path of the TMX file to import, or a Buffer or ReadStream with its content.
     * @param options: Optional displayName for the resulting translation memory (defaults to the
     * file name), contentType (defaults to 'application/xml'), fileName (required for a Buffer or
     * stream unless displayName is set), extraBodyParameters, and timeoutMs limiting how long to
     * wait for the import to finish, see {@link ImportTranslationMemoryOptions}.
     * @returns {Promise<TranslationMemoryJob>} The completed import job; its result carries the
     * new translation memory ID.
     *
     * @throws {DeepLError} If the import fails, the timeout is exceeded, or any error occurs while
     * communicating with the DeepL API.
     */
    async importTranslationMemoryFromFilepath(
        input: string | Buffer | fs.ReadStream,
        options?: ImportTranslationMemoryOptions,
    ): Promise<TranslationMemoryJob> {
        let fileBuffer: Buffer;
        let fileName: string | undefined;
        if (isString(input)) {
            fileBuffer = await fs.promises.readFile(input);
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
        const created = await this.createTranslationMemoryImport(fileName, fileBuffer.length, {
            displayName: options?.displayName,
            contentType: options?.contentType,
            extraBodyParameters: options?.extraBodyParameters,
            extraRequestParameters: options?.extraRequestParameters,
        });
        await this.uploadTranslationMemoryFile(
            created,
            fileBuffer,
            options?.contentType ?? 'application/xml',
        );
        return this.waitUntilTranslationMemoryJobDone(created.jobId, options);
    }

    /**
     * Exports a translation memory to a TMX file: creates the export job, waits for it to finish,
     * and writes the result to outputFile.
     *
     * @param translationMemory: Translation memory ID, or TranslationMemoryInfo object.
     * @param outputFile: String containing output file path, or a WriteStream to store file data.
     * @param options: Optional WaitOptions with timeoutMs limiting how long to wait for the export
     * to finish.
     * @returns {Promise<TranslationMemoryJob>} The completed export job.
     *
     * @throws {DeepLError} If the export fails, the timeout is exceeded, or any error occurs while
     * communicating with the DeepL API.
     */
    async exportTranslationMemoryToFilepath(
        translationMemory: TranslationMemoryId | TranslationMemoryInfo,
        outputFile: string | fs.WriteStream,
        options?: WaitOptions,
    ): Promise<TranslationMemoryJob> {
        const created = await this.createTranslationMemoryExport(translationMemory);
        const job = await this.waitUntilTranslationMemoryJobDone(created.jobId, options);
        await this.downloadTranslationMemoryExport(job, outputFile);
        return job;
    }

    /**
     * Creates a new style rule.
     *
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
    ): Promise<StyleRuleInfo>;
    /**
     * @deprecated Pass the name, language, configured rules and custom instructions as separate
     * arguments instead. The object form will be removed in the next major version.
     */
    async createStyleRule(styleRule: CreateStyleRuleRequestBody): Promise<StyleRuleInfo>;
    async createStyleRule(
        nameOrStyleRule: string | CreateStyleRuleRequestBody,
        language?: string,
        configuredRules?: Record<string, Record<string, string>>,
        customInstructions?: CustomInstructionRequestBody[],
        options?: CreateStyleRuleOptions,
    ): Promise<StyleRuleInfo> {
        let body: CreateStyleRuleRequestBody;
        if (typeof nameOrStyleRule === 'string') {
            body = { name: nameOrStyleRule, language: language as string };
            if (configuredRules !== undefined) body.configured_rules = configuredRules;
            if (customInstructions !== undefined) body.custom_instructions = customInstructions;
        } else {
            body = nameOrStyleRule;
        }
        if (!body.name) {
            throw new ArgumentError('Parameter "name" must not be empty');
        }
        if (!body.language) {
            throw new ArgumentError('Parameter "language" must not be empty');
        }
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'POST',
            '/v3/style_rules',
            { jsonBody: addExtraBodyParametersToJson(body, options) },
        );
        await checkStatusCode(statusCode, content);
        return parseResponse(content, parseStyleRuleInfo);
    }

    /**
     * Retrieves a single style rule by ID.
     *
     * @param styleRule: The style rule to retrieve, as an ID or a StyleRuleInfo object.
     * @returns {Promise<StyleRuleInfo>} The style rule info.
     *
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async getStyleRule(styleRule: StyleId | StyleRuleInfo): Promise<StyleRuleInfo> {
        const styleId = extractStyleRuleId(styleRule);
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'GET',
            `/v3/style_rules/${encodeURIComponent(styleId)}`,
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
            { jsonBody: addExtraBodyParametersToJson({ name }, options) },
        );
        await checkStatusCode(statusCode, content);
        return parseResponse(content, parseStyleRuleInfo);
    }

    /**
     * Deletes a style rule.
     *
     * @param styleRule: The style rule to delete, as an ID or a StyleRuleInfo object.
     *
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async deleteStyleRule(styleRule: StyleId | StyleRuleInfo): Promise<void> {
        const styleId = extractStyleRuleId(styleRule);
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'DELETE',
            `/v3/style_rules/${encodeURIComponent(styleId)}`,
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
            { jsonBody: addExtraBodyParametersToJson(configuredRules, options) },
        );
        await checkStatusCode(statusCode, content);
        return parseResponse(content, parseStyleRuleInfo);
    }

    /**
     * Creates a custom instruction for a style rule.
     *
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
    ): Promise<CustomInstruction>;
    /**
     * @deprecated Pass the label, prompt and source language as separate arguments instead. The
     * object form will be removed in the next major version.
     */
    async createStyleRuleCustomInstruction(
        styleRule: StyleId | StyleRuleInfo,
        instruction: CustomInstructionRequestBody,
    ): Promise<CustomInstruction>;
    async createStyleRuleCustomInstruction(
        styleRule: StyleId | StyleRuleInfo,
        labelOrInstruction: string | CustomInstructionRequestBody,
        prompt?: string,
        sourceLanguage?: string,
        options?: CreateStyleRuleCustomInstructionOptions,
    ): Promise<CustomInstruction> {
        const styleId = extractStyleRuleId(styleRule);
        const instruction =
            typeof labelOrInstruction === 'string'
                ? customInstructionToWire(labelOrInstruction, prompt as string, sourceLanguage)
                : labelOrInstruction;
        if (!instruction.label) {
            throw new ArgumentError('Parameter "label" must not be empty');
        }
        if (!instruction.prompt) {
            throw new ArgumentError('Parameter "prompt" must not be empty');
        }
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'POST',
            `/v3/style_rules/${encodeURIComponent(styleId)}/custom_instructions`,
            { jsonBody: addExtraBodyParametersToJson(instruction, options) },
        );
        await checkStatusCode(statusCode, content);
        return parseResponse(content, parseCustomInstruction);
    }

    /**
     * Retrieves a custom instruction for a style rule.
     *
     * @param styleRule: The style rule, as an ID or a StyleRuleInfo object.
     * @param instructionId: The custom instruction, as an ID or a CustomInstruction object.
     * @returns {Promise<CustomInstruction>} The custom instruction.
     *
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async getStyleRuleCustomInstruction(
        styleRule: StyleId | StyleRuleInfo,
        instructionId: string | CustomInstruction,
    ): Promise<CustomInstruction> {
        const styleId = extractStyleRuleId(styleRule);
        const id = extractCustomInstructionId(instructionId);
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'GET',
            customInstructionPath(styleId, id),
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
    ): Promise<CustomInstruction>;
    /**
     * @deprecated Pass the label, prompt and source language as separate arguments instead. The
     * object form will be removed in the next major version.
     */
    async updateStyleRuleCustomInstruction(
        styleRule: StyleId | StyleRuleInfo,
        instructionId: string | CustomInstruction,
        instruction: CustomInstructionRequestBody,
    ): Promise<CustomInstruction>;
    async updateStyleRuleCustomInstruction(
        styleRule: StyleId | StyleRuleInfo,
        instructionId: string | CustomInstruction,
        labelOrInstruction: string | CustomInstructionRequestBody,
        prompt?: string,
        sourceLanguage?: string,
        options?: UpdateStyleRuleCustomInstructionOptions,
    ): Promise<CustomInstruction> {
        const styleId = extractStyleRuleId(styleRule);
        const id = extractCustomInstructionId(instructionId);
        const instruction =
            typeof labelOrInstruction === 'string'
                ? customInstructionToWire(labelOrInstruction, prompt as string, sourceLanguage)
                : labelOrInstruction;
        if (!instruction.label) {
            throw new ArgumentError('Parameter "label" must not be empty');
        }
        if (!instruction.prompt) {
            throw new ArgumentError('Parameter "prompt" must not be empty');
        }
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'PUT',
            customInstructionPath(styleId, id),
            { jsonBody: addExtraBodyParametersToJson(instruction, options) },
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
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async deleteStyleRuleCustomInstruction(
        styleRule: StyleId | StyleRuleInfo,
        instructionId: string | CustomInstruction,
    ): Promise<void> {
        const styleId = extractStyleRuleId(styleRule);
        const id = extractCustomInstructionId(instructionId);
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'DELETE',
            customInstructionPath(styleId, id),
        );
        await checkStatusCode(statusCode, content);
    }

    /**
     * Retrieves a page of the style profiles of the account.
     *
     * @param page: Page number for pagination, 0-indexed (optional, API default 0).
     * @param pageSize: Number of items per page (optional, API default 10, at most 100).
     * @returns {Promise<StyleProfile[]>} The style profiles on the page.
     *
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async listStyleProfiles(page?: number, pageSize?: number): Promise<StyleProfile[]> {
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
            { data: queryParams },
        );
        await checkStatusCode(statusCode, content);
        return parseStyleProfileList(content);
    }

    /**
     * Creates a style profile. Only the name is required; options left undefined are not sent.
     * If any of the linked IDs cannot be used, the API rejects the request and creates nothing.
     *
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
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'POST',
            '/v3/style_profiles',
            { jsonBody: body },
        );
        await checkStatusCode(statusCode, content);
        return parseStyleProfile(content);
    }

    /**
     * Retrieves a style profile.
     *
     * @param styleProfile: ID of the style profile, or a StyleProfile object.
     * @returns {Promise<StyleProfile>} The style profile.
     *
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async getStyleProfile(styleProfile: string | StyleProfile): Promise<StyleProfile> {
        const styleProfileId = extractStyleProfileId(styleProfile);
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'GET',
            `/v3/style_profiles/${encodeURIComponent(styleProfileId)}`,
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
            { jsonBody: body },
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
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async deleteStyleProfile(styleProfile: string | StyleProfile): Promise<void> {
        const styleProfileId = extractStyleProfileId(styleProfile);
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'DELETE',
            `/v3/style_profiles/${encodeURIComponent(styleProfileId)}`,
        );
        await checkStatusCode(statusCode, content);
    }
}
