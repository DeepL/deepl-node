// Copyright 2022 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import { exampleText, makeTranslator } from '../core';

describe('Translator.translateText', () => {
    it('sends POST /v2/translate and parses the result', async () => {
        const result = await makeTranslator().translateText(exampleText.en, null, 'de');

        expect(result.text).toEqual(expect.any(String));
        expect(result.detectedSourceLang).toBe('en');
        expect(result.billedCharacters).toBe(exampleText.en.length);
    });
});
