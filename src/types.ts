// Copyright 2022 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import { GlossaryEntries } from './glossaryEntries';

/**
 * Optional proxy configuration, may be specified as proxy in HttpClientOptions.
 * @see HttpClientOptions.proxy
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
 * as appInfo in HttpClientOptions.
 * @see HttpClientOptions.appInfo
 */
export interface AppInfo {
    appName: string;
    appVersion: string;
}

/**
 * Connection options shared by all clients.
 */
export interface HttpClientOptions {
    /**
     * HTTP headers attached to every HTTP request. By default, no extra headers are used. Note that
     * during client initialization headers for Authorization and User-Agent are added, unless
     * they are overridden in this option.
     */
    headers?: Record<string, string>;

    /**
     * The maximum number of retries after the first attempt, per request. By default, 5 retries
     * are made (6 attempts in total); 0 disables retries. Note: only errors due to transient
     * conditions are retried: HTTP 429, 5xx and network failures (connect, DNS, timeout).
     */
    maxRetries?: number;

    /**
     * Connection timeout used for each HTTP request retry, in milliseconds. The default timeout
     * if this value is unspecified is 10 seconds (10000).
     */
    minTimeout?: number;

    /**
     * Define the host, port and protocol of the proxy server, either as a ProxyConfig or as a
     * proxy URL such as 'http://user:pass@proxy.example.com:3128'.
     */
    proxy?: ProxyConfig | string;

    /**
     * Define if the library is allowed to send more detailed information about which platform
     * it is running on with each API call. Defaults to true if undefined.
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
export interface DeepLClientOptions extends HttpClientOptions {
    /**
     * Base URL of DeepL API, can be overridden for example for testing purposes. By default, the
     * correct DeepL API URL is selected based on the user account type (free or paid).
     */
    serverUrl?: string;
}

/**
 * Options that can be specified when constructing a Translator.
 * @deprecated Use DeepLClientOptions instead. Will be removed in the next major version.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface TranslatorOptions extends DeepLClientOptions {}

// `string & Record<never, never>` accepts any string, e.g. values the API adds later, while
// keeping editor completion for the listed members.
export type Formality =
    | 'less'
    | 'more'
    | 'default'
    | 'prefer_less'
    | 'prefer_more'
    | (string & Record<never, never>);
/**
 * Sentence splitting mode: '1' (split on punctuation and newlines), '0' (no splitting) or
 * 'nonewlines' (split on punctuation only). 'off' is sent as '0'.
 * 'on' and 'default' are deprecated: use '1' instead. They will be removed in the next major
 * version.
 */
export type SentenceSplittingMode =
    | '1'
    | '0'
    | 'off'
    | 'nonewlines'
    | 'on'
    | 'default'
    | (string & Record<never, never>);
export type TagHandlingMode = 'html' | 'xml' | (string & Record<never, never>);
export type TagHandlingVersion = 'v1' | 'v2' | (string & Record<never, never>);
export type ModelType =
    | 'quality_optimized'
    | 'latency_optimized'
    | 'prefer_quality_optimized'
    | (string & Record<never, never>);
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
    extraBodyParameters?: RequestParameters;

    /**
     * Extra parameters to be added to the request body.
     * Keys in this object will be added to the request body, and can override built-in parameters.
     * This is mostly used by DeepL employees to test functionality, or for beta programs.
     * @deprecated Use `extraBodyParameters`. Will be removed in the next major version.
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
     * - '1': Input translation text will be split into sentences using both newlines and
     *   punctuation, this is the default behaviour.
     * - '0' or 'off': Input translation text will not be split into sentences. This is advisable
     *   for applications where each input translation text is only one sentence.
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

    /** Specifies the ID of a style profile to use with translation, or a StyleProfile object
     * as returned by getStyleProfile(). The style profile applies its linked glossaries, style
     * rule lists and translation memories; a component that does not fit the language pair is
     * left out. Cannot be combined with the glossary, style rule, translation memory or custom
     * instructions options; the API rejects such requests.
     */
    styleProfile?: string | StyleProfile;

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

    /**
     * (internal only) Override path to send translate request to.
     * @deprecated For internal use only; will be removed in the next major version.
     */
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

    /** Specifies the ID of a style profile to use with translation, or a StyleProfile object
     * as returned by getStyleProfile(). The style profile applies its linked glossaries, style
     * rule lists and translation memories; a component that does not fit the language pair is
     * left out. Cannot be combined with the glossary, style rule or translation memory options;
     * the API rejects such requests. A style profile that does not exist fails the document
     * translation with a DocumentTranslationError.
     */
    styleProfile?: string | StyleProfile;

    /** Specifies the ID of a translation memory to use with translation, or
     * a TranslationMemoryInfo object as returned by listTranslationMemories().
     */
    translationMemory?: TranslationMemoryId | TranslationMemoryInfo;

    /** Specifies the minimum similarity threshold (0 to 100) for translation memory matches. */
    translationMemoryThreshold?: number;

    /** Filename including extension, only required when translating documents as streams. */
    filename?: string;

    /**
     * Controls whether to use Document Minification for translation, if available.
     * @deprecated Document minification is deprecated and will be removed in the next major
     * version. The DeepL API accepts larger documents; see the usage limits:
     * https://developers.deepl.com/docs/resources/usage-limits
     */
    enableDocumentMinification?: boolean;

    /**
     * File extension of the desired format of the translated document, for example `'docx'`.
     * If unspecified, the translated document has the same format as the input document.
     */
    outputFormat?: string;

    /**
     * Set to `true` to add a "Translated by DeepL" watermark to the translated document. Only
     * supported for `docx` and `pdf` output; the API ignores it for other output formats.
     */
    enableWatermark?: boolean;

    /**
     * Used by `translateDocument()` only: maximum time in milliseconds to wait for the document
     * translation between upload and download. When it expires, `translateDocument()` rejects
     * with a DocumentTranslationError. If unset, it waits without limit.
     */
    timeoutMs?: number;
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
 * 'en' and 'pt' translate as American English (en-US) and European Portuguese (pt-PT); use a
 * regional variant to choose explicitly.
 * Note: although the language code type definitions are case-sensitive, this package and the DeepL
 * API accept case-insensitive language codes.
 */
export type TargetLanguageCode =
    | CommonLanguageCode
    | 'en'
    | 'pt'
    | 'de-CH'
    | 'de-DE'
    | 'en-GB'
    | 'en-US'
    | 'es-419'
    | 'es-ES'
    | 'fr-CA'
    | 'fr-FR'
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
 * Accepted for source-language parameters: any {@link SourceLanguageCode}, or any other language
 * code string (e.g. one returned by getSourceLanguages() that this package does not list yet).
 */
export type SourceLanguageCodeInput = SourceLanguageCode | (string & Record<never, never>);

/**
 * Accepted for target-language parameters: any {@link TargetLanguageCode}, or any other language
 * code string (e.g. one returned by getTargetLanguages() that this package does not list yet).
 */
export type TargetLanguageCodeInput = TargetLanguageCode | (string & Record<never, never>);

/**
 * Accepted for language parameters that take source or target languages: any
 * {@link LanguageCode}, or any other language code string.
 */
export type LanguageCodeInput = LanguageCode | (string & Record<never, never>);

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
 * to be checked individually. API Pro accounts also get per-key, speech and per-product usage and the
 * billing period. The anyLimitReached() function checks the character, document and teamDocument
 * usage only.
 */
export interface Usage {
    /** Usage details for characters, for example due to the translateText() function. */
    readonly character?: UsageDetail;
    /** Usage details for documents. */
    readonly document?: UsageDetail;
    /** Usage details for documents shared among your team. */
    readonly teamDocument?: UsageDetail;
    /**
     * Usage details for characters translated with this API key, as opposed to `character`, which
     * covers the whole account. Only present for API Pro accounts.
     */
    readonly apiKeyCharacter?: UsageDetail;
    /** Usage details for speech-to-text, in minutes. Only present for API Pro accounts. */
    readonly speechToTextMinutes?: UsageDetail;
    /** Usage details for speech-to-speech, in minutes. Only present for API Pro accounts. */
    readonly speechToSpeechMinutes?: UsageDetail;
    /** Per-product usage in the current billing period. Only present for API Pro accounts. */
    readonly products?: UsageProduct[];
    /** Start of the current billing period. Only present for API Pro accounts. */
    readonly startTime?: Date;
    /** End of the current billing period. Only present for API Pro accounts. */
    readonly endTime?: Date;

    /**
     * Returns true if the character, document or team document usage has reached or passed its
     * limit, otherwise false. It does not check apiKeyCharacter, speechToTextMinutes or
     * speechToSpeechMinutes: call limitReached() on those details yourself.
     */
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
 * Usage of one product in the current billing period, part of the Usage object.
 */
export interface UsageProduct {
    /** The product, for example 'translate', 'write', 'speechToText' or 'speechToSpeech'. */
    readonly productType: string;
    /** The unit the product is billed in, for example 'characters' or 'minutes'. */
    readonly billingUnit: string;
    /** Units used for this product by this API key. */
    readonly apiKeyUnitCount: number;
    /** Units used for this product by the whole account. */
    readonly accountUnitCount: number;
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
 * Information about one language's list in a spoken terms collection, excluding the terms.
 */
export interface SpokenTermsList {
    /** Language code of the list, for example 'en'. */
    readonly lang: string;
    /** Number of terms in the list. */
    readonly entryCount: number;
}

/**
 * Information about a spoken terms collection, excluding the terms.
 */
export interface SpokenTerms {
    /** ID of the spoken terms collection. */
    readonly spokenTermsId: string;
    /** Name of the spoken terms collection chosen during creation. */
    readonly name: string;
    /** Time when the spoken terms collection was created. */
    readonly creationTime: Date;
    /** The term lists of the collection, one per language. */
    readonly termLists: SpokenTermsList[];
}

/**
 * The terms of one language in a spoken terms collection.
 */
export interface SpokenTermsEntries {
    /** Language code of the terms, for example 'en'. */
    readonly lang: string;
    /** The terms, one string per term. */
    readonly entries: string[];
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
 * Options for methods that poll until an operation completes.
 */
export interface WaitOptions {
    /**
     * Maximum time to wait in milliseconds; when it expires, the method rejects with a
     * DeepLError. Status is polled every 5 seconds. If unset, the method waits without limit.
     */
    timeoutMs?: number;
}

/**
 * Status of a document translation request.
 */
export interface DocumentStatus {
    /**
     * ID of the document, or undefined if the response does not contain it.
     */
    readonly documentId?: string;

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

    /**
     * The tag handling version used, present when tag handling was requested.
     */
    readonly tagHandlingVersion?: TagHandlingVersion;
}

/**
 * Options that can be specified when rephrasing text with `rephraseText()`.
 */
export interface RephraseTextOptions extends BaseRequestOptions {
    /** Writing style of the rephrased text, see `WritingStyle`. Cannot be combined with `tone`. */
    writingStyle?: string;
    /** Tone of the rephrased text, see `WritingTone`. Cannot be combined with `writingStyle`. */
    tone?: string;
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
 * @deprecated Internal; will no longer be exported in the next major version.
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
 * @deprecated Internal; will no longer be exported in the next major version.
 */
export interface MultilingualGlossaryDictionaryApiResponse {
    source_lang: string;
    target_lang: string;
    entry_count: number;
}

/**
 * Type used during JSON parsing of API response for listing multilingual glossaries.
 * @private
 * @deprecated Internal; will no longer be exported in the next major version.
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
 * @deprecated Internal; will no longer be exported in the next major version.
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
 * @deprecated Internal; will no longer be exported in the next major version.
 */
export interface ListStyleRuleApiResponse {
    style_rules: StyleRuleInfoApiResponse[];
}

/**
 * Information about a style profile: a named set of linked glossaries, style rule lists and
 * translation memories.
 */
export interface StyleProfile {
    /** Unique ID assigned to the style profile. */
    readonly styleProfileId: string;
    /** User-defined name of the style profile. */
    readonly name: string;
    /** Free-text description; undefined if the style profile has none. */
    readonly description?: string;
    /** The industry the style profile is written for; undefined if the style profile has none. */
    readonly industry?: string;
    /** IDs of the linked glossaries, highest priority first. */
    readonly glossaryIds: string[];
    /** IDs of the linked style rule lists. */
    readonly styleRuleIds: string[];
    /** IDs of the linked translation memories. */
    readonly translationMemoryIds: string[];
    /** Whether the order of glossaryIds sets the priority of the glossaries. */
    readonly glossaryPriorityOrderEnabled: boolean;
    /** Time when the style profile was created; undefined if the API returned no valid time. */
    readonly creationTime?: Date;
    /** Time of the last update; undefined if the API returned no valid time. */
    readonly updatedTime?: Date;
}

/**
 * Options for createStyleProfile(). An option left undefined is not sent. An empty string or
 * empty array is sent as given.
 */
export interface StyleProfileOptions {
    /** Free-text description of the style profile. In an update, '' clears it. */
    description?: string;
    /** The industry the style profile is written for. In an update, '' clears it. */
    industry?: string;
    /**
     * IDs of the glossaries to link, highest priority first. In an update, the array replaces the
     * linked glossaries in full; [] unlinks all of them.
     */
    glossaryIds?: string[];
    /**
     * IDs of the style rule lists to link. In an update, the array replaces the linked style rule
     * lists in full; [] unlinks all of them.
     */
    styleRuleIds?: string[];
    /**
     * IDs of the translation memories to link. In an update, the array replaces the linked
     * translation memories in full; [] unlinks all of them.
     */
    translationMemoryIds?: string[];
    /** Whether the order of glossaryIds sets the priority of the glossaries. */
    glossaryPriorityOrderEnabled?: boolean;
}

/**
 * Options for updateStyleProfile(). Options left undefined are not changed.
 */
export interface StyleProfileUpdateOptions extends StyleProfileOptions {
    /** New name of the style profile. */
    name?: string;
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
 * @deprecated Internal; will no longer be exported in the next major version.
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
 * @deprecated Internal; will no longer be exported in the next major version.
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
 * @deprecated Internal; will no longer be exported in the next major version.
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
 * @deprecated Internal; will no longer be exported in the next major version.
 */
export interface TranslationMemoryImportApiResponse {
    job_id: string;
    upload_url: string;
    expires_at?: string;
}

/**
 * Type used during JSON parsing of API response for creating a translation memory export.
 * @private
 * @deprecated Internal; will no longer be exported in the next major version.
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
 * @deprecated Internal; will no longer be exported in the next major version.
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

/**
 * A feature of a DeepL API resource, as returned by `DeepLClient.getLanguageResources()`.
 */
export interface ResourceFeature {
    /** Feature identifier, matching the feature keys reported per language, e.g. 'glossary'. */
    readonly name: string;
    /** If true, the source language must support this feature. Undefined means false. */
    readonly needsSourceSupport?: boolean;
    /** If true, the target language must support this feature. Undefined means false. */
    readonly needsTargetSupport?: boolean;
}

/**
 * A DeepL API resource and the features it supports, as returned by
 * `DeepLClient.getLanguageResources()`.
 */
export interface LanguageResource {
    /** Resource identifier, e.g. 'translate_text' or 'glossary'. */
    readonly name: string;
    /** Features supported by this resource, keyed by feature name. */
    readonly features: Record<string, ResourceFeature>;
}

/**
 * Type used during JSON parsing of API response for language resources.
 * @private
 * @deprecated Internal; will no longer be exported in the next major version.
 */
export interface LanguageResourceApiResponse {
    name: string;
    features?: {
        name: string;
        needs_source_support?: boolean;
        needs_target_support?: boolean;
    }[];
}

/**
 * DeepL API resource that languages can be queried for with `DeepLClient.getLanguagesForResource()`.
 */
export type LanguageResourceName =
    | 'translate_text'
    | 'translate_document'
    | 'glossary'
    | 'voice'
    | 'write'
    | 'style_rules'
    | 'translation_memory';

/**
 * Additional languages and features to include in the `DeepLClient.getLanguagesForResource()` response:
 * - 'beta': languages and features in beta, in addition to stable ones.
 * - 'external': features that rely on third-party service providers.
 */
export type LanguageInclude = 'beta' | 'external';

/**
 * Options for `DeepLClient.getLanguagesForResource()`.
 */
export interface GetLanguagesForResourceOptions {
    /** Additional languages and features to include. By default only stable ones are returned. */
    include?: LanguageInclude[];
}

/**
 * Support information for a feature of a language, as returned by `DeepLClient.getLanguagesForResource()`.
 */
export interface LanguageFeature {
    /** Availability status of this feature for this language, e.g. 'stable' or 'beta'. */
    readonly status: string;
}

/**
 * A language supported by a DeepL API resource, as returned by `DeepLClient.getLanguagesForResource()`.
 */
export interface LanguageSupport {
    /** Language code (BCP 47), e.g. 'de' or 'en-US'. */
    readonly code: string;
    /** Name of the language in English. */
    readonly name: string;
    /** Availability status of this language, e.g. 'stable' or 'beta'. */
    readonly status: string;
    /** True if this language can be used as a source language with the queried resource. */
    readonly usableAsSource: boolean;
    /** True if this language can be used as a target language with the queried resource. */
    readonly usableAsTarget: boolean;
    /** Features supported for this language with the queried resource, keyed by feature name. */
    readonly features: Record<string, LanguageFeature>;
}

/**
 * Options that can be specified when constructing a DeepLAdminClient.
 */
export interface DeepLAdminClientOptions extends HttpClientOptions {
    /**
     * Base URL of the DeepL API, can be overridden for example for testing purposes. Defaults to
     * https://api.deepl.com, as the Admin API is only available there.
     */
    serverUrl?: string;
}

/**
 * Grouping of the `DeepLAdminClient.getUsageAnalytics()` report:
 * - 'key': usage per API key, see {@link AdminUsageReport.keyUsages}.
 * - 'key_and_day': usage per API key and day, see {@link AdminUsageReport.keyAndDayUsages}.
 */
export type AdminUsageGroupBy = 'key' | 'key_and_day';

/**
 * Options for `DeepLAdminClient.getUsageAnalytics()`.
 */
export interface AdminUsageAnalyticsOptions {
    /** Group the usage by key or by key and day. */
    groupBy?: AdminUsageGroupBy;
}

/**
 * Aggregation of the `DeepLAdminClient.getCustomTagUsageAnalytics()` report:
 * - 'period': usage over the entire date range.
 * - 'day': usage per day.
 */
export type CustomTagUsageAggregateBy = 'period' | 'day';

/**
 * Options for `DeepLAdminClient.getCustomTagUsageAnalytics()`.
 */
export interface CustomTagUsageAnalyticsOptions {
    /** Aggregate the usage over the whole period (the default) or by day. */
    aggregateBy?: CustomTagUsageAggregateBy;
    /** Page number to retrieve, from the `nextPage` value of a previous report. */
    page?: number;
}

/**
 * Usage limits of a developer key. A null limit means unlimited.
 */
export interface DeveloperKeyUsageLimits {
    /** Maximum number of characters per usage period, or null if unlimited. */
    readonly characters: number | null;
    /** Maximum number of speech-to-text milliseconds per usage period, or null if unlimited. */
    readonly speechToTextMilliseconds: number | null;
    /** Maximum number of speech-to-speech milliseconds per usage period, or null if unlimited. */
    readonly speechToSpeechMilliseconds: number | null;
}

/**
 * Usage limits to change with `DeepLAdminClient.setDeveloperKeyUsageLimits()`. Omitted limits keep
 * their current value, null removes a limit and 0 blocks that usage.
 */
export interface DeveloperKeyUsageLimitsUpdate {
    /**
     * Maximum number of characters per usage period across text translation, document translation
     * and text improvement.
     */
    characters?: number | null;
    /** Maximum number of speech-to-text milliseconds per usage period. */
    speechToTextMilliseconds?: number | null;
    /** Maximum number of speech-to-speech milliseconds per usage period. */
    speechToSpeechMilliseconds?: number | null;
}

/**
 * Information about a developer API key, as returned by the Admin API.
 */
export interface DeveloperKey {
    /** Unique ID of the key. */
    readonly keyId: string;
    /** Label assigned to the key. */
    readonly label: string;
    /** Time when the key was created. */
    readonly creationTime?: Date;
    /** Time when the key was deactivated, undefined if the key is active. */
    readonly deactivatedTime?: Date;
    /** True if the key is deactivated. */
    readonly isDeactivated: boolean;
    /** Usage limits configured for the key. */
    readonly usageLimits: DeveloperKeyUsageLimits;
}

/**
 * Usage totals in an admin usage analytics report.
 */
export interface AdminUsageBreakdown {
    readonly totalCharacters: number;
    readonly textTranslationCharacters: number;
    readonly documentTranslationCharacters: number;
    readonly textImprovementCharacters: number;
    readonly speechToTextMinutes: number;
    readonly speechToSpeechMinutes: number;
}

/**
 * Usage of a single API key in an admin usage analytics report.
 */
export interface KeyUsage {
    /** Masked API key. */
    readonly apiKey: string;
    /** Label of the API key. */
    readonly apiKeyLabel: string;
    /** Usage of the API key. */
    readonly usage: AdminUsageBreakdown;
    /** Day of the usage, defined only when grouped by key and day. */
    readonly usageDate?: Date;
}

/**
 * Admin usage analytics report for a date range, as returned by
 * `DeepLAdminClient.getUsageAnalytics()`.
 */
export interface AdminUsageReport {
    /** Usage totals over the whole date range. */
    readonly totalUsage: AdminUsageBreakdown;
    /** Start of the report period. */
    readonly startDate?: Date;
    /** End of the report period. */
    readonly endDate?: Date;
    /** Grouping as reported by the API, if any: the raw string, for example 'keyAndDay'. */
    readonly groupBy?: string;
    /** Usage per key when grouped by 'key', otherwise empty. */
    readonly keyUsages: KeyUsage[];
    /** Usage per key and day when grouped by 'key_and_day', otherwise empty. */
    readonly keyAndDayUsages: KeyUsage[];
}

/**
 * Usage totals for a custom tag.
 */
export interface CustomTagUsageBreakdown {
    readonly totalCharacters: number;
    readonly textTranslationCharacters: number;
    readonly textImprovementCharacters: number;
    readonly speechToTextMinutes: number;
    readonly speechToSpeechMinutes: number;
}

/**
 * Usage of a single custom tag.
 */
export interface CustomTagUsage {
    readonly customTag: string;
    readonly breakdown: CustomTagUsageBreakdown;
    /** Day of the usage, defined only when aggregated by 'day'. */
    readonly usageDate?: Date;
}

/**
 * Custom tag usage analytics report for a date range, as returned by
 * `DeepLAdminClient.getCustomTagUsageAnalytics()`.
 */
export interface CustomTagUsageReport {
    /** Aggregation reported by the API. */
    readonly aggregateBy?: string;
    /** Start of the report period. */
    readonly startDate?: Date;
    /** End of the report period. */
    readonly endDate?: Date;
    /** Page number to request the next page, or undefined if this is the last page. */
    readonly nextPage?: number;
    /** Usage entries per custom tag. */
    readonly usage: CustomTagUsage[];
}
