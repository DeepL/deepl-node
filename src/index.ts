// Copyright 2022 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import { HttpClient } from './client';
import {
    AuthorizationError,
    DeepLError,
    DocumentNotReadyError,
    DocumentTranslationError,
    GlossaryNotFoundError,
    QuotaExceededError,
    TooManyRequestsError,
} from './errors';
import { GlossaryEntries } from './glossaryEntries';
import {
    parseDocumentHandle,
    parseDocumentStatus,
    parseGlossaryInfo,
    parseGlossaryInfoList,
    parseTextResultArray,
    parseUsage,
} from './parsing';
import { Translator } from './translator';
import {
    AppInfo,
    DocumentTranslateOptions,
    Formality,
    GlossaryId,
    GlossaryInfo,
    LanguageCode,
    NonRegionalLanguageCode,
    RequestParameters,
    SentenceSplittingMode,
    SourceGlossaryLanguageCode,
    SourceLanguageCode,
    TagList,
    TargetGlossaryLanguageCode,
    TargetLanguageCode,
    TranslateTextOptions,
    TranslatorOptions,
} from './types';
import { isString, logInfo, streamToBuffer, streamToString, timeout, toBoolString } from './utils';

import * as fs from 'fs';
import { IncomingMessage, STATUS_CODES } from 'http';
import path from 'path';
import * as os from 'os';
import { URLSearchParams } from 'url';
import * as util from 'util';

export * from './errors';
export * from './glossaryEntries';
export * from './types';
export * from './adminClient';
export * from './deeplClient';
export * from './translator';
export { isFreeAccountAuthKey } from './utils';
