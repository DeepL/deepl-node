// Copyright 2025 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import * as deepl from 'deepl-node';

/** Server URL that the offline tests intercept with nock; no request ever leaves the process. */
export const serverUrl = 'https://api.deepl.com';

export function makeTranslator(
    options?: deepl.TranslatorOptions & { authKey?: string },
): deepl.Translator {
    return new deepl.Translator(options?.authKey ?? 'k', { serverUrl, ...options });
}

export function makeDeeplClient(
    options?: deepl.DeepLClientOptions & { authKey?: string },
): deepl.DeepLClient {
    return new deepl.DeepLClient(options?.authKey ?? 'k', { serverUrl, ...options });
}
