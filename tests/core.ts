// Copyright 2022 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import * as deepl from 'deepl-node';

import fs from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';

// Note: this constant cannot be exported immediately, because exports are locally undefined
const internalExampleText: Record<string, string> = {
    ar: 'شعاع البروتون',
    bg: 'протонен лъч',
    cs: 'protonový paprsek',
    da: 'protonstråle',
    de: 'Protonenstrahl',
    el: 'δέσμη πρωτονίων',
    en: 'proton beam',
    'en-US': 'proton beam',
    'en-GB': 'proton beam',
    es: 'haz de protones',
    et: 'prootonikiirgus',
    fi: 'protonisäde',
    fr: 'faisceau de protons',
    hu: 'protonnyaláb',
    id: 'berkas proton',
    it: 'fascio di protoni',
    ja: '陽子ビーム',
    ko: '양성자 빔',
    lt: 'protonų spindulys',
    lv: 'protonu staru kūlis',
    nb: 'protonstråle',
    nl: 'protonenbundel',
    pl: 'wiązka protonów',
    pt: 'feixe de prótons',
    'pt-BR': 'feixe de prótons',
    'pt-PT': 'feixe de prótons',
    ro: 'fascicul de protoni',
    ru: 'протонный луч',
    sk: 'protónový lúč',
    sl: 'protonski žarek',
    sv: 'protonstråle',
    tr: 'proton ışını',
    uk: 'протонний пучок',
    zh: '质子束',
    'zh-HANS': '质子束',
    'zh-HANT': '質子束',
};

export const usingMockServer = process.env.DEEPL_MOCK_SERVER_PORT !== undefined;
const usingMockProxyServer =
    usingMockServer && process.env.DEEPL_MOCK_PROXY_SERVER_PORT !== undefined;

/**
 * Creates a random authKey for testing purposes. Only valid if using mock-server.
 */
function randomAuthKey(): string {
    if (!usingMockServer) throw new Error('A random authKey is only valid using mock-server.');
    return randomUUID();
}

function makeSessionName(): string {
    return `${expect.getState().currentTestName}/${randomUUID()}`;
}

export const exampleText = internalExampleText;
export const exampleDocumentInput = exampleText.en;
export const exampleDocumentOutput = exampleText.de;
export const exampleLargeDocumentInput = (exampleText.en + '\n').repeat(1000);
export const exampleLargeDocumentOutput = (exampleText.de + '\n').repeat(1000);

/**
 * Creates temp directory, test files for a small and large .txt document, and an output path.
 */
export function tempFiles() {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deepl-node-test-'));

    const exampleDocument = `${tempDir}/example_document.txt`;
    const exampleLargeDocument = `${tempDir}/example_large_document.txt`;
    const outputDocumentPath = `${tempDir}/output_document.txt`;

    fs.writeFileSync(exampleDocument, exampleDocumentInput);
    fs.writeFileSync(exampleLargeDocument, exampleLargeDocumentInput);

    return [exampleDocument, exampleLargeDocument, outputDocumentPath, tempDir];
}

export interface TestTranslatorOptions {
    authKey?: string;
    randomAuthKey?: boolean;
    maxRetries?: number;
    minTimeout?: number;
    proxy?: deepl.ProxyConfig;
    sendPlatformInfo?: boolean;
    appInfo?: deepl.AppInfo;

    mockServerNoResponseTimes?: number;
    mockServer429ResponseTimes?: number;
    mockServerInitCharacterLimit?: number;
    mockServerInitDocumentLimit?: number;
    mockServerInitTeamDocumentLimit?: number;
    mockServerDocFailureTimes?: number;
    mockServerDocQueueTime?: number;
    mockServerDocTranslateTime?: number;
    mockServerExpectProxy?: boolean;
    mockServerOptional?: boolean;
}

/**
 * Create a Translator object using given options for authKey, timeouts & retries, and mock-server
 * session settings.
 * @param options Options controlling Translator behaviour and mock-server sessions settings.
 */
export function makeTranslator(options?: TestTranslatorOptions): deepl.Translator {
    if (!usingMockServer && process.env.DEEPL_AUTH_KEY === undefined) {
        throw Error('DEEPL_AUTH_KEY environment variable must be defined unless using mock-server');
    }

    const authKey =
        options?.authKey ||
        (options?.randomAuthKey ? randomAuthKey() : process.env.DEEPL_AUTH_KEY || '');

    const serverUrl = process.env.DEEPL_SERVER_URL;

    const sessionHeaders: Record<string, string> = {};
    if (options?.mockServerNoResponseTimes !== undefined)
        sessionHeaders['mock-server-session-no-response-count'] = String(
            options?.mockServerNoResponseTimes,
        );
    if (options?.mockServer429ResponseTimes !== undefined)
        sessionHeaders['mock-server-session-429-count'] = String(
            options?.mockServer429ResponseTimes,
        );
    if (options?.mockServerInitCharacterLimit !== undefined)
        sessionHeaders['mock-server-session-init-character-limit'] = String(
            options?.mockServerInitCharacterLimit,
        );
    if (options?.mockServerInitDocumentLimit !== undefined)
        sessionHeaders['mock-server-session-init-document-limit'] = String(
            options?.mockServerInitDocumentLimit,
        );
    if (options?.mockServerInitTeamDocumentLimit !== undefined)
        sessionHeaders['mock-server-session-init-team-document-limit'] = String(
            options?.mockServerInitTeamDocumentLimit,
        );
    if (options?.mockServerDocFailureTimes !== undefined)
        sessionHeaders['mock-server-session-doc-failure'] = String(
            options?.mockServerDocFailureTimes,
        );
    if (options?.mockServerDocQueueTime !== undefined)
        sessionHeaders['mock-server-session-doc-queue-time'] = String(
            options?.mockServerDocQueueTime,
        );
    if (options?.mockServerDocTranslateTime !== undefined)
        sessionHeaders['mock-server-session-doc-translate-time'] = String(
            options?.mockServerDocTranslateTime,
        );
    if (options?.mockServerExpectProxy !== undefined)
        sessionHeaders['mock-server-session-expect-proxy'] = options?.mockServerExpectProxy
            ? '1'
            : '0';
    if (Object.entries(sessionHeaders).length !== 0) {
        if (!usingMockServer && !options?.mockServerOptional)
            throw new Error('Mock-server session is only used if using mock-server.');
        sessionHeaders['mock-server-session'] = makeSessionName();
    }

    return new deepl.Translator(authKey, {
        serverUrl: serverUrl,
        headers: sessionHeaders,
        minTimeout: options?.minTimeout,
        maxRetries: options?.maxRetries,
        proxy: options?.proxy,
        sendPlatformInfo: options?.sendPlatformInfo,
        appInfo: options?.appInfo,
    });
}

/**
 * Create a Translator object using given options for authKey, timeouts & retries, and mock-server
 * session settings.
 * @param options Options controlling Translator behaviour and mock-server sessions settings.
 */
export function makeDeeplClient(options?: TestTranslatorOptions): deepl.DeepLClient {
    if (!usingMockServer && process.env.DEEPL_AUTH_KEY === undefined) {
        throw Error('DEEPL_AUTH_KEY environment variable must be defined unless using mock-server');
    }

    const authKey =
        options?.authKey ||
        (options?.randomAuthKey ? randomAuthKey() : process.env.DEEPL_AUTH_KEY || '');

    const serverUrl = process.env.DEEPL_SERVER_URL;

    const sessionHeaders: Record<string, string> = {};
    if (options?.mockServerNoResponseTimes !== undefined)
        sessionHeaders['mock-server-session-no-response-count'] = String(
            options?.mockServerNoResponseTimes,
        );
    if (options?.mockServer429ResponseTimes !== undefined)
        sessionHeaders['mock-server-session-429-count'] = String(
            options?.mockServer429ResponseTimes,
        );
    if (options?.mockServerInitCharacterLimit !== undefined)
        sessionHeaders['mock-server-session-init-character-limit'] = String(
            options?.mockServerInitCharacterLimit,
        );
    if (options?.mockServerInitDocumentLimit !== undefined)
        sessionHeaders['mock-server-session-init-document-limit'] = String(
            options?.mockServerInitDocumentLimit,
        );
    if (options?.mockServerInitTeamDocumentLimit !== undefined)
        sessionHeaders['mock-server-session-init-team-document-limit'] = String(
            options?.mockServerInitTeamDocumentLimit,
        );
    if (options?.mockServerDocFailureTimes !== undefined)
        sessionHeaders['mock-server-session-doc-failure'] = String(
            options?.mockServerDocFailureTimes,
        );
    if (options?.mockServerDocQueueTime !== undefined)
        sessionHeaders['mock-server-session-doc-queue-time'] = String(
            options?.mockServerDocQueueTime,
        );
    if (options?.mockServerDocTranslateTime !== undefined)
        sessionHeaders['mock-server-session-doc-translate-time'] = String(
            options?.mockServerDocTranslateTime,
        );
    if (options?.mockServerExpectProxy !== undefined)
        sessionHeaders['mock-server-session-expect-proxy'] = options?.mockServerExpectProxy
            ? '1'
            : '0';
    if (Object.entries(sessionHeaders).length !== 0) {
        if (!usingMockServer && !options?.mockServerOptional)
            throw new Error('Mock-server session is only used if using mock-server.');
        sessionHeaders['mock-server-session'] = makeSessionName();
    }

    return new deepl.DeepLClient(authKey, {
        serverUrl: serverUrl,
        headers: sessionHeaders,
        minTimeout: options?.minTimeout,
        maxRetries: options?.maxRetries,
        proxy: options?.proxy,
        sendPlatformInfo: options?.sendPlatformInfo,
        appInfo: options?.appInfo,
    });
}

// Use instead of it(...) for tests that require a mock-server
export const withMockServer = usingMockServer ? it : it.skip;
// Use instead of it(...) for tests that require a mock-server with proxy
export const withMockProxyServer = usingMockProxyServer ? it : it.skip;
// Use instead of it(...) for tests that cannot run using mock-server
export const withRealServer = usingMockServer ? it.skip : it;
// Use instead of it(...) for tests that assert the server rejects documents
// over the 30 MB translation limit. Not every environment enforces that limit
// (e.g. the dev/test API does not), so these are opt-in: run them against a
// limit-enforcing server (e.g. production) with DEEPL_TEST_DOC_SIZE_LIMIT=1.
export const serverEnforcesDocSizeLimit =
    !usingMockServer && process.env.DEEPL_TEST_DOC_SIZE_LIMIT === '1';
export const withServerEnforcingDocSizeLimit = serverEnforcesDocSizeLimit ? it : it.skip;

const proxyUrlString = process.env.DEEPL_PROXY_URL;
const proxyUrl = proxyUrlString ? new URL(proxyUrlString) : undefined;
const proxyConfigHost = proxyUrl ? proxyUrl.hostname : '';
const proxyConfigPort = parseInt(process.env.DEEPL_MOCK_PROXY_SERVER_PORT || '');

export const proxyConfig: deepl.ProxyConfig = { host: proxyConfigHost, port: proxyConfigPort };

// Wrap setTimeout() with Promise
export const timeout = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Mocked document translation tests need slightly higher timeout limit
export const documentTranslationTestTimeout = 10000;

// E2E tests need a significantly higher timeout limit
export const testTimeout = 60000;

// Base URL for mocking out HTTP client
export const urlToMockRegexp =
    /(https?:\/\/api.*\.deepl\.com)|(deepl-mock:\d+)|(https?:\/\/localhost:\d+)/;

// For Document Minification
export const testFilePaths = {
    pptx: 'tests/resources/example_presentation_template.pptx',
    docx: 'tests/resources/example_document_template.docx',
    no_media: 'tests/resources/example_document_template_no_media.docx',
    zip: 'tests/resources/example_zip_template.zip',
};

module.exports = {
    testFilePaths,
    exampleText,
    exampleDocumentInput,
    exampleDocumentOutput,
    exampleLargeDocumentInput,
    exampleLargeDocumentOutput,
    tempFiles,
    withMockServer,
    withMockProxyServer,
    withRealServer,
    withServerEnforcingDocSizeLimit,
    makeTranslator,
    makeDeeplClient,
    documentTranslationTestTimeout,
    testTimeout,
    timeout,
    urlToMockRegexp,
    proxyConfig,
    usingMockServer,
};
