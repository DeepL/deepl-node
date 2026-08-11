// Copyright 2022 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import { GlossaryEntries } from './glossaryEntries';
import { DeepLError } from './errors';
import {
    DocumentHandle,
    DocumentStatus,
    DocumentStatusCode,
    GlossaryLanguagePair,
    Language,
    SourceGlossaryLanguageCode,
    TextResult,
    TargetGlossaryLanguageCode,
    UsageDetail,
    Usage,
    GlossaryInfo,
    SourceLanguageCode,
    WriteResult,
    MultilingualGlossaryInfo,
    MultilingualGlossaryDictionaryInfo,
    MultilingualGlossaryDictionaryEntries,
    MultilingualGlossaryDictionaryApiResponse,
    MultilingualGlossaryDictionaryEntriesApiResponse,
    ListMultilingualGlossaryApiResponse,
    StyleRuleInfo,
    StyleRuleInfoApiResponse,
    ListStyleRuleApiResponse,
    ConfiguredRules,
    CustomInstruction,
    TranslationMemoryInfo,
    TranslationMemoryInfoApiResponse,
    ListTranslationMemoryApiResponse,
    TranslationMemoryExport,
    TranslationMemoryExportApiResponse,
    TranslationMemoryImport,
    TranslationMemoryImportApiResponse,
    TranslationMemoryJob,
    TranslationMemoryJobApiResponse,
    TranslationMemoryJobResult,
    TranslationMemoryJobStatus,
    TranslationMemorySegments,
    TranslationMemorySegmentsApiResponse,
} from './types';
import { standardizeLanguageCode } from './utils';

/**
 * Type used during JSON parsing of API response for glossary info.
 * @private
 */
interface GlossaryInfoApiResponse {
    glossary_id: string;
    name: string;
    ready: boolean;
    source_lang: string;
    target_lang: string;
    creation_time: string;
    entry_count: number;
}

/**
 * Type used during JSON parsing of API response for multilingual glossary info.
 * @private
 */
interface MultilingualGlossaryInfoApiResponse {
    glossary_id: string;
    name: string;
    dictionaries: MultilingualGlossaryDictionaryApiResponse[];
    creation_time: string;
}

/**
 * Type used during JSON parsing of API response for lists of glossary infos.
 * @private
 */
interface GlossaryInfoListApiResponse {
    glossaries: GlossaryInfoApiResponse[];
}

/**
 * Type used during JSON parsing of API response for usage.
 * @private
 */
interface UsageApiResponse {
    character_count?: number;
    character_limit?: number;
    document_count?: number;
    document_limit?: number;
    team_document_count?: number;
    team_document_limit?: number;
}

/**
 * Type used during JSON parsing of API response for text translation results.
 * @private
 */
interface TextResultApiResponse {
    text: string;
    detected_source_language: string;
    billed_characters: number;
    model_type_used?: string;
}

/**
 * Type used during JSON parsing of API response for lists of text translation results.
 * @private
 */
interface TextResultArrayApiResponse {
    translations: TextResultApiResponse[];
}

/**
 * Type used during JSON parsing of API response for text translation results.
 * @private
 */
interface WriteResultApiResponse {
    text: string;
    detected_source_language: string;
    target_language: string;
}

/**
 * Type used during JSON parsing of API response for lists of text rephrasing results.
 * @private
 */
interface WriteResultArrayApiResponse {
    improvements: WriteResultApiResponse[];
}

/**
 * Type used during JSON parsing of API response for languages.
 * @private
 */
interface LanguageApiResponse {
    language: string;
    name: string;
    supports_formality?: boolean;
}

/**
 * Type used during JSON parsing of API response for glossary language pairs.
 * @private
 */
interface GlossaryLanguagePairApiResponse {
    source_lang: string;
    target_lang: string;
}

/**
 * Type used during JSON parsing of API response for lists of glossary language pairs.
 * @private
 */
interface GlossaryLanguagePairArrayApiResponse {
    supported_languages: GlossaryInfoApiResponse[];
}

/**
 * Type used during JSON parsing of API response for multilingual glossary info.
 * @private
 */
interface MultilingualGlossaryInfoApiResponse {
    glossary_id: string;
    name: string;
    dictionaries: MultilingualGlossaryDictionaryApiResponse[];
    creation_time: string;
}

/**
 * Type used during JSON parsing of API response for document translation statuses.
 * @private
 */
interface DocumentStatusApiResponse {
    status: string;
    seconds_remaining?: number;
    billed_characters?: number;
    error_message?: string;
}

/**
 * Type used during JSON parsing of API response for document handles.
 * @private
 */
interface DocumentHandleApiResponse {
    document_id: string;
    document_key: string;
}

class UsageDetailImpl implements UsageDetail {
    public count: number;
    public limit: number;

    /**
     * @private Package users should not need to construct this class.
     */
    constructor(count: number, limit: number) {
        this.count = count;
        this.limit = limit;
    }

    limitReached(): boolean {
        return this.count >= this.limit;
    }
}

class UsageImpl implements Usage {
    public character?: UsageDetail;
    public document?: UsageDetail;
    public teamDocument?: UsageDetail;

    /**
     * @private Package users should not need to construct this class.
     */
    constructor(character?: UsageDetail, document?: UsageDetail, teamDocument?: UsageDetail) {
        this.character = character;
        this.document = document;
        this.teamDocument = teamDocument;
    }

    /** Returns true if any usage type limit has been reached or passed, otherwise false. */
    anyLimitReached(): boolean {
        return (
            this.character?.limitReached() ||
            this.document?.limitReached() ||
            this.teamDocument?.limitReached() ||
            false
        );
    }

    /** Converts the usage details to a human-readable string. */
    toString(): string {
        const labelledDetails: Array<[string, UsageDetail?]> = [
            ['Characters', this.character],
            ['Documents', this.document],
            ['Team documents', this.teamDocument],
        ];
        const detailsString = labelledDetails
            .filter(([, detail]) => detail)
            .map(
                ([label, detail]) =>
                    `${label}: ${(detail as UsageDetail).count} of ${
                        (detail as UsageDetail).limit
                    }`,
            );
        return 'Usage this billing period:\n' + detailsString.join('\n');
    }
}

class DocumentStatusImpl implements DocumentStatus {
    public status: DocumentStatusCode;
    public secondsRemaining?: number;
    public billedCharacters?: number;
    public errorMessage?: string;

    constructor(
        status: DocumentStatusCode,
        secondsRemaining?: number,
        billedCharacters?: number,
        errorMessage?: string,
    ) {
        this.status = status;
        this.secondsRemaining = secondsRemaining;
        this.billedCharacters = billedCharacters;
        this.errorMessage = errorMessage;
    }

    ok(): boolean {
        return this.status === 'queued' || this.status === 'translating' || this.status === 'done';
    }

    done(): boolean {
        return this.status === 'done';
    }
}

/**
 * Parses the given glossary info API response to a GlossaryInfo object.
 * @private
 */
function parseRawGlossaryInfo(obj: GlossaryInfoApiResponse): GlossaryInfo {
    return {
        glossaryId: obj.glossary_id,
        name: obj.name,
        ready: obj.ready,
        sourceLang: obj.source_lang as SourceGlossaryLanguageCode,
        targetLang: obj.target_lang as TargetGlossaryLanguageCode,
        creationTime: new Date(obj.creation_time),
        entryCount: obj.entry_count,
    };
}

/**
 * Parses the given multilingual glossary info API response to a GlossaryInfo object.
 * @private
 */
export function parseMultilingualGlossaryDictionaryInfo(
    obj: MultilingualGlossaryDictionaryApiResponse,
): MultilingualGlossaryDictionaryInfo {
    return {
        sourceLangCode: obj.source_lang as SourceGlossaryLanguageCode,
        targetLangCode: obj.target_lang as TargetGlossaryLanguageCode,
        entryCount: obj.entry_count,
    };
}

/**
 * Parses the given multilingual glossary info API response to a GlossaryInfo object.
 * @private
 */
function parseRawMultilingualGlossaryInfo(
    obj: MultilingualGlossaryInfoApiResponse,
): MultilingualGlossaryInfo {
    return {
        glossaryId: obj.glossary_id,
        name: obj.name,
        creationTime: new Date(obj.creation_time),
        dictionaries: obj.dictionaries.map((dict) => parseMultilingualGlossaryDictionaryInfo(dict)),
    };
}

/**
 * Parses the given multilingual glossary entries API response to a GlossaryDictionaryEntries object.
 * @private
 */
export function parseMultilingualGlossaryDictionaryEntries(
    obj: MultilingualGlossaryDictionaryEntriesApiResponse,
): MultilingualGlossaryDictionaryEntries[] {
    return obj.dictionaries.map((dict) => ({
        sourceLangCode: dict.source_lang as SourceGlossaryLanguageCode,
        targetLangCode: dict.target_lang as TargetGlossaryLanguageCode,
        entries: new GlossaryEntries({ tsv: dict.entries }),
    }));
}

/**
 * Parses the given list multilingual glossaries API response.
 * @private
 */
export function parseListMultilingualGlossaries(
    obj: ListMultilingualGlossaryApiResponse,
): MultilingualGlossaryInfo[] {
    return obj.glossaries.map((glossary) => ({
        glossaryId: glossary.glossary_id,
        name: glossary.name,
        dictionaries: glossary.dictionaries.map((dict) =>
            parseMultilingualGlossaryDictionaryInfo(dict),
        ),
        creationTime: new Date(glossary.creation_time),
    }));
}

/**
 * Parses the given JSON string to a GlossaryInfo object.
 * @private
 */
export function parseGlossaryInfo(json: string): GlossaryInfo {
    try {
        const obj = JSON.parse(json) as GlossaryInfoApiResponse;
        return parseRawGlossaryInfo(obj);
    } catch (error) {
        throw new DeepLError(`Error parsing response JSON: ${error}`);
    }
}

/**
 * Parses the given JSON string to a MultilingualGlossaryInfo object.
 * @private
 */
export function parseMultilingualGlossaryInfo(json: string): MultilingualGlossaryInfo {
    try {
        const obj = JSON.parse(json) as MultilingualGlossaryInfoApiResponse;
        return parseRawMultilingualGlossaryInfo(obj);
    } catch (error) {
        throw new DeepLError(`Error parsing response JSON: ${error}`);
    }
}

/**
 * Parses the given JSON string to an array of GlossaryInfo objects.
 * @private
 */
export function parseGlossaryInfoList(json: string): GlossaryInfo[] {
    try {
        const obj = JSON.parse(json) as GlossaryInfoListApiResponse;
        return obj.glossaries.map((rawGlossaryInfo: GlossaryInfoApiResponse) =>
            parseRawGlossaryInfo(rawGlossaryInfo),
        );
    } catch (error) {
        throw new DeepLError(`Error parsing response JSON: ${error}`);
    }
}

/**
 * Parses the given JSON string to a DocumentStatus object.
 * @private
 */
export function parseDocumentStatus(json: string): DocumentStatus {
    try {
        const obj = JSON.parse(json) as DocumentStatusApiResponse;
        return new DocumentStatusImpl(
            obj.status as DocumentStatusCode,
            obj.seconds_remaining,
            obj.billed_characters,
            obj.error_message,
        );
    } catch (error) {
        throw new DeepLError(`Error parsing response JSON: ${error}`);
    }
}

/**
 * Parses the given usage API response to a UsageDetail object, which forms part of a Usage object.
 * @private
 */
function parseUsageDetail(
    obj: UsageApiResponse,
    prefix: 'character' | 'document' | 'team_document',
): UsageDetail | undefined {
    const count = obj[`${prefix}_count`];
    const limit = obj[`${prefix}_limit`];
    if (count === undefined || limit === undefined) return undefined;
    return new UsageDetailImpl(count, limit);
}

/**
 * Parses the given JSON string to a Usage object.
 * @private
 */
export function parseUsage(json: string): Usage {
    try {
        const obj = JSON.parse(json) as UsageApiResponse;
        return new UsageImpl(
            parseUsageDetail(obj, 'character'),
            parseUsageDetail(obj, 'document'),
            parseUsageDetail(obj, 'team_document'),
        );
    } catch (error) {
        throw new DeepLError(`Error parsing response JSON: ${error}`);
    }
}

/**
 * Parses the given JSON string to an array of TextResult objects.
 * @private
 */
export function parseTextResultArray(json: string): TextResult[] {
    try {
        const obj = JSON.parse(json) as TextResultArrayApiResponse;
        return obj.translations.map((translation: TextResultApiResponse) => {
            return {
                text: translation.text,
                detectedSourceLang: standardizeLanguageCode(
                    translation.detected_source_language,
                ) as SourceLanguageCode,
                billedCharacters: translation.billed_characters,
                modelTypeUsed: translation.model_type_used,
            };
        });
    } catch (error) {
        throw new DeepLError(`Error parsing response JSON: ${error}`);
    }
}

export function parseWriteResultArray(json: string): WriteResult[] {
    try {
        const obj = JSON.parse(json) as WriteResultArrayApiResponse;
        return obj.improvements.map((improvement: WriteResultApiResponse) => {
            return {
                text: improvement.text,
                detectedSourceLang: standardizeLanguageCode(
                    improvement.detected_source_language,
                ) as SourceLanguageCode,
                targetLang: improvement.target_language,
            };
        });
    } catch (error) {
        throw new DeepLError(`Error parsing response JSON: ${error}`);
    }
}

/**
 * Parses the given language API response to a Language object.
 * @private
 */
function parseLanguage(lang: LanguageApiResponse): Language {
    try {
        const result = {
            name: lang.name,
            code: standardizeLanguageCode(lang.language),
            supportsFormality: lang.supports_formality,
        };
        if (result.supportsFormality === undefined) {
            delete result.supportsFormality;
        }
        return result;
    } catch (error) {
        throw new DeepLError(`Error parsing response JSON: ${error}`);
    }
}

/**
 * Parses the given JSON string to an array of Language objects.
 * @private
 */
export function parseLanguageArray(json: string): Language[] {
    const obj = JSON.parse(json) as LanguageApiResponse[];
    return obj.map((lang: LanguageApiResponse) => parseLanguage(lang));
}

/**
 * Parses the given glossary language pair API response to a GlossaryLanguagePair object.
 * @private
 */
function parseGlossaryLanguagePair(obj: GlossaryLanguagePairApiResponse): GlossaryLanguagePair {
    try {
        return {
            sourceLang: obj.source_lang as SourceGlossaryLanguageCode,
            targetLang: obj.target_lang as TargetGlossaryLanguageCode,
        };
    } catch (error) {
        throw new DeepLError(`Error parsing response JSON: ${error}`);
    }
}

/**
 * Parses the given JSON string to an array of GlossaryLanguagePair objects.
 * @private
 */
export function parseGlossaryLanguagePairArray(json: string): GlossaryLanguagePair[] {
    const obj = JSON.parse(json) as GlossaryLanguagePairArrayApiResponse;
    return obj.supported_languages.map((langPair: GlossaryLanguagePairApiResponse) =>
        parseGlossaryLanguagePair(langPair),
    );
}

/**
 * Parses the given JSON string to a DocumentHandle object.
 * @private
 */
export function parseDocumentHandle(json: string): DocumentHandle {
    try {
        const obj = JSON.parse(json) as DocumentHandleApiResponse;
        return { documentId: obj.document_id, documentKey: obj.document_key };
    } catch (error) {
        throw new DeepLError(`Error parsing response JSON: ${error}`);
    }
}

/**
 * Parses the given style rule API response to a ConfiguredRules object.
 * @private
 */
function parseConfiguredRules(
    configuredRulesData?: StyleRuleInfoApiResponse['configured_rules'],
): ConfiguredRules | undefined {
    if (!configuredRulesData) {
        return undefined;
    }
    return {
        datesAndTimes: configuredRulesData.dates_and_times,
        formatting: configuredRulesData.formatting,
        numbers: configuredRulesData.numbers,
        punctuation: configuredRulesData.punctuation,
        spellingAndGrammar: configuredRulesData.spelling_and_grammar,
        styleAndTone: configuredRulesData.style_and_tone,
        vocabulary: configuredRulesData.vocabulary,
    };
}

/**
 * Parses the given custom instruction API response to a CustomInstruction object.
 * @private
 */
export function parseCustomInstruction(instruction: {
    id?: string;
    label: string;
    prompt: string;
    source_language?: string;
}): CustomInstruction {
    return {
        id: instruction.id,
        label: instruction.label,
        prompt: instruction.prompt,
        sourceLanguage: instruction.source_language,
    };
}

/**
 * Parses the given style rule API response to a StyleRuleInfo object.
 * @private
 */
export function parseStyleRuleInfo(styleRule: StyleRuleInfoApiResponse): StyleRuleInfo {
    try {
        const customInstructions = styleRule.custom_instructions
            ? styleRule.custom_instructions.map(parseCustomInstruction)
            : undefined;

        return {
            styleId: styleRule.style_id,
            name: styleRule.name,
            creationTime: new Date(styleRule.creation_time),
            updatedTime: new Date(styleRule.updated_time),
            language: styleRule.language,
            version: styleRule.version,
            configuredRules: parseConfiguredRules(styleRule.configured_rules),
            customInstructions,
        };
    } catch (error) {
        throw new DeepLError(`Error parsing response JSON: ${error}`);
    }
}

/**
 * Parses the given JSON string to an array of StyleRuleInfo objects.
 * @private
 */
export function parseStyleRuleInfoList(json: string): StyleRuleInfo[] {
    try {
        const obj = JSON.parse(json) as ListStyleRuleApiResponse;
        return obj.style_rules.map((styleRule: StyleRuleInfoApiResponse) =>
            parseStyleRuleInfo(styleRule),
        );
    } catch (error) {
        throw new DeepLError(`Error parsing response JSON: ${error}`);
    }
}

/**
 * Parses an optional API timestamp, returning undefined if it is absent or unparseable.
 * @private
 */
function parseOptionalTimestamp(value?: string): Date | undefined {
    if (!value) {
        return undefined;
    }
    const date = new Date(value);
    return isNaN(date.getTime()) ? undefined : date;
}

/**
 * Parses the given translation memory API response to a TranslationMemoryInfo object.
 * @private
 */
export function parseTranslationMemoryInfo(
    tm: TranslationMemoryInfoApiResponse,
): TranslationMemoryInfo {
    return {
        translationMemoryId: tm.translation_memory_id,
        name: tm.name,
        sourceLanguage: tm.source_language,
        targetLanguages: tm.target_languages,
        segmentCount: tm.segment_count,
        creationTime: parseOptionalTimestamp(tm.creation_time),
        updatedTime: parseOptionalTimestamp(tm.updated_time),
    };
}

/**
 * Parses the given JSON string to a TranslationMemoryInfo object.
 * @private
 */
export function parseTranslationMemoryInfoJson(json: string): TranslationMemoryInfo {
    try {
        return parseTranslationMemoryInfo(JSON.parse(json) as TranslationMemoryInfoApiResponse);
    } catch (error) {
        throw new DeepLError(`Error parsing response JSON: ${error}`);
    }
}

/**
 * Parses the given JSON string to an array of TranslationMemoryInfo objects.
 * @private
 */
export function parseTranslationMemoryInfoList(json: string): TranslationMemoryInfo[] {
    try {
        const obj = JSON.parse(json) as ListTranslationMemoryApiResponse;
        return obj.translation_memories.map(parseTranslationMemoryInfo);
    } catch (error) {
        throw new DeepLError(`Error parsing response JSON: ${error}`);
    }
}

/**
 * Parses the given JSON string to a TranslationMemorySegments object.
 * @private
 */
export function parseTranslationMemorySegments(json: string): TranslationMemorySegments {
    try {
        const obj = JSON.parse(json) as TranslationMemorySegmentsApiResponse;
        return {
            segments: (obj.segments ?? []).map((segment) => ({
                sourceSegmentId: segment.source_segment_id,
                sourceText: segment.source_text,
                creationTime: parseOptionalTimestamp(segment.creation_time),
                updatedTime: parseOptionalTimestamp(segment.updated_time),
                lastUsedTime: parseOptionalTimestamp(segment.last_used_time),
                targets: (segment.targets ?? []).map((target) => ({
                    targetSegmentId: target.target_segment_id,
                    targetLanguage: target.target_language,
                    targetText: target.target_text,
                    creationTime: parseOptionalTimestamp(target.creation_time),
                    updatedTime: parseOptionalTimestamp(target.updated_time),
                    lastUsedTime: parseOptionalTimestamp(target.last_used_time),
                })),
            })),
            segmentCount: obj.segment_count ?? 0,
            nextPageCursor: obj.next_page_cursor,
        };
    } catch (error) {
        throw new DeepLError(`Error parsing response JSON: ${error}`);
    }
}

/**
 * Parses the given JSON string to a TranslationMemoryImport object.
 * @private
 */
export function parseTranslationMemoryImport(json: string): TranslationMemoryImport {
    try {
        const obj = JSON.parse(json) as TranslationMemoryImportApiResponse;
        return {
            jobId: obj.job_id,
            uploadUrl: obj.upload_url,
            expiresAt: parseOptionalTimestamp(obj.expires_at),
        };
    } catch (error) {
        throw new DeepLError(`Error parsing response JSON: ${error}`);
    }
}

/**
 * Parses the given JSON string to a TranslationMemoryExport object. reusedExisting reflects
 * whether the API answered 200 (reused a completed export) rather than 202 (started a new one).
 * @private
 */
export function parseTranslationMemoryExport(
    json: string,
    reusedExisting: boolean,
): TranslationMemoryExport {
    try {
        const obj = JSON.parse(json) as TranslationMemoryExportApiResponse;
        return {
            jobId: obj.job_id,
            translationMemoryId: obj.parameters?.translation_memory_id,
            reusedExisting,
        };
    } catch (error) {
        throw new DeepLError(`Error parsing response JSON: ${error}`);
    }
}

/**
 * Parses the given JSON string to a TranslationMemoryJob object.
 * @private
 */
export function parseTranslationMemoryJob(json: string): TranslationMemoryJob {
    try {
        const obj = JSON.parse(json) as TranslationMemoryJobApiResponse;
        const results: TranslationMemoryJobResult[] = (obj.results ?? []).map((result) => ({
            status: (result.status ?? '') as TranslationMemoryJobStatus,
            requiredAction: result.status_metadata?.required_action,
            downloadUrl: result.download_url,
            expiresAt: parseOptionalTimestamp(result.expires_at),
            errorMessage: result.error?.message,
            translationMemoryId: result.translation_memory_id,
            skippedSegmentCount: result.skipped_segment_count,
        }));
        return {
            jobId: obj.job_id,
            operation: (obj.operation ?? '') as 'import' | 'export',
            product: obj.product ?? 'translation_memory',
            results,
            creationTime: parseOptionalTimestamp(obj.creation_time),
            updatedTime: parseOptionalTimestamp(obj.updated_time),
            translationMemoryId: obj.parameters?.translation_memory_id,
            displayName: obj.parameters?.display_name,
            sourceContentType: obj.source_file?.content_type,
            sourceContentLength: obj.source_file?.content_length,
        };
    } catch (error) {
        throw new DeepLError(`Error parsing response JSON: ${error}`);
    }
}
