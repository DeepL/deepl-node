// Copyright 2025 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import { exampleText, makeDeeplClient, withRealServer } from './core';

describe('correct text', () => {
    it('should correct a single text', async () => {
        const deeplClient = makeDeeplClient();
        const result = await deeplClient.correctText(exampleText.de, 'de');
        expect(result.text).toBe(exampleText.de);
        expect(result.detectedSourceLang).toBe('de');
        expect(result.targetLang).toBe('de');
    });

    withRealServer('should correct a single text without a target language', async () => {
        const deeplClient = makeDeeplClient();
        const result = await deeplClient.correctText(exampleText.de);
        expect(result.text).toBe(exampleText.de);
        expect(result.detectedSourceLang).toBe('de');
        expect(result.targetLang).toBe('de');
    });

    it('should correct an array of texts', async () => {
        const deeplClient = makeDeeplClient();
        const results = await deeplClient.correctText([exampleText.de, exampleText.de], 'de');
        expect(results).toHaveLength(2);
        for (const result of results) {
            expect(result.text).toBe(exampleText.de);
        }
    });

    it('should reject an empty text', async () => {
        const deeplClient = makeDeeplClient();
        await expect(deeplClient.correctText('', 'de')).rejects.toThrow(/non-empty string/);
    });

    it('should throw an error for unsupported languages', async () => {
        const deeplClient = makeDeeplClient();
        const deeplClientPromise = deeplClient.correctText(exampleText.de, 'lv');
        await expect(deeplClientPromise).rejects.toBeInstanceOf(Error);
        await expect(deeplClientPromise).rejects.toThrow(/Value for '?target_lang'? not supported/);
    });
});
