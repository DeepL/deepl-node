// Copyright 2025 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import { makeDeeplClient } from './client';
import { inputText } from '../fixtures';

describe('DeepLClient.correctText', () => {
    it('sends POST /v2/write/correct and parses the result', async () => {
        const result = await makeDeeplClient().correctText(inputText.de, 'de');

        expect(result.text).toEqual(expect.any(String));
        expect(result.detectedSourceLang).toBe('de');
        expect(result.targetLang).toBe('de');
    });
});
