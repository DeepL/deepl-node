// Copyright 2025 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import { Translator, checkStatusCode } from './translator';
import {
    DeepLClientOptions,
    WriteResult,
    MultilingualGlossaryDictionaryEntries,
    MultilingualGlossaryInfo,
    MultilingualGlossaryDictionaryInfo,
    MultilingualGlossaryDictionaryApiResponse,
    MultilingualGlossaryDictionaryEntriesApiResponse,
    GlossaryId,
    ListMultilingualGlossaryApiResponse,
    StyleRuleInfo,
    StyleRuleInfoApiResponse,
    StyleId,
    CustomInstruction,
    TranslationMemoryId,
    TranslationMemoryInfo,
    TranslationMemoryExport,
    TranslationMemoryImport,
    TranslationMemoryJob,
    TranslationMemorySegments,
    TranslationMemorySegmentsOptions,
    TranslationMemoryJobStatus,
} from './types';
import {
    parseMultilingualGlossaryDictionaryInfo,
    parseMultilingualGlossaryInfo,
    parseWriteResultArray,
    parseMultilingualGlossaryDictionaryEntries,
    parseListMultilingualGlossaries,
    parseStyleRuleInfoList,
    parseStyleRuleInfo,
    parseCustomInstruction,
    parseTranslationMemoryExport,
    parseTranslationMemoryImport,
    parseTranslationMemoryInfoJson,
    parseTranslationMemoryInfoList,
    parseTranslationMemoryJob,
    parseTranslationMemorySegments,
} from './parsing';
import {
    appendCsvDictionaryEntries,
    appendDictionaryEntries,
    appendTextsAndReturnIsSingular,
    extractGlossaryId,
    extractTranslationMemoryId,
    logInfo,
    timeout,
} from './utils';
import { ArgumentError, DeepLError, GlossaryNotFoundError } from './errors';
import { IncomingMessage } from 'http';
import * as fs from 'fs';
import * as path from 'path';
export type CustomInstructionRequestBody = {
    label: string;
    prompt: string;
    source_language?: string;
};

export type CreateStyleRuleRequestBody = {
    name: string;
    language: string;
    configured_rules?: Record<string, Record<string, string>>;
    custom_instructions?: CustomInstructionRequestBody[];
};

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

    async rephraseText<T extends string | string[]>(
        texts: T,
        targetLang?: string | null,
        writingStyle?: string | null,
        tone?: string | null,
    ): Promise<T extends string ? WriteResult : WriteResult[]> {
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
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'POST',
            '/v2/write/rephrase',
            { data },
        );

        await checkStatusCode(statusCode, content);
        const writeResults = parseWriteResultArray(content);
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
     * {@link createMultilingualGlossaryWithCsv}.
     *
     * @param name user-defined name to attach to glossary.
     * @param glossaryDicts the dictionaries of the glossary, see {@link MultilingualGlossaryDictionaryEntries}.
     * @return {Promise<MultilingualGlossaryInfo>} object with details about the newly created glossary.
     *
     * @throws {ArgumentError} If any argument is invalid.
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API
     */
    async createMultilingualGlossary(
        name: string,
        glossaryDicts: MultilingualGlossaryDictionaryEntries[],
    ): Promise<MultilingualGlossaryInfo> {
        if (!name) {
            throw new ArgumentError('glossary name must not be empty');
        }

        const data = new URLSearchParams();
        data.append('name', name);
        appendDictionaryEntries(data, glossaryDicts);

        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'POST',
            '/v3/glossaries',
            { data: data },
        );

        await checkStatusCode(statusCode, content);
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
     * @returns {Promise<MultilingualGlossaryInfo>} Object with details about the newly created glossary.
     *
     * @throws {ArgumentError} If any argument is invalid.
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async createMultilingualGlossaryWithCsv(
        name: string,
        sourceLanguageCode: string,
        targetLanguageCode: string,
        csvContent: string,
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

        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'POST',
            '/v3/glossaries',
            { data: data },
        );

        await checkStatusCode(statusCode, content);
        return parseMultilingualGlossaryInfo(content);
    }

    /**
     * Retrieves information about the glossary with the specified ID.
     * This does not retrieve the glossary entries.
     * @param glossaryId ID of glossary to retrieve.
     * @returns {Promise<MultilingualGlossaryInfo>} object with details about the specified glossary.
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async getMultilingualGlossary(glossaryId: string): Promise<MultilingualGlossaryInfo> {
        if (!glossaryId) {
            throw new ArgumentError('glossaryId must not be empty');
        }

        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'GET',
            `/v3/glossaries/${glossaryId}`,
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

        const glossaryId = extractGlossaryId(glossary);

        const queryParams = new URLSearchParams();
        queryParams.append('source_lang', sourceLanguageCode);
        queryParams.append('target_lang', targetLanguageCode);

        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'GET',
            `/v3/glossaries/${glossaryId}/entries`,
            { data: queryParams },
        );

        await checkStatusCode(statusCode, content, true /* usingGlossary */);
        const response = JSON.parse(content) as MultilingualGlossaryDictionaryEntriesApiResponse;
        const dictionaryEntriesList = parseMultilingualGlossaryDictionaryEntries(response);

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

        await checkStatusCode(statusCode, content);
        const response = JSON.parse(content) as ListMultilingualGlossaryApiResponse;
        return parseListMultilingualGlossaries(response);
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
            `/v3/glossaries/${glossaryId}`,
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

        const glossaryId = extractGlossaryId(glossary);

        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'DELETE',
            `/v3/glossaries/${glossaryId}/dictionaries?source_lang=${sourceLanguageCode}&target_lang=${targetLanguageCode}`,
        );

        await checkStatusCode(statusCode, content, true /* usingGlossary */);
    }

    /**
     * Replaces the dictionary entries for a specific source and target language pair in a multilingual glossary.
     *
     * @param glossary ID of the glossary or MultilingualGlossaryInfo object from which the dictionary will be deleted.
     * @param sourceLanguageCode Source language code of the dictionary to replace.
     * @param targetLanguageCode Target language code of the dictionary to replace.
     * @param entries Dictionary entries to replace, formatted as a string in TSV format.
     * @returns {Promise<MultilingualGlossaryDictionaryInfo>} Object containing details about the updated dictionary.
     *
     * @throws {ArgumentError} If any argument is invalid.
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async replaceMultilingualGlossaryDictionary(
        glossary: GlossaryId | MultilingualGlossaryInfo,
        glossaryDict: MultilingualGlossaryDictionaryEntries,
    ): Promise<MultilingualGlossaryDictionaryInfo> {
        if (!glossary) {
            throw new ArgumentError('Parameter "glossary" must not be empty/null');
        }
        if (!glossaryDict) {
            throw new ArgumentError('Parameter "glossaryDict" must not be null');
        }

        const glossaryId = extractGlossaryId(glossary);

        const data = new URLSearchParams();
        data.append('source_lang', glossaryDict.sourceLangCode);
        data.append('target_lang', glossaryDict.targetLangCode);
        data.append('entries', glossaryDict.entries.toTsv());
        data.append('entries_format', 'tsv');

        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'PUT',
            `/v3/glossaries/${glossaryId}/dictionaries`,
            { data: data },
        );

        await checkStatusCode(statusCode, content, true /* usingGlossary */);
        const response = JSON.parse(content) as MultilingualGlossaryDictionaryApiResponse;
        return parseMultilingualGlossaryDictionaryInfo(response);
    }

    /**
     * Replaces the dictionary entries for a specific source and target language pair in a multilingual glossary
     * using entries from a CSV file.
     *
     * @param glossary ID of the glossary or MultilingualGlossaryInfo object from which the dictionary will be deleted.
     * @param sourceLanguageCode Source language code of the dictionary to replace.
     * @param targetLanguageCode Target language code of the dictionary to replace.
     * @param csvContent String in CSV format containing the new entries.
     * @returns {Promise<MultilingualGlossaryDictionaryInfo>} Object containing details about the updated dictionary.
     *
     * @throws {ArgumentError} If any argument is invalid.
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async replaceMultilingualGlossaryDictionaryWithCsv(
        glossary: GlossaryId | MultilingualGlossaryInfo,
        sourceLanguageCode: string,
        targetLanguageCode: string,
        csvContent: string,
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

        const glossaryId = extractGlossaryId(glossary);

        const data = new URLSearchParams();
        data.append('source_lang', sourceLanguageCode);
        data.append('target_lang', targetLanguageCode);
        data.append('entries', csvContent);
        data.append('entries_format', 'csv');

        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'PUT',
            `/v3/glossaries/${glossaryId}/dictionaries`,
            { data: data },
        );

        await checkStatusCode(statusCode, content, true /* usingGlossary */);
        const response = JSON.parse(content) as MultilingualGlossaryDictionaryApiResponse;
        return parseMultilingualGlossaryDictionaryInfo(response);
    }

    /**
     * Updates the name of a multilingual glossary.
     *
     * @param glossary ID of the glossary or MultilingualGlossaryInfo object from which the dictionary will be deleted.
     * @param name New name for the glossary.
     * @returns {Promise<MultilingualGlossaryInfo>} Object containing details about the updated glossary.
     *
     * @throws {ArgumentError} If the name is invalid.
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async updateMultilingualGlossaryName(
        glossary: GlossaryId | MultilingualGlossaryInfo,
        name: string,
    ): Promise<MultilingualGlossaryInfo> {
        if (!name) {
            throw new ArgumentError('Parameter "name" must not be empty');
        }

        const glossaryId = extractGlossaryId(glossary);

        const data = new URLSearchParams();
        data.append('name', name);

        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'PATCH',
            `/v3/glossaries/${glossaryId}`,
            { data: data },
        );

        await checkStatusCode(statusCode, content, true /* usingGlossary */);
        return parseMultilingualGlossaryInfo(content);
    }

    /**
     * Updates the dictionary entries for a specific source and target language pair in a multilingual glossary.
     *
     * @param glossary ID of the glossary or MultilingualGlossaryInfo object to update.
     * @param glossaryDict The new or updated glossary dictionary.
     * @returns {Promise<MultilingualGlossaryInfo>} Object containing details about the updated glossary.
     *
     * @throws {ArgumentError} If any argument is invalid.
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async updateMultilingualGlossaryDictionary(
        glossary: GlossaryId | MultilingualGlossaryInfo,
        glossaryDict: MultilingualGlossaryDictionaryEntries,
    ): Promise<MultilingualGlossaryInfo> {
        if (!glossary) {
            throw new ArgumentError('Parameter "glossary" must not be empty/null');
        }
        if (!glossaryDict) {
            throw new ArgumentError('Parameter "glossaryDict" must not be null');
        }

        const glossaryId = extractGlossaryId(glossary);

        const data = new URLSearchParams();
        appendDictionaryEntries(data, [glossaryDict]);

        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'PATCH',
            `/v3/glossaries/${glossaryId}`,
            { data: data },
        );

        await checkStatusCode(statusCode, content, true /* usingGlossary */);
        return parseMultilingualGlossaryInfo(content);
    }

    /**
     * Updates the dictionary entries for a specific source and target language pair in a multilingual glossary
     * using entries from a CSV file.
     *
     * @param glossary ID of the glossary or MultilingualGlossaryInfo object to update.
     * @param sourceLanguageCode Source language code of the dictionary to update.
     * @param targetLanguageCode Target language code of the dictionary to update.
     * @param csvContent String in CSV format containing the new entries.
     * @returns {Promise<MultilingualGlossaryInfo>} Object containing details about the updated glossary.
     *
     * @throws {ArgumentError} If any argument is invalid.
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async updateMultilingualGlossaryDictionaryWithCsv(
        glossary: GlossaryId | MultilingualGlossaryInfo,
        sourceLanguageCode: string,
        targetLanguageCode: string,
        csvContent: string,
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

        const glossaryId = extractGlossaryId(glossary);

        const data = new URLSearchParams();
        appendCsvDictionaryEntries(data, sourceLanguageCode, targetLanguageCode, csvContent);

        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'PATCH',
            `/v3/glossaries/${glossaryId}`,
            { data: data },
        );

        await checkStatusCode(statusCode, content, true /* usingGlossary */);
        return parseMultilingualGlossaryInfo(content);
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
            `/v3/translation_memories/${translationMemoryId}`,
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
            `/v3/translation_memories/${translationMemoryId}/segments`,
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
            `/v3/translation_memories/${translationMemoryId}`,
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
     * @param options: Optional contentType (defaults to 'application/xml') and displayName for the
     * resulting translation memory (defaults to the file name).
     * @returns {Promise<TranslationMemoryImport>} The job ID and upload URL.
     *
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async createTranslationMemoryImport(
        fileName: string,
        contentLength: number,
        options?: { contentType?: string; displayName?: string },
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
            { jsonBody },
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
            throw new DeepLError(
                `Error uploading translation memory file, HTTP status: ${statusCode}, content: ${content}`,
            );
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
            `/v3/translation_memories/${translationMemoryId}/export`,
        );

        await checkStatusCode(statusCode, content);
        // 200 means the API reused a previously completed export, 202 that it started a new one.
        return parseTranslationMemoryExport(content, statusCode === 200);
    }

    /**
     * Retrieves the status of a translation memory import or export job.
     *
     * @param jobId: ID of the job to query.
     * @returns {Promise<TranslationMemoryJob>} The current status of the job.
     *
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async getTranslationMemoryJob(jobId: string): Promise<TranslationMemoryJob> {
        if (!jobId) {
            throw new ArgumentError('jobId must not be empty');
        }
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'GET',
            `/v3/translation_memories/jobs/${jobId}`,
        );

        await checkStatusCode(statusCode, content);
        return parseTranslationMemoryJob(content);
    }

    /**
     * Polls a translation memory job until it finishes, sleeping between requests, and resolves
     * with the final status.
     *
     * Note that an import job keeps reporting 'awaiting_input' for a while after its file has been
     * uploaded, because the API detects the upload asynchronously. That status is therefore polled
     * through like any other non-terminal one. A job whose file is never uploaded does not finish
     * on its own, so pass timeoutMs when that is a possibility.
     *
     * @param jobId: ID of the job to wait for.
     * @param timeoutMs: (Optional) Maximum time to wait in milliseconds before rejecting. Note that
     * this is not accurate to the millisecond, as the job is only polled every 5 seconds.
     * @returns {Promise<TranslationMemoryJob>} The job once it has finished.
     *
     * @throws {DeepLError} If the job fails, the timeout is exceeded, or any error occurs while
     * communicating with the DeepL API.
     */
    async isTranslationMemoryJobComplete(
        jobId: string,
        timeoutMs?: number,
    ): Promise<TranslationMemoryJob> {
        let job = await this.getTranslationMemoryJob(jobId);
        const startTimeMs = Date.now();
        while (!DeepLClient.isJobDone(job)) {
            // The API always returns exactly one result with a known status. Anything else
            // would never reach a terminal state, so fail closed instead of polling forever.
            const status = job.results[0]?.status;
            if (job.results.length === 0 || !DeepLClient.KNOWN_JOB_STATUSES.includes(status!)) {
                throw new DeepLError(
                    `Translation memory job ${jobId} returned an unusable status: ${
                        status ?? 'none'
                    }`,
                );
            }
            if (timeoutMs !== undefined && Date.now() - startTimeMs > timeoutMs) {
                throw new DeepLError(
                    `Timeout of ${timeoutMs}ms exceeded for translation memory job`,
                );
            }
            const secs = 5.0;
            await timeout(secs * 1000);
            logInfo(`Rechecking translation memory job status after sleeping for ${secs} seconds.`);
            job = await this.getTranslationMemoryJob(jobId);
        }
        const result = job.results[0];
        if (result !== undefined && (result.status === 'failed' || result.status === 'expired')) {
            throw new DeepLError(result.errorMessage || `Job ${result.status}`);
        }
        return job;
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
        job: TranslationMemoryJob,
        outputFile: string | fs.WriteStream,
    ): Promise<void> {
        const downloadUrl = job.results[0]?.downloadUrl;
        if (!downloadUrl) {
            throw new ArgumentError(
                'translation memory export job has no download URL; it may not have completed yet',
            );
        }

        // Streamed rather than buffered as text, mirroring downloadDocument(): a TMX export can
        // be large, and decoding it to a string would both hold it all in memory and risk
        // corrupting bytes that are not valid UTF-8.
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

        if (typeof outputFile === 'string') {
            const fileStream = fs.createWriteStream(outputFile, { flags: 'wx' });
            try {
                await DeepLClient.pipeToStream(content, fileStream);
            } catch (e) {
                await new Promise((resolve) => fileStream.close(resolve));
                // Never leave a truncated TMX behind: a caller that logs and continues would
                // otherwise see a file that looks like a successful export. But 'wx' fails with
                // EEXIST precisely to protect a file that was already there, so deleting on that
                // error would destroy the very file the flag exists to guard.
                if ((e as NodeJS.ErrnoException)?.code !== 'EEXIST') {
                    await fs.promises.unlink(outputFile).catch(() => undefined);
                }
                throw e;
            }
            return;
        }
        return DeepLClient.pipeToStream(content, outputFile);
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
     * @param inputPath: Path of the TMX file to import.
     * @param options: Optional displayName for the resulting translation memory (defaults to the
     * file name), contentType (defaults to 'application/xml'), and timeoutMs limiting how long to
     * wait for the import to finish.
     * @returns {Promise<TranslationMemoryJob>} The completed import job; its result carries the
     * new translation memory ID.
     *
     * @throws {DeepLError} If the import fails, the timeout is exceeded, or any error occurs while
     * communicating with the DeepL API.
     */
    async importTranslationMemoryFromFilepath(
        inputPath: string,
        options?: { displayName?: string; contentType?: string; timeoutMs?: number },
    ): Promise<TranslationMemoryJob> {
        const fileBuffer = await fs.promises.readFile(inputPath);
        const created = await this.createTranslationMemoryImport(
            path.basename(inputPath),
            fileBuffer.length,
            { displayName: options?.displayName, contentType: options?.contentType },
        );
        await this.uploadTranslationMemoryFile(
            created,
            fileBuffer,
            options?.contentType ?? 'application/xml',
        );
        return this.isTranslationMemoryJobComplete(created.jobId, options?.timeoutMs);
    }

    /**
     * Exports a translation memory to a TMX file: creates the export job, waits for it to finish,
     * and writes the result to outputFile.
     *
     * @param translationMemory: Translation memory ID, or TranslationMemoryInfo object.
     * @param outputFile: String containing output file path, or a WriteStream to store file data.
     * @param options: Optional timeoutMs limiting how long to wait for the export to finish.
     * @returns {Promise<TranslationMemoryJob>} The completed export job.
     *
     * @throws {DeepLError} If the export fails, the timeout is exceeded, or any error occurs while
     * communicating with the DeepL API.
     */
    async exportTranslationMemoryToFilepath(
        translationMemory: TranslationMemoryId | TranslationMemoryInfo,
        outputFile: string | fs.WriteStream,
        options?: { timeoutMs?: number },
    ): Promise<TranslationMemoryJob> {
        const created = await this.createTranslationMemoryExport(translationMemory);
        const job = await this.isTranslationMemoryJobComplete(created.jobId, options?.timeoutMs);
        await this.downloadTranslationMemoryExport(job, outputFile);
        return job;
    }

    /** Statuses the API is known to report; anything else is treated as unusable. @private */
    private static readonly KNOWN_JOB_STATUSES: TranslationMemoryJobStatus[] = [
        'awaiting_input',
        'processing',
        'completed',
        'downloaded',
        'failed',
        'expired',
    ];

    /**
     * True once the job has finished, successfully or not.
     * @private
     */
    private static isJobDone(job: TranslationMemoryJob): boolean {
        const status = job.results[0]?.status;
        return (
            status === 'completed' ||
            status === 'downloaded' ||
            status === 'failed' ||
            status === 'expired'
        );
    }

    /**
     * Creates a new style rule.
     *
     * @param styleRule: The style rule parameters including name, language, and optional configured_rules and custom_instructions.
     * @returns {Promise<StyleRuleInfo>} The created style rule info.
     *
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async createStyleRule(styleRule: CreateStyleRuleRequestBody): Promise<StyleRuleInfo> {
        if (!styleRule.name) {
            throw new ArgumentError('Parameter "name" must not be empty');
        }
        if (!styleRule.language) {
            throw new ArgumentError('Parameter "language" must not be empty');
        }
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'POST',
            '/v3/style_rules',
            { jsonBody: styleRule },
        );
        await checkStatusCode(statusCode, content);
        return parseStyleRuleInfo(JSON.parse(content) as StyleRuleInfoApiResponse);
    }

    /**
     * Retrieves a single style rule by ID.
     *
     * @param styleId: The ID of the style rule to retrieve.
     * @returns {Promise<StyleRuleInfo>} The style rule info.
     *
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async getStyleRule(styleId: StyleId): Promise<StyleRuleInfo> {
        if (!styleId) {
            throw new ArgumentError('Parameter "styleId" must not be empty');
        }
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'GET',
            `/v3/style_rules/${encodeURIComponent(styleId)}`,
        );
        await checkStatusCode(statusCode, content);
        return parseStyleRuleInfo(JSON.parse(content) as StyleRuleInfoApiResponse);
    }

    /**
     * Updates the name of a style rule.
     *
     * @param styleId: The ID of the style rule to update.
     * @param name: The new name for the style rule.
     * @returns {Promise<StyleRuleInfo>} The updated style rule info.
     *
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async updateStyleRuleName(styleId: StyleId, name: string): Promise<StyleRuleInfo> {
        if (!styleId) {
            throw new ArgumentError('Parameter "styleId" must not be empty');
        }
        if (!name) {
            throw new ArgumentError('Parameter "name" must not be empty');
        }
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'PATCH',
            `/v3/style_rules/${encodeURIComponent(styleId)}`,
            { jsonBody: { name } },
        );
        await checkStatusCode(statusCode, content);
        return parseStyleRuleInfo(JSON.parse(content) as StyleRuleInfoApiResponse);
    }

    /**
     * Deletes a style rule.
     *
     * @param styleId: The ID of the style rule to delete.
     *
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async deleteStyleRule(styleId: StyleId): Promise<void> {
        if (!styleId) {
            throw new ArgumentError('Parameter "styleId" must not be empty');
        }
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'DELETE',
            `/v3/style_rules/${encodeURIComponent(styleId)}`,
        );
        await checkStatusCode(statusCode, content);
    }

    /**
     * Updates the configured rules of a style rule.
     *
     * @param styleId: The ID of the style rule to update.
     * @param configuredRules: The new configured rules mapping.
     * @returns {Promise<StyleRuleInfo>} The updated style rule info.
     *
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async updateStyleRuleConfiguredRules(
        styleId: StyleId,
        configuredRules: Record<string, Record<string, string>>,
    ): Promise<StyleRuleInfo> {
        if (!styleId) {
            throw new ArgumentError('Parameter "styleId" must not be empty');
        }
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'PUT',
            `/v3/style_rules/${encodeURIComponent(styleId)}/configured_rules`,
            { jsonBody: configuredRules },
        );
        await checkStatusCode(statusCode, content);
        return parseStyleRuleInfo(JSON.parse(content) as StyleRuleInfoApiResponse);
    }

    /**
     * Creates a custom instruction for a style rule.
     *
     * @param styleId: The ID of the style rule.
     * @param instruction: The custom instruction parameters including label, prompt, and optional source_language.
     * @returns {Promise<CustomInstruction>} The created custom instruction.
     *
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async createStyleRuleCustomInstruction(
        styleId: StyleId,
        instruction: CustomInstructionRequestBody,
    ): Promise<CustomInstruction> {
        if (!styleId) {
            throw new ArgumentError('Parameter "styleId" must not be empty');
        }
        if (!instruction.label) {
            throw new ArgumentError('Parameter "label" must not be empty');
        }
        if (!instruction.prompt) {
            throw new ArgumentError('Parameter "prompt" must not be empty');
        }
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'POST',
            `/v3/style_rules/${encodeURIComponent(styleId)}/custom_instructions`,
            { jsonBody: instruction },
        );
        await checkStatusCode(statusCode, content);
        return parseCustomInstruction(JSON.parse(content));
    }

    /**
     * Retrieves a custom instruction for a style rule.
     *
     * @param styleId: The ID of the style rule.
     * @param instructionId: The ID of the custom instruction.
     * @returns {Promise<CustomInstruction>} The custom instruction.
     *
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async getStyleRuleCustomInstruction(
        styleId: StyleId,
        instructionId: string,
    ): Promise<CustomInstruction> {
        if (!styleId) {
            throw new ArgumentError('Parameter "styleId" must not be empty');
        }
        if (!instructionId) {
            throw new ArgumentError('Parameter "instructionId" must not be empty');
        }
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'GET',
            `/v3/style_rules/${encodeURIComponent(
                styleId,
            )}/custom_instructions/${encodeURIComponent(instructionId)}`,
        );
        await checkStatusCode(statusCode, content);
        return parseCustomInstruction(JSON.parse(content));
    }

    /**
     * Updates a custom instruction for a style rule.
     *
     * @param styleId: The ID of the style rule.
     * @param instructionId: The ID of the custom instruction to update.
     * @param instruction: The custom instruction parameters including label, prompt, and optional source_language.
     * @returns {Promise<CustomInstruction>} The updated custom instruction.
     *
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async updateStyleRuleCustomInstruction(
        styleId: StyleId,
        instructionId: string,
        instruction: CustomInstructionRequestBody,
    ): Promise<CustomInstruction> {
        if (!styleId) {
            throw new ArgumentError('Parameter "styleId" must not be empty');
        }
        if (!instructionId) {
            throw new ArgumentError('Parameter "instructionId" must not be empty');
        }
        if (!instruction.label) {
            throw new ArgumentError('Parameter "label" must not be empty');
        }
        if (!instruction.prompt) {
            throw new ArgumentError('Parameter "prompt" must not be empty');
        }
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'PUT',
            `/v3/style_rules/${encodeURIComponent(
                styleId,
            )}/custom_instructions/${encodeURIComponent(instructionId)}`,
            { jsonBody: instruction },
        );
        await checkStatusCode(statusCode, content);
        return parseCustomInstruction(JSON.parse(content));
    }

    /**
     * Deletes a custom instruction from a style rule.
     *
     * @param styleId: The ID of the style rule.
     * @param instructionId: The ID of the custom instruction to delete.
     *
     * @throws {DeepLError} If any error occurs while communicating with the DeepL API.
     */
    async deleteStyleRuleCustomInstruction(styleId: StyleId, instructionId: string): Promise<void> {
        if (!styleId) {
            throw new ArgumentError('Parameter "styleId" must not be empty');
        }
        if (!instructionId) {
            throw new ArgumentError('Parameter "instructionId" must not be empty');
        }
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            'DELETE',
            `/v3/style_rules/${encodeURIComponent(
                styleId,
            )}/custom_instructions/${encodeURIComponent(instructionId)}`,
        );
        await checkStatusCode(statusCode, content);
    }
}
