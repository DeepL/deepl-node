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
    UsageProduct,
    GlossaryInfo,
    SourceLanguageCode,
    WriteResult,
    MultilingualGlossaryInfo,
    MultilingualGlossaryDictionaryInfo,
    SpokenTerms,
    SpokenTermsEntries,
    SpokenTermsList,
    StyleProfile,
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
    LanguageResource,
    LanguageResourceApiResponse,
    ResourceFeature,
    LanguageSupport,
    LanguageFeature,
    AdminUsageBreakdown,
    AdminUsageReport,
    CustomTagUsage,
    CustomTagUsageBreakdown,
    CustomTagUsageReport,
    DeveloperKey,
    KeyUsage,
} from './types';
import { isString, standardizeLanguageCode } from './utils';

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
    api_key_character_count?: number;
    api_key_character_limit?: number;
    speech_to_text_minutes_count?: number;
    speech_to_text_minutes_limit?: number;
    speech_to_speech_minutes_count?: number;
    speech_to_speech_minutes_limit?: number;
    products?: unknown;
    start_time?: unknown;
    end_time?: unknown;
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
    tag_handling_version?: unknown;
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
 * Type used during JSON parsing of a single entry of the /v3/languages API response.
 * @private
 */
interface LanguageApiResponseV3 {
    lang: string;
    name: string;
    usable_as_source: boolean;
    usable_as_target: boolean;
    status: string;
    features?: Record<string, unknown>;
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
    document_id?: unknown;
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
    public apiKeyCharacter?: UsageDetail;
    public speechToTextMinutes?: UsageDetail;
    public speechToSpeechMinutes?: UsageDetail;
    public products?: UsageProduct[];
    public startTime?: Date;
    public endTime?: Date;

    /**
     * @private Package users should not need to construct this class.
     */
    constructor(
        character?: UsageDetail,
        document?: UsageDetail,
        teamDocument?: UsageDetail,
        proUsage?: {
            apiKeyCharacter?: UsageDetail;
            speechToTextMinutes?: UsageDetail;
            speechToSpeechMinutes?: UsageDetail;
            products?: UsageProduct[];
            startTime?: Date;
            endTime?: Date;
        },
    ) {
        this.character = character;
        this.document = document;
        this.teamDocument = teamDocument;
        this.apiKeyCharacter = proUsage?.apiKeyCharacter;
        this.speechToTextMinutes = proUsage?.speechToTextMinutes;
        this.speechToSpeechMinutes = proUsage?.speechToSpeechMinutes;
        this.products = proUsage?.products;
        this.startTime = proUsage?.startTime;
        this.endTime = proUsage?.endTime;
    }

    /**
     * Returns true if the character, document or team document usage has reached or passed its
     * limit, otherwise false. Does not check apiKeyCharacter or the speech usage.
     */
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
    public documentId?: string;

    constructor(
        status: DocumentStatusCode,
        secondsRemaining?: number,
        billedCharacters?: number,
        errorMessage?: string,
        documentId?: string,
    ) {
        this.status = status;
        this.secondsRemaining = secondsRemaining;
        this.billedCharacters = billedCharacters;
        this.errorMessage = errorMessage;
        this.documentId = documentId;
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
 * Types used during JSON parsing of spoken terms API responses.
 * @private
 */
interface SpokenTermsListApiResponse {
    lang: string;
    entry_count: number;
}

interface SpokenTermsApiResponse {
    spoken_terms_id: string;
    name: string;
    creation_time: string;
    term_lists?: SpokenTermsListApiResponse[];
}

interface SpokenTermsEntriesApiResponse {
    lang: string;
    entries: string;
}

function parseRawSpokenTermsList(obj: SpokenTermsListApiResponse): SpokenTermsList {
    return { lang: obj.lang, entryCount: obj.entry_count };
}

function parseRawSpokenTerms(obj: SpokenTermsApiResponse): SpokenTerms {
    return {
        spokenTermsId: obj.spoken_terms_id,
        name: obj.name,
        creationTime: new Date(obj.creation_time),
        termLists: (obj.term_lists ?? []).map(parseRawSpokenTermsList),
    };
}

/**
 * Parses the given JSON response body and converts it with the given function. JSON syntax errors
 * and errors raised while reading fields (for example of a null or non-object body) are thrown as
 * DeepLError.
 * @private
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseResponse<T>(json: string, convert: (obj: any) => T): T {
    let obj: unknown;
    try {
        obj = JSON.parse(json);
    } catch (error) {
        throw new DeepLError(`Error parsing response JSON: ${error}`, error as Error);
    }
    try {
        return convert(obj);
    } catch (error) {
        if (error instanceof DeepLError) throw error;
        throw new DeepLError(`Error parsing response JSON: ${error}`, error as Error);
    }
}

/**
 * Parses the given JSON string to a SpokenTerms object.
 * @private
 */
export function parseSpokenTerms(json: string): SpokenTerms {
    return parseResponse(json, parseRawSpokenTerms);
}

/**
 * Parses the given list spoken terms JSON string to an array of SpokenTerms objects.
 * @private
 */
export function parseSpokenTermsArray(json: string): SpokenTerms[] {
    return parseResponse(json, (obj: { spoken_terms?: SpokenTermsApiResponse[] }) =>
        (obj.spoken_terms ?? []).map(parseRawSpokenTerms),
    );
}

/**
 * Parses the given JSON string to a SpokenTermsList object.
 * @private
 */
export function parseSpokenTermsList(json: string): SpokenTermsList {
    return parseResponse(json, parseRawSpokenTermsList);
}

/**
 * Parses the given JSON string to a SpokenTermsEntries object; the newline-separated
 * entries are split into terms, dropping empty lines.
 * @private
 */
export function parseSpokenTermsEntries(json: string): SpokenTermsEntries {
    return parseResponse(json, (obj: SpokenTermsEntriesApiResponse) => ({
        lang: obj.lang,
        entries: (obj.entries ?? '').split('\n').filter((term) => term.length > 0),
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

function parseOptionalString(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
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
            parseOptionalString(obj.document_id),
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
 * Like parseUsageDetail() for the API Pro fields; values that are not numbers are left out.
 * @private
 */
function parseProUsageDetail(
    obj: UsageApiResponse,
    prefix: 'api_key_character' | 'speech_to_text_minutes' | 'speech_to_speech_minutes',
): UsageDetail | undefined {
    const count = obj[`${prefix}_count`];
    const limit = obj[`${prefix}_limit`];
    if (typeof count !== 'number' || typeof limit !== 'number') return undefined;
    return new UsageDetailImpl(count, limit);
}

/**
 * Parses an ISO 8601 timestamp, returning undefined if it is missing or unparseable.
 * @private
 */
function parseOptionalDate(value: unknown): Date | undefined {
    if (typeof value !== 'string') return undefined;
    const date = new Date(value);
    return isNaN(date.getTime()) ? undefined : date;
}

/**
 * Parses the products array of the usage API response; missing or malformed values get defaults.
 * @private
 */
function parseUsageProducts(products: unknown): UsageProduct[] | undefined {
    if (!Array.isArray(products)) return undefined;
    const str = (value: unknown) => (typeof value === 'string' ? value : '');
    const num = (value: unknown) => (typeof value === 'number' ? value : 0);
    return products.map((product) => {
        const p = (product ?? {}) as Record<string, unknown>;
        return {
            productType: str(p.product_type),
            billingUnit: str(p.billing_unit),
            apiKeyUnitCount: num(p.api_key_unit_count),
            accountUnitCount: num(p.account_unit_count),
        };
    });
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
            {
                apiKeyCharacter: parseProUsageDetail(obj, 'api_key_character'),
                speechToTextMinutes: parseProUsageDetail(obj, 'speech_to_text_minutes'),
                speechToSpeechMinutes: parseProUsageDetail(obj, 'speech_to_speech_minutes'),
                products: parseUsageProducts(obj.products),
                startTime: parseOptionalDate(obj.start_time),
                endTime: parseOptionalDate(obj.end_time),
            },
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
                tagHandlingVersion: parseOptionalString(translation.tag_handling_version),
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
 * Parses the given /v3/languages API response entry to a Language object, restricted to the
 * source-language shape: no supportsFormality field, matching the historical /v2/languages
 * response when queried without `type=target`.
 * @private
 */
function parseSourceLanguageV3(lang: LanguageApiResponseV3): Language {
    try {
        return {
            name: lang.name,
            code: standardizeLanguageCode(lang.lang),
        };
    } catch (error) {
        throw new DeepLError(`Error parsing response JSON: ${error}`);
    }
}

/**
 * Parses the given /v3/languages API response entry to a Language object, restricted to the
 * target-language shape: always includes supportsFormality, matching the historical
 * /v2/languages response when queried with `type=target`.
 * @private
 */
function parseTargetLanguageV3(lang: LanguageApiResponseV3): Language {
    try {
        return {
            name: lang.name,
            code: standardizeLanguageCode(lang.lang),
            supportsFormality: 'formality' in (lang.features ?? {}),
        };
    } catch (error) {
        throw new DeepLError(`Error parsing response JSON: ${error}`);
    }
}

/**
 * Parses the given JSON string returned by `GET /v3/languages?resource=translate_text` to an
 * array of Language objects containing only the languages usable as a source language.
 * @private
 */
export function parseSourceLanguageArrayV3(json: string): Language[] {
    return parseResponse(json, (obj: LanguageApiResponseV3[]) =>
        obj.filter((lang) => lang.usable_as_source).map((lang) => parseSourceLanguageV3(lang)),
    );
}

/**
 * Parses the given JSON string returned by `GET /v3/languages?resource=translate_text` to an
 * array of Language objects containing only the languages usable as a target language.
 * @private
 */
export function parseTargetLanguageArrayV3(json: string): Language[] {
    return parseResponse(json, (obj: LanguageApiResponseV3[]) =>
        obj.filter((lang) => lang.usable_as_target).map((lang) => parseTargetLanguageV3(lang)),
    );
}

/**
 * Parses the given JSON string returned by `GET /v3/languages?resource=glossary` to an array of
 * GlossaryLanguagePair objects: the cross-product of languages usable as a glossary source
 * language and languages usable as a glossary target language, excluding self-pairs. Codes are
 * kept as returned by the API (lowercase), matching the historical
 * /v2/glossary-language-pairs response.
 * @private
 */
export function parseGlossaryLanguagePairArrayV3(json: string): GlossaryLanguagePair[] {
    try {
        const obj = JSON.parse(json) as LanguageApiResponseV3[];
        const sourceLangs = obj.filter((lang) => lang.usable_as_source).map((lang) => lang.lang);
        const targetLangs = obj.filter((lang) => lang.usable_as_target).map((lang) => lang.lang);
        const pairs: GlossaryLanguagePair[] = [];
        for (const sourceLang of sourceLangs) {
            for (const targetLang of targetLangs) {
                if (sourceLang === targetLang) continue;
                pairs.push({
                    sourceLang: sourceLang as SourceGlossaryLanguageCode,
                    targetLang: targetLang as TargetGlossaryLanguageCode,
                });
            }
        }
        return pairs;
    } catch (error) {
        throw new DeepLError(`Error parsing response JSON: ${error}`);
    }
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
function parseOptionalTimestamp(value?: string | null): Date | undefined {
    if (!value) {
        return undefined;
    }
    const date = new Date(value);
    return isNaN(date.getTime()) ? undefined : date;
}

/**
 * Types used during JSON parsing of style profile API responses. Every field is treated as
 * possibly missing or malformed.
 * @private
 */
interface StyleProfileApiResponse {
    style_profile_id?: string;
    name?: string;
    description?: unknown;
    industry?: unknown;
    glossary_ids?: unknown;
    style_rule_ids?: unknown;
    translation_memory_ids?: unknown;
    glossary_priority_order_enabled?: unknown;
    creation_time?: unknown;
    updated_time?: unknown;
}

function parseIdList(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
}

function parseRawStyleProfile(obj: StyleProfileApiResponse): StyleProfile {
    return {
        styleProfileId: obj.style_profile_id ?? '',
        name: obj.name ?? '',
        description: parseOptionalString(obj.description),
        industry: parseOptionalString(obj.industry),
        glossaryIds: parseIdList(obj.glossary_ids),
        styleRuleIds: parseIdList(obj.style_rule_ids),
        translationMemoryIds: parseIdList(obj.translation_memory_ids),
        glossaryPriorityOrderEnabled: obj.glossary_priority_order_enabled === true,
        creationTime: parseOptionalTimestamp(parseOptionalString(obj.creation_time)),
        updatedTime: parseOptionalTimestamp(parseOptionalString(obj.updated_time)),
    };
}

/**
 * Parses the given JSON string to a StyleProfile object.
 * @private
 */
export function parseStyleProfile(json: string): StyleProfile {
    return parseResponse(json, parseRawStyleProfile);
}

/**
 * Parses the given list style profiles JSON string to an array of StyleProfile objects,
 * skipping entries that are not objects.
 * @private
 */
export function parseStyleProfileList(json: string): StyleProfile[] {
    return parseResponse(json, (obj: { style_profiles?: unknown } | null) => {
        const list = obj?.style_profiles;
        if (!Array.isArray(list)) {
            return [];
        }
        return list
            .filter((item) => typeof item === 'object' && item !== null && !Array.isArray(item))
            .map((item) => parseRawStyleProfile(item as StyleProfileApiResponse));
    });
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

/**
 * Parses the given JSON string to an array of LanguageResource objects.
 * @private
 */
export function parseLanguageResourceList(json: string): LanguageResource[] {
    try {
        const obj = JSON.parse(json) as LanguageResourceApiResponse[];
        return obj.map((resource) => {
            const features: Record<string, ResourceFeature> = {};
            for (const feature of resource.features ?? []) {
                features[feature.name] = {
                    name: feature.name,
                    needsSourceSupport: feature.needs_source_support,
                    needsTargetSupport: feature.needs_target_support,
                };
            }
            return { name: resource.name, features };
        });
    } catch (error) {
        throw new DeepLError(`Error parsing response JSON: ${error}`);
    }
}

/**
 * Parses the given JSON string returned by `GET /v3/languages` to an array of LanguageSupport
 * objects. Language codes are kept as returned by the API.
 * @private
 */
export function parseLanguageSupportList(json: string): LanguageSupport[] {
    try {
        const obj = JSON.parse(json) as LanguageApiResponseV3[];
        return obj.map((lang) => {
            const features: Record<string, LanguageFeature> = {};
            for (const [name, feature] of Object.entries(lang.features ?? {})) {
                features[name] = { status: (feature as { status: string }).status };
            }
            return {
                code: lang.lang,
                name: lang.name,
                status: lang.status,
                usableAsSource: lang.usable_as_source,
                usableAsTarget: lang.usable_as_target,
                features,
            };
        });
    } catch (error) {
        throw new DeepLError(`Error parsing response JSON: ${error}`);
    }
}

/**
 * Types used during JSON parsing of Admin API responses.
 * @private
 */
interface DeveloperKeyApiResponse {
    key_id?: string;
    label?: string;
    creation_time?: string;
    deactivated_time?: string | null;
    is_deactivated?: boolean;
    usage_limits?: {
        characters?: number | null;
        speech_to_text_milliseconds?: number | null;
        speech_to_speech_milliseconds?: number | null;
    };
}

interface AdminUsageBreakdownApiResponse {
    total_characters?: number;
    text_translation_characters?: number;
    document_translation_characters?: number;
    text_improvement_characters?: number;
    speech_to_text_minutes?: number;
    speech_to_speech_minutes?: number;
}

interface KeyUsageApiResponse {
    api_key?: string;
    api_key_label?: string;
    usage_date?: string;
    usage?: AdminUsageBreakdownApiResponse;
}

interface AdminUsageReportApiResponse {
    usage_report?: {
        total_usage?: AdminUsageBreakdownApiResponse;
        start_date?: string;
        end_date?: string;
        group_by?: string;
        key_usages?: KeyUsageApiResponse[];
        key_and_day_usages?: KeyUsageApiResponse[];
    };
}

interface CustomTagUsageBreakdownApiResponse {
    total_characters?: number;
    text_translation_characters?: number;
    text_improvement_characters?: number;
    speech_to_text_minutes?: number;
    speech_to_speech_minutes?: number;
}

interface CustomTagUsageApiResponse {
    custom_tag?: string;
    usage_date?: string;
    breakdown?: CustomTagUsageBreakdownApiResponse;
}

interface CustomTagUsageReportApiResponse {
    custom_tag_usage_report?: {
        aggregate_by?: string;
        start_date?: string;
        end_date?: string;
        next_page?: number | null;
        usage?: CustomTagUsageApiResponse[];
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function recordList<T>(value: unknown): T[] {
    return Array.isArray(value) ? (value.filter(isRecord) as T[]) : [];
}

function numberOr<T extends number | null>(value: unknown, fallback: T): number | T {
    return typeof value === 'number' && isFinite(value) ? value : fallback;
}

function stringOr(value: unknown, fallback: string): string {
    return isString(value) ? value : fallback;
}

/**
 * Parses an optional Admin API timestamp, treating timestamps without a time zone as UTC.
 * @private
 */
function parseOptionalUtcTimestamp(value?: unknown): Date | undefined {
    if (!isString(value)) {
        return undefined;
    }
    if (/T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(value)) {
        return parseOptionalTimestamp(`${value}Z`);
    }
    return parseOptionalTimestamp(value);
}

function parseRawDeveloperKey(value: unknown): DeveloperKey | undefined {
    if (!isRecord(value)) {
        return undefined;
    }
    const obj = value as DeveloperKeyApiResponse;
    if (!isString(obj.key_id) || obj.key_id.length === 0) {
        return undefined;
    }
    const limits = isRecord(obj.usage_limits) ? obj.usage_limits : undefined;
    return {
        keyId: obj.key_id,
        label: stringOr(obj.label, ''),
        creationTime: parseOptionalUtcTimestamp(obj.creation_time),
        deactivatedTime: parseOptionalUtcTimestamp(obj.deactivated_time),
        isDeactivated: obj.is_deactivated === true,
        usageLimits: {
            characters: numberOr(limits?.characters, null),
            speechToTextMilliseconds: numberOr(limits?.speech_to_text_milliseconds, null),
            speechToSpeechMilliseconds: numberOr(limits?.speech_to_speech_milliseconds, null),
        },
    };
}

/**
 * Parses the given JSON string to a DeveloperKey object.
 * @private
 */
export function parseDeveloperKey(json: string): DeveloperKey {
    let parsed: unknown;
    try {
        parsed = JSON.parse(json);
    } catch (error) {
        throw new DeepLError(`Error parsing response JSON: ${error}`);
    }
    const key = parseRawDeveloperKey(parsed);
    if (key === undefined) {
        throw new DeepLError('Developer key response is missing key_id');
    }
    return key;
}

/**
 * Parses the given JSON string to an array of DeveloperKey objects.
 * @private
 */
export function parseDeveloperKeyList(json: string): DeveloperKey[] {
    let parsed: unknown;
    try {
        parsed = JSON.parse(json);
    } catch (error) {
        throw new DeepLError(`Error parsing response JSON: ${error}`);
    }
    if (!Array.isArray(parsed)) {
        throw new DeepLError('Developer keys response is not a list');
    }
    return parsed.map(parseRawDeveloperKey).filter((key): key is DeveloperKey => key !== undefined);
}

function parseAdminUsageBreakdown(obj?: AdminUsageBreakdownApiResponse): AdminUsageBreakdown {
    const b = isRecord(obj) ? obj : undefined;
    return {
        totalCharacters: numberOr(b?.total_characters, 0),
        textTranslationCharacters: numberOr(b?.text_translation_characters, 0),
        documentTranslationCharacters: numberOr(b?.document_translation_characters, 0),
        textImprovementCharacters: numberOr(b?.text_improvement_characters, 0),
        speechToTextMinutes: numberOr(b?.speech_to_text_minutes, 0),
        speechToSpeechMinutes: numberOr(b?.speech_to_speech_minutes, 0),
    };
}

function parseKeyUsage(obj: KeyUsageApiResponse): KeyUsage {
    return {
        apiKey: stringOr(obj.api_key, ''),
        apiKeyLabel: stringOr(obj.api_key_label, ''),
        usage: parseAdminUsageBreakdown(obj.usage),
        usageDate: parseOptionalUtcTimestamp(obj.usage_date),
    };
}

/**
 * Parses the given JSON string to an AdminUsageReport object.
 * @private
 */
export function parseAdminUsageReport(json: string): AdminUsageReport {
    try {
        const top: unknown = JSON.parse(json);
        if (!isRecord(top)) {
            throw new DeepLError('Usage analytics response is not a JSON object');
        }
        const parsed = (top as AdminUsageReportApiResponse).usage_report;
        const report: NonNullable<AdminUsageReportApiResponse['usage_report']> = isRecord(parsed)
            ? parsed
            : {};
        return {
            totalUsage: parseAdminUsageBreakdown(report.total_usage),
            startDate: parseOptionalUtcTimestamp(report.start_date),
            endDate: parseOptionalUtcTimestamp(report.end_date),
            groupBy: isString(report.group_by) ? report.group_by : undefined,
            keyUsages: recordList<KeyUsageApiResponse>(report.key_usages).map(parseKeyUsage),
            keyAndDayUsages: recordList<KeyUsageApiResponse>(report.key_and_day_usages).map(
                parseKeyUsage,
            ),
        };
    } catch (error) {
        if (error instanceof DeepLError) {
            throw error;
        }
        throw new DeepLError(`Error parsing response JSON: ${error}`);
    }
}

function parseCustomTagUsageBreakdown(
    obj?: CustomTagUsageBreakdownApiResponse,
): CustomTagUsageBreakdown {
    const b = isRecord(obj) ? obj : undefined;
    return {
        totalCharacters: numberOr(b?.total_characters, 0),
        textTranslationCharacters: numberOr(b?.text_translation_characters, 0),
        textImprovementCharacters: numberOr(b?.text_improvement_characters, 0),
        speechToTextMinutes: numberOr(b?.speech_to_text_minutes, 0),
        speechToSpeechMinutes: numberOr(b?.speech_to_speech_minutes, 0),
    };
}

function parseCustomTagUsage(obj: CustomTagUsageApiResponse): CustomTagUsage {
    return {
        customTag: stringOr(obj.custom_tag, ''),
        breakdown: parseCustomTagUsageBreakdown(obj.breakdown),
        usageDate: parseOptionalUtcTimestamp(obj.usage_date),
    };
}

/**
 * Parses the given JSON string to a CustomTagUsageReport object.
 * @private
 */
export function parseCustomTagUsageReport(json: string): CustomTagUsageReport {
    try {
        const top: unknown = JSON.parse(json);
        if (!isRecord(top)) {
            throw new DeepLError('Usage analytics response is not a JSON object');
        }
        const parsed = (top as CustomTagUsageReportApiResponse).custom_tag_usage_report;
        const report: NonNullable<CustomTagUsageReportApiResponse['custom_tag_usage_report']> =
            isRecord(parsed) ? parsed : {};
        return {
            aggregateBy: isString(report.aggregate_by) ? report.aggregate_by : undefined,
            startDate: parseOptionalUtcTimestamp(report.start_date),
            endDate: parseOptionalUtcTimestamp(report.end_date),
            nextPage: typeof report.next_page === 'number' ? report.next_page : undefined,
            usage: recordList<CustomTagUsageApiResponse>(report.usage).map(parseCustomTagUsage),
        };
    } catch (error) {
        if (error instanceof DeepLError) {
            throw error;
        }
        throw new DeepLError(`Error parsing response JSON: ${error}`);
    }
}
