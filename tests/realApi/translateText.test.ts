// Copyright 2022 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import { makeTranslator } from './client';
import { inputText } from '../fixtures';

describe('Translator.translateText', () => {
    it('sends POST /v2/translate and parses the result', async () => {
        const result = await makeTranslator().translateText(inputText.en, null, 'de');

        expect(result.text).toEqual(expect.any(String));
        expect(result.detectedSourceLang).toBe('en');
        expect(result.billedCharacters).toBe(inputText.en.length);
    });
});
