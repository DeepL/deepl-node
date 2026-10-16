// Copyright 2025 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import * as deepl from 'deepl-node';

function authKey(): string {
    const key = process.env.DEEPL_AUTH_KEY;
    if (key === undefined) {
        throw Error('DEEPL_AUTH_KEY environment variable must be defined');
    }
    return key;
}

/** Creates a Translator for the API at DEEPL_SERVER_URL, using DEEPL_AUTH_KEY. */
export function makeTranslator(options?: deepl.TranslatorOptions): deepl.Translator {
    return new deepl.Translator(authKey(), {
        serverUrl: process.env.DEEPL_SERVER_URL,
        ...options,
    });
}

/** Creates a DeepLClient for the API at DEEPL_SERVER_URL, using DEEPL_AUTH_KEY. */
export function makeDeeplClient(options?: deepl.DeepLClientOptions): deepl.DeepLClient {
    return new deepl.DeepLClient(authKey(), {
        serverUrl: process.env.DEEPL_SERVER_URL,
        ...options,
    });
}
