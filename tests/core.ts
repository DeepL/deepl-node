// Copyright 2022 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import * as deepl from 'deepl-node';

import { randomBytes } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

export const exampleText: Record<string, string> = {
    en: 'proton beam',
    de: 'Protonenstrahl',
};

/**
 * Creates a temp directory with an example .txt document, and returns its path, a path for the
 * translated output and the directory.
 */
export function tempFiles(): [string, string, string] {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deepl-node-test-'));
    const exampleDocument = `${tempDir}/example_document.txt`;
    fs.writeFileSync(exampleDocument, exampleText.en);
    return [exampleDocument, `${tempDir}/output_document.txt`, tempDir];
}

export interface TestTranslatorOptions {
    authKey?: string;
    maxRetries?: number;
    minTimeout?: number;
    proxy?: deepl.ProxyConfig;
    sendPlatformInfo?: boolean;
    appInfo?: deepl.AppInfo;
    headers?: Record<string, string>;
    serverUrl?: string;
}

function clientOptions(options: TestTranslatorOptions | undefined, serverUrl: string | undefined) {
    return {
        serverUrl: options?.serverUrl ?? serverUrl,
        headers: options?.headers,
        minTimeout: options?.minTimeout,
        maxRetries: options?.maxRetries,
        proxy: options?.proxy,
        sendPlatformInfo: options?.sendPlatformInfo,
        appInfo: options?.appInfo,
    };
}

function realAuthKey(options?: TestTranslatorOptions): string {
    const authKey = options?.authKey ?? process.env.DEEPL_AUTH_KEY;
    if (authKey === undefined) {
        throw Error('DEEPL_AUTH_KEY environment variable must be defined');
    }
    return authKey;
}

/** Creates a Translator for the API at DEEPL_SERVER_URL, using DEEPL_AUTH_KEY. */
export function makeTranslator(options?: TestTranslatorOptions): deepl.Translator {
    return new deepl.Translator(
        realAuthKey(options),
        clientOptions(options, process.env.DEEPL_SERVER_URL),
    );
}

/** Creates a DeepLClient for the API at DEEPL_SERVER_URL, using DEEPL_AUTH_KEY. */
export function makeDeeplClient(options?: TestTranslatorOptions): deepl.DeepLClient {
    return new deepl.DeepLClient(
        realAuthKey(options),
        clientOptions(options, process.env.DEEPL_SERVER_URL),
    );
}

/** Server URL that the offline tests intercept with nock; no request ever leaves the process. */
export const offlineServerUrl = 'https://api.deepl.com';

export function makeOfflineTranslator(options?: TestTranslatorOptions): deepl.Translator {
    return new deepl.Translator(options?.authKey ?? 'k', clientOptions(options, offlineServerUrl));
}

export function makeOfflineDeeplClient(options?: TestTranslatorOptions): deepl.DeepLClient {
    return new deepl.DeepLClient(options?.authKey ?? 'k', clientOptions(options, offlineServerUrl));
}

const runId = (() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const stamp =
        `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
        `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}`;
    const rand = Array.from(randomBytes(6), (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]);
    return `${stamp}-${rand.join('')}`;
})();

/** Name for a resource created by this test run, e.g. sdktest-node-202610151530-k3f9qz-glossary. */
export function runName(label: string): string {
    return `sdktest-node-${runId}-${label}`;
}

// Opt-in: the dev/test API does not enforce the 30 MB document limit. Run these tests against
// a limit-enforcing server (e.g. production) with DEEPL_TEST_DOC_SIZE_LIMIT=1.
export const withServerEnforcingDocSizeLimit =
    process.env.DEEPL_TEST_DOC_SIZE_LIMIT === '1' ? it : it.skip;

export const testFilePaths = {
    pptx: 'tests/resources/example_presentation_template.pptx',
    docx: 'tests/resources/example_document_template.docx',
    zip: 'tests/resources/example_zip_template.zip',
};

// Real-API flow tests poll jobs that take a minute or more
export const testTimeout = 60000;
