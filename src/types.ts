// Copyright 2022 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import { GlossaryEntries } from './glossaryEntries';

/**
 * Optional proxy configuration, may be specified as proxy in TranslatorOptions.
 * @see TranslatorOptions.proxy
 */
export interface ProxyConfig {
    host: string;
    port: number;
    auth?: {
        username: string;
        password: string;
    };
    protocol?: string;
}

/**
 * Optional identifier for the app that is using this library, may be specified
 * as appInfo in TranslatorOptions.
 * @see TranslatorOptions.appInfo
 */
export interface AppInfo {
    appName: string;
    appVersion: string;
}

/**
 * Options that can be specified when constructing a Translator.
 */
export interface TranslatorOptions {
    /**
     * Base URL of DeepL API, can be overridden for example for testing purposes. By default, the
     * correct DeepL API URL is selected based on the user account type (free or paid).
     */
    serverUrl?: string;

    /**
     * HTTP headers attached to every HTTP request. By default, no extra headers are used. Note that
     * during Translator initialization headers for Authorization and User-Agent are added, unless
     * they are overridden in this option.
     */
    headers?: Record<string, string>;

    /**
     * The maximum number of failed attempts that Translator will retry, per request. By default, 5
     * retries are made. Note: only errors due to transient conditions are retried.
     */
    maxRetries?: number;

    /**
     * Connection timeout used for each HTTP request retry, in milliseconds. The default timeout
     * if this value is unspecified is 10 seconds (10000).
     */
    minTimeout?: number;

    /**
     * Define the host, port and protocol of the proxy server.
     */
    proxy?: ProxyConfig;

    /**
     * Define if the library is allowed to send more detailed information about which platform
     * it is running on with each API call. Defaults to true if undefined. Overriden by
     * the `customUserAgent` option.
     */
    sendPlatformInfo?: boolean;

    /**
     * Identifies the application using this client library, will be sent in the `User-Agent` header
     */
    appInfo?: AppInfo;
}

/**
 * Options that can be specified when constructing a DeepLClient.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface DeepLClientOptions extends TranslatorOptions {}

export type Formality = 'less' | 'more' | 'default' | 'prefer_less' | 'prefer_more';
export type SentenceSplittingMode = 'off' | 'on' | 'nonewlines' | 'default';
export type TagHandlingMode = 'html' | 'xml';
export type TagHandlingVersion = 'v1' | 'v2';
export type ModelType = 'quality_optimized' | 'latency_optimized' | 'prefer_quality_optimized';
export type GlossaryId = string;
export type StyleId = string;
export type TranslationMemoryId = string;
export type TagList = string | string[];

/**
 * Extra request parameters to be passed with translation requests.
 */
export type RequestParameters = Record<string, string>;

/**
 * Base options that apply to all translation endpoints. Planned to be extended to other endpoints in future.
 */
export interface BaseRequestOptions {
    /**
     * Extra parameters to be added to the request body.
     * Keys in this object will be added to the request body, and can override built-in parameters.
     * This is mostly used by DeepL employees to test functionality, or for beta programs.
     */
    extraRequestParameters?: RequestParameters;
}

/**
 * Information about a glossary, excluding the entry list. {@link GlossaryInfo} is compatible with the
 * /v2 glossary endpoints and can only support mono-lingual glossaries (e.g. a glossary with only one source and
 * target language defined).
 */
export interface GlossaryInfo {
    /** Unique ID assigned to the glossary. */
    readonly glossaryId: GlossaryId;
    /** User-defined name assigned to the glossary. */
    readonly name: string;
    /** Indicates whether the glossary may be used for translations. */
    readonly ready: boolean;
    /** Language code of the glossary source terms. */
    readonly sourceLang: SourceGlossaryLanguageCode;
    /** Language code of the glossary target terms. */
    readonly targetLang: TargetGlossaryLanguageCode;
    /** Time when the glossary was created. */
    readonly creationTime: Date;
    /** The number of entries contained in the glossary. */
    readonly entryCount: number;
}

/**
 * Options that can be specified when translating text.
 */
export interface TranslateTextOptions extends BaseRequestOptions {
    /**
     * Specifies how input translation text should be split into sentences.
     * - 'on': Input translation text will be split into sentences using both newlines and
     *   punctuation, this is the default behaviour.
     * - 'off': Input translation text will not be split into sentences. This is advisable for
     *   applications where each input translation text is only one sentence.
     * - 'nonewlines': Input translation text will be split into sentences using only punctuation
     *   but not newlines.
     */
    splitSentences?: SentenceSplittingMode;

    /** Set to true to prevent the translation engine from correcting some formatting aspects, and
     * instead leave the formatting unchanged, default is false. */
    preserveFormatting?: boolean;

    /** Controls whether translations should lean toward formal or informal language. */
    formality?: Formality;

    /** Specifies the ID of a glossary to use with translation. Or
     * using the given v2 glossary or given multilingual glossary.
     *
     * Cannot be combined with `glossaryIds`.
     */
    glossary?: GlossaryId | GlossaryInfo | MultilingualGlossaryInfo;

    /** Specifies the IDs of up to 5 glossaries to use with translation. Glossaries
     * are applied in the order given, with the first matching term taking
     * precedence. Accepts glossary ID strings, GlossaryInfo, or
     * MultilingualGlossaryInfo objects (the `.glossaryId` is extracted).
     *
     * Requires `sourceLang` to be set. Cannot be combined with the singular
     * `glossary` option.
     */
    glossaryIds?: Array<GlossaryId | GlossaryInfo | MultilingualGlossaryInfo>;

    /** Specifies the ID of a style rule to use with translation, or
     * a StyleRuleInfo object as returned by getAllStyleRules().
     */
    styleRule?: StyleId | StyleRuleInfo;

    /** Specifies the ID of a translation memory to use with translation, or
     * a TranslationMemoryInfo object as returned by listTranslationMemories().
     */
    translationMemory?: TranslationMemoryId | TranslationMemoryInfo;

    /** Specifies the minimum similarity threshold (0 to 100) for translation memory matches. */
    translationMemoryThreshold?: number;

    /** Type of tags to parse before translation, options are 'html' and 'xml'. */
    tagHandling?: TagHandlingMode;

    /** Version of tag handling to use, options are 'v1' and 'v2'. */
    tagHandlingVersion?: TagHandlingVersion;

    /** Set to false to disable automatic tag detection, default is true. */
    outlineDetection?: boolean;

    /** Specifies additional context to influence translations, that is not
     * translated itself. Characters in the `context` parameter are not counted
     * toward billing.
     * See the API documentation for more information and example usage. */
    context?: string;

    /** Type of translation model to use. */
    modelType?: ModelType;

    /** List of XML tags that should be used to split text into sentences. */
    splittingTags?: TagList;

    /** List of XML tags that should not be used to split text into sentences. */
    nonSplittingTags?: TagList;

    /** List of XML tags containing content that should not be translated. */
    ignoreTags?: TagList;

    /**
     * List of custom instructions to guide the translation. Maximum 10 instructions,
     * each with a maximum length of 300 characters.
     */
    customInstructions?: string[];

    /** (internal only) Override path to send translate request to. */
    __path?: string;
}

/**
 * Options that can be specified when translating documents.
 */
export interface DocumentTranslateOptions extends BaseRequestOptions {
    /** Controls whether translations should lean toward formal or informal language. */
    formality?: Formality;

    /** Specifies the ID of a glossary to use with translation. Or
     * using the given v2 glossary or given multilingual glossary.
     *
     * Cannot be combined with `glossaryIds`.
     */
    glossary?: GlossaryId | GlossaryInfo | MultilingualGlossaryInfo;

    /** Specifies the IDs of up to 5 glossaries to use with translation. Glossaries
     * are applied in the order given, with the first matching term taking
     * precedence. Accepts glossary ID strings, GlossaryInfo, or
     * MultilingualGlossaryInfo objects (the `.glossaryId` is extracted).
     *
     * Requires `sourceLang` to be set. Cannot be combined with the singular
     * `glossary` option.
     */
    glossaryIds?: Array<GlossaryId | GlossaryInfo | MultilingualGlossaryInfo>;

    /** Specifies the ID of a style rule to use with translation, or
     * a StyleRuleInfo object as returned by getAllStyleRules().
     */
    styleRule?: StyleId | StyleRuleInfo;

    /** Specifies the ID of a translation memory to use with translation, or
     * a TranslationMemoryInfo object as returned by listTranslationMemories().
     */
    translationMemory?: TranslationMemoryId | TranslationMemoryInfo;

    /** Specifies the minimum similarity threshold (0 to 100) for translation memory matches. */
    translationMemoryThreshold?: number;

    /** Filename including extension, only required when translating documents as streams. */
    filename?: string;

    /** Controls whether to use Document Minification for translation, if available. */
    enableDocumentMinification?: boolean;
}

/**
 * Language codes that may be used as a source or target language.
 * Note: although the language code type definitions are case-sensitive, this package and the DeepL
 * API accept case-insensitive language codes.
 */
type CommonLanguageCode =
    | 'ace'
    | 'af'
    | 'an'
    | 'ar'
    | 'as'
    | 'ay'
    | 'az'
    | 'ba'
    | 'be'
    | 'bg'
    | 'bho'
    | 'bn'
    | 'br'
    | 'bs'
    | 'ca'
    | 'ceb'
    | 'ckb'
    | 'cs'
    | 'cy'
    | 'da'
    | 'de'
    | 'el'
    | 'eo'
    | 'es'
    | 'et'
    | 'eu'
    | 'fa'
    | 'fi'
    | 'fr'
    | 'ga'
    | 'gl'
    | 'gn'
    | 'gom'
    | 'gu'
    | 'ha'
    | 'he'
    | 'hi'
    | 'hr'
    | 'ht'
    | 'hu'
    | 'hy'
    | 'id'
    | 'ig'
    | 'is'
    | 'it'
    | 'ja'
    | 'jv'
    | 'ka'
    | 'kk'
    | 'kmr'
    | 'ko'
    | 'ky'
    | 'la'
    | 'lb'
    | 'lmo'
    | 'ln'
    | 'lt'
    | 'lv'
    | 'mai'
    | 'mg'
    | 'mi'
    | 'mk'
    | 'ml'
    | 'mn'
    | 'mr'
    | 'ms'
    | 'mt'
    | 'my'
    | 'nb'
    | 'ne'
    | 'nl'
    | 'oc'
    | 'om'
    | 'pa'
    | 'pag'
    | 'pam'
    | 'pl'
    | 'prs'
    | 'ps'
    | 'qu'
    | 'ro'
    | 'ru'
    | 'sa'
    | 'scn'
    | 'sk'
    | 'sl'
    | 'sq'
    | 'sr'
    | 'st'
    | 'su'
    | 'sv'
    | 'sw'
    | 'ta'
    | 'te'
    | 'tg'
    | 'th'
    | 'tk'
    | 'tl'
    | 'tn'
    | 'tr'
    | 'ts'
    | 'tt'
    | 'uk'
    | 'ur'
    | 'uz'
    | 'vi'
    | 'wo'
    | 'xh'
    | 'yi'
    | 'yue'
    | 'zh'
    | 'zu';

/**
 * Language codes that may be used as a source language.
 * Note: although the language code type definitions are case-sensitive, this package and the DeepL
 * API accept case-insensitive language codes.
 */
export type SourceLanguageCode = CommonLanguageCode | 'en' | 'pt';

/**
 * Language codes that may be used as a target language.
 * Note: although the language code type definitions are case-sensitive, this package and the DeepL
 * API accept case-insensitive language codes.
 */
export type TargetLanguageCode =
    | CommonLanguageCode
    | 'en-GB'
    | 'en-US'
    | 'es-419'
    | 'pt-BR'
    | 'pt-PT'
    | 'zh-HANS'
    | 'zh-HANT';

/**
 * All language codes, including source-only and target-only language codes.
 * Note: although the language code type definitions are case-sensitive, this package and the DeepL
 * API accept case-insensitive language codes.
 */
export type LanguageCode = SourceLanguageCode | TargetLanguageCode;

/**
 * Language codes that do not include a regional variant, for example 'en' is included, but 'en-US'
 * is not.
 */
export type NonRegionalLanguageCode = CommonLanguageCode | 'en' | 'pt';

/**
 * Language codes that may be used as a source language for glossaries.
 * Note: although the language code type definitions are case-sensitive, this package and the DeepL
 * API accept case-insensitive language codes.
 */
export type SourceGlossaryLanguageCode =
    | 'ar'
    | 'bg'
    | 'cs'
    | 'da'
    | 'de'
    | 'el'
    | 'en'
    | 'es'
    | 'et'
    | 'fi'
    | 'fr'
    | 'he'
    | 'hu'
    | 'id'
    | 'it'
    | 'ja'
    | 'ko'
    | 'lt'
    | 'lv'
    | 'nb'
    | 'nl'
    | 'pl'
    | 'pt'
    | 'ro'
    | 'ru'
    | 'sk'
    | 'sl'
    | 'sv'
    | 'tr'
    | 'uk'
    | 'vi'
    | 'zh';

/**
 * Language codes that may be used as a target language for glossaries.
 * Note: although the language code type definitions are case-sensitive, this package and the DeepL
 * API accept case-insensitive language codes.
 */
export type TargetGlossaryLanguageCode = SourceGlossaryLanguageCode;

/**
 * Information about the API usage: how much has been translated in this billing period, and the
 * maximum allowable amount.
 *
 * Depending on the account type, different usage types are included: the character, document and
 * teamDocument fields provide details about each corresponding usage type, allowing each usage type
 * to be checked individually. The anyLimitReached() function checks if any usage type is exceeded.
 */
export interface Usage {
    /** Usage details for characters, for example due to the translateText() function. */
    readonly character?: UsageDetail;
    /** Usage details for documents. */
    readonly document?: UsageDetail;
    /** Usage details for documents shared among your team. */
    readonly teamDocument?: UsageDetail;

    /** Returns true if any usage type limit has been reached or passed, otherwise false. */
    anyLimitReached(): boolean;

    /** Converts the usage details to a human-readable string. */
    toString(): string;
}

/**
 * Stores the count and limit for one usage type.
 */
export interface UsageDetail {
    /** The amount used of this usage type. */
    readonly count: number;
    /** The maximum allowable amount for this usage type. */
    readonly limit: number;

    /**
     * Returns true if the amount used has already reached or passed the allowable amount.
     */
    limitReached(): boolean;
}

/**
 * Information about a language supported by DeepL translator.
 */
export interface Language {
    /** Name of the language in English. */
    readonly name: string;
    /**
     * Language code according to ISO 639-1, for example 'en'. Some target languages also include
     * the regional variant according to ISO 3166-1, for example 'en-US'.
     */
    readonly code: LanguageCode;
    /**
     * Only defined for target languages. If defined, specifies whether the formality option is
     * available for this target language.
     */
    readonly supportsFormality?: boolean;
}

/**
 * Information about a glossary dictionary, excluding the entry list. Is compatible with
 * the /v3 glossary endpoints and supports multi-lingual glossaries compared to the v2 version.
 * Glossaries now have multiple glossary dictionaries each with their own source language, target
 * language and entries.
 */
export interface MultilingualGlossaryDictionaryInfo {
    /** Language code of the glossary dictionary source terms. */
    readonly sourceLangCode: string;
    /** Language code of the glossary dictionary target terms. */
    readonly targetLangCode: string;
    /** The number of entries contained in the glossary dictionary. */
    readonly entryCount: number;
}

/**
 * Information about a multilingual glossary, excluding the entry list.
 */
export interface MultilingualGlossaryInfo {
    /** ID of the associated glossary. */
    readonly glossaryId: string;
    /** Name of the glossary chosen during creation. */
    readonly name: string;
    /** The dictionaries of the glossary. */
    readonly dictionaries: MultilingualGlossaryDictionaryInfo[];
    /** Time when the glossary was created. */
    readonly creationTime: Date;
}

/**
 * Information about a glossary dictionary, including the entry list
 */
export interface MultilingualGlossaryDictionaryEntries {
    /** Language code of the glossary dictionary source terms. */
    readonly sourceLangCode: string;
    /** Language code of the glossary dictionary target terms. */
    readonly targetLangCode: string;
    /** The entries in the glossary dictionary. */
    readonly entries: GlossaryEntries;
}

/**
 * Information about a pair of languages supported for DeepL glossaries.
 */
export interface GlossaryLanguagePair {
    /**
     * The code of the source language.
     */
    readonly sourceLang: SourceGlossaryLanguageCode;
    /**
     * The code of the target language.
     */
    readonly targetLang: TargetGlossaryLanguageCode;
}

/**
 * Handle to an in-progress document translation.
 */
export interface DocumentHandle {
    /**
     * ID of associated document request.
     */
    readonly documentId: string;

    /**
     * Key of associated document request.
     */
    readonly documentKey: string;
}

export type DocumentStatusCode = 'queued' | 'translating' | 'error' | 'done';

/**
 * Status of a document translation request.
 */
export interface DocumentStatus {
    /**
     * One of the status values defined in DocumentStatusCode.
     * @see DocumentStatusCode
     */
    readonly status: DocumentStatusCode;

    /**
     * Estimated time until document translation completes in seconds, otherwise undefined if
     * unknown.
     */
    readonly secondsRemaining?: number;

    /**
     * Number of characters billed for this document, or undefined if unknown or before translation
     * is complete.
     */
    readonly billedCharacters?: number;

    /**
     * A short description of the error, or undefined if no error has occurred.
     */
    readonly errorMessage?: string;

    /**
     * True if no error has occurred, otherwise false. Note that while the document translation is
     * in progress, this returns true.
     */
    ok(): boolean;

    /**
     * True if the document translation completed successfully, otherwise false.
     */
    done(): boolean;
}

/**
 * Holds the result of a text translation request.
 */
export interface TextResult {
    /**
     * String containing the translated text.
     */
    readonly text: string;

    /**
     * Language code of the detected source language.
     */
    readonly detectedSourceLang: SourceLanguageCode;

    /**
     * Number of characters billed for this text.
     */
    readonly billedCharacters: number;

    /**
     * The translation model type used, if available.
     */
    readonly modelTypeUsed?: string;
}

/**
 * Holds the result of a text rephrasing request.
 */
export interface WriteResult {
    /**
     * String containing the improved text.
     */
    readonly text: string;

    /**
     * Language code of the detected source language.
     */
    readonly detectedSourceLang: SourceLanguageCode;

    /**
     * Language code of the target language from the request.
     */
    readonly targetLang: string;
}

/**
 * Type used during JSON parsing of API response for getting multilingual glossary dictionary entries.
 * @private
 */
export interface MultilingualGlossaryDictionaryEntriesApiResponse {
    dictionaries: [
        {
            source_lang: string;
            target_lang: string;
            entries: string;
        },
    ];
}

/**
 * Type used during JSON parsing of API response for multilingual glossary dictionaries.
 * @private
 */
export interface MultilingualGlossaryDictionaryApiResponse {
    source_lang: string;
    target_lang: string;
    entry_count: number;
}

/**
 * Type used during JSON parsing of API response for listing multilingual glossaries.
 * @private
 */
export interface ListMultilingualGlossaryApiResponse {
    glossaries: [
        {
            glossary_id: string;
            name: string;
            dictionaries: MultilingualGlossaryDictionaryApiResponse[];
            creation_time: string;
        },
    ];
}

/**
 * Custom instruction for a style rule.
 */
export interface CustomInstruction {
    /** Unique ID of the custom instruction (present in API responses). */
    readonly id?: string;
    /** Label for the custom instruction. */
    readonly label: string;
    /** Prompt text for the custom instruction. */
    readonly prompt: string;
    /** Optional source language code for the custom instruction. */
    readonly sourceLanguage?: string;
}

/**
 * Configuration rules for a style rule list.
 */
export interface ConfiguredRules {
    /** Date and time formatting rules. */
    readonly datesAndTimes?: Record<string, string>;
    /** Text formatting rules. */
    readonly formatting?: Record<string, string>;
    /** Number formatting rules. */
    readonly numbers?: Record<string, string>;
    /** Punctuation rules. */
    readonly punctuation?: Record<string, string>;
    /** Spelling and grammar rules. */
    readonly spellingAndGrammar?: Record<string, string>;
    /** Style and tone rules. */
    readonly styleAndTone?: Record<string, string>;
    /** Vocabulary rules. */
    readonly vocabulary?: Record<string, string>;
}

/**
 * Information about a style rule list.
 */
export interface StyleRuleInfo {
    /** Unique ID assigned to the style rule list. */
    readonly styleId: StyleId;
    /** User-defined name assigned to the style rule list. */
    readonly name: string;
    /** Time when the style rule list was created. */
    readonly creationTime: Date;
    /** Time when the style rule list was last updated. */
    readonly updatedTime: Date;
    /** Language code for the style rule list. */
    readonly language: string;
    /** Version number of the style rule list. */
    readonly version: number;
    /** The predefined rules that have been enabled. */
    readonly configuredRules?: ConfiguredRules;
    /** Optional list of custom instructions. */
    readonly customInstructions?: CustomInstruction[];
}

/**
 * Type used during JSON parsing of API response for style rule info.
 * @private
 */
export interface StyleRuleInfoApiResponse {
    style_id: string;
    name: string;
    creation_time: string;
    updated_time: string;
    language: string;
    version: number;
    configured_rules?: {
        dates_and_times?: Record<string, string>;
        formatting?: Record<string, string>;
        numbers?: Record<string, string>;
        punctuation?: Record<string, string>;
        spelling_and_grammar?: Record<string, string>;
        style_and_tone?: Record<string, string>;
        vocabulary?: Record<string, string>;
    };
    custom_instructions?: Array<{
        id?: string;
        label: string;
        prompt: string;
        source_language?: string;
    }>;
}

/**
 * Type used during JSON parsing of API response for listing style rules.
 * @private
 */
export interface ListStyleRuleApiResponse {
    style_rules: StyleRuleInfoApiResponse[];
}

/**
 * Information about a translation memory.
 */
export interface TranslationMemoryInfo {
    readonly translationMemoryId: TranslationMemoryId;
    readonly name: string;
    readonly sourceLanguage: string;
    readonly targetLanguages: string[];
    readonly segmentCount: number;
    /** Undefined if the API did not provide the timestamp. */
    readonly creationTime?: Date;
    /** Undefined if the API did not provide the timestamp. */
    readonly updatedTime?: Date;
}

/**
 * Type used during JSON parsing of API response for translation memory info.
 * @private
 */
export interface TranslationMemoryInfoApiResponse {
    translation_memory_id: string;
    name: string;
    source_language: string;
    target_languages: string[];
    segment_count: number;
    creation_time?: string;
    updated_time?: string;
}

/**
 * Type used during JSON parsing of API response for listing translation memories.
 * @private
 */
export interface ListTranslationMemoryApiResponse {
    translation_memories: TranslationMemoryInfoApiResponse[];
}

/**
 * A target-language translation attached to a translation memory source segment.
 */
export interface TranslationMemoryTargetSegment {
    readonly targetSegmentId: string;
    readonly targetLanguage: string;
    readonly targetText: string;
    readonly creationTime?: Date;
    readonly updatedTime?: Date;
    readonly lastUsedTime?: Date;
}

/**
 * A source segment of a translation memory and its translations.
 */
export interface TranslationMemorySegment {
    readonly sourceSegmentId: string;
    readonly sourceText: string;
    readonly targets: TranslationMemoryTargetSegment[];
    readonly creationTime?: Date;
    readonly updatedTime?: Date;
    readonly lastUsedTime?: Date;
}

/**
 * One page of translation memory segments.
 */
export interface TranslationMemorySegments {
    readonly segments: TranslationMemorySegment[];
    /**
     * Total number of segments stored in the translation memory. This is translation-memory-level
     * metadata and is not reduced by filterText.
     */
    readonly segmentCount: number;
    /**
     * Opaque cursor to pass as pageCursor to fetch the next page, or undefined on the last page.
     */
    readonly nextPageCursor?: string;
}

/**
 * Options for listing the segments of a translation memory.
 */
export interface TranslationMemorySegmentsOptions {
    /** Maximum segments per page (1-100, defaults to 50). */
    pageSize?: number;
    /** Cursor from a previous response; omit on the first call. */
    pageCursor?: string;
    /** Substring filter across source and target text, at least 2 characters. */
    filterText?: string;
    /** Whether filterText is case-sensitive, defaults to false. */
    filterCaseSensitive?: boolean;
}

/**
 * A newly created translation memory import job. The TMX file must be uploaded to uploadUrl before
 * expiresAt; processing starts automatically once the upload is detected.
 */
export interface TranslationMemoryImport {
    readonly jobId: string;
    readonly uploadUrl: string;
    readonly expiresAt?: Date;
}

/**
 * A translation memory export job.
 */
export interface TranslationMemoryExport {
    readonly jobId: string;
    readonly translationMemoryId?: string;
    /** True if the API reused a previously completed export instead of starting a new one. */
    readonly reusedExisting: boolean;
}

/**
 * Status of a translation memory import or export job, one of 'awaiting_input', 'processing',
 * 'completed', 'downloaded', 'failed' or 'expired'.
 */
export type TranslationMemoryJobStatus =
    | 'awaiting_input'
    | 'processing'
    | 'completed'
    | 'downloaded'
    | 'failed'
    | 'expired';

/**
 * The outcome of a translation memory import or export job.
 */
export interface TranslationMemoryJobResult {
    readonly status: TranslationMemoryJobStatus;
    /** Human-readable action the caller must take, set while the job waits on the caller. */
    readonly requiredAction?: string;
    /** Download URL of the exported TMX file, set once an export completes. */
    readonly downloadUrl?: string;
    readonly expiresAt?: Date;
    /** Error description, set when the job failed. */
    readonly errorMessage?: string;
    /** ID of the translation memory created by a completed import. */
    readonly translationMemoryId?: string;
    /** Number of segments an import skipped. */
    readonly skippedSegmentCount?: number;
}

/**
 * Status of a translation memory import or export job.
 */
export interface TranslationMemoryJob {
    readonly jobId: string;
    readonly operation: 'import' | 'export';
    readonly product: string;
    /** Results of the job; the API returns exactly one. */
    readonly results: TranslationMemoryJobResult[];
    readonly creationTime?: Date;
    readonly updatedTime?: Date;
    /** Translation memory an export job reads from. */
    readonly translationMemoryId?: string;
    /** Display name an import job assigns to the new translation memory. */
    readonly displayName?: string;
    /** MIME type declared for an import job's file. */
    readonly sourceContentType?: string;
    /** Size in bytes declared for an import job's file. */
    readonly sourceContentLength?: number;
}

/**
 * Type used during JSON parsing of API response for translation memory segments.
 * @private
 */
export interface TranslationMemorySegmentsApiResponse {
    segments?: {
        source_segment_id: string;
        source_text: string;
        creation_time?: string;
        updated_time?: string;
        last_used_time?: string;
        targets?: {
            target_segment_id: string;
            target_language: string;
            target_text: string;
            creation_time?: string;
            updated_time?: string;
            last_used_time?: string;
        }[];
    }[];
    segment_count?: number;
    next_page_cursor?: string;
}

/**
 * Type used during JSON parsing of API response for creating a translation memory import.
 * @private
 */
export interface TranslationMemoryImportApiResponse {
    job_id: string;
    upload_url: string;
    expires_at?: string;
}

/**
 * Type used during JSON parsing of API response for creating a translation memory export.
 * @private
 */
export interface TranslationMemoryExportApiResponse {
    job_id: string;
    parameters?: {
        translation_memory_id?: string;
    };
}

/**
 * Type used during JSON parsing of API response for a translation memory job.
 * @private
 */
export interface TranslationMemoryJobApiResponse {
    job_id: string;
    product?: string;
    operation?: string;
    creation_time?: string;
    updated_time?: string;
    source_file?: {
        content_type?: string;
        content_length?: number;
    };
    parameters?: {
        translation_memory_id?: string;
        display_name?: string;
    };
    results?: {
        status?: string;
        status_metadata?: {
            required_action?: string;
        };
        download_url?: string;
        expires_at?: string;
        error?: {
            message?: string;
        };
        translation_memory_id?: string;
        skipped_segment_count?: number;
    }[];
}
