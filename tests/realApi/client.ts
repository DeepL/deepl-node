// Copyright 2025 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import * as deepl from 'deepl-node';

function envVar(name: string): string {
    const value = process.env[name];
    if (value === undefined) {
        throw Error(`${name} environment variable must be defined`);
    }
    return value;
}

/** Creates a Translator for the API at DEEPL_SERVER_URL, using DEEPL_AUTH_KEY. */
export function makeTranslator(options?: deepl.TranslatorOptions): deepl.Translator {
    return new deepl.Translator(envVar('DEEPL_AUTH_KEY'), {
        serverUrl: process.env.DEEPL_SERVER_URL,
        ...options,
    });
}

/** Creates a DeepLClient for the API at DEEPL_SERVER_URL, using DEEPL_AUTH_KEY. */
export function makeDeeplClient(options?: deepl.DeepLClientOptions): deepl.DeepLClient {
    return new deepl.DeepLClient(envVar('DEEPL_AUTH_KEY'), {
        serverUrl: process.env.DEEPL_SERVER_URL,
        ...options,
    });
}

/** Creates a DeepLAdminClient for the API at DEEPL_SERVER_URL, using DEEPL_ADMIN_KEY. */
export function makeAdminClient(options?: deepl.DeepLAdminClientOptions): deepl.DeepLAdminClient {
    return new deepl.DeepLAdminClient(envVar('DEEPL_ADMIN_KEY'), {
        serverUrl: process.env.DEEPL_SERVER_URL,
        ...options,
    });
}
