// Copyright 2022 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import fs from 'fs';

import { exampleText, makeTranslator, tempFiles, testTimeout } from '../core';

describe('Translator.translateDocument', () => {
    it(
        'uploads, polls and downloads a .txt document',
        async () => {
            const [exampleDocument, outputPath] = tempFiles();

            const status = await makeTranslator().translateDocument(
                exampleDocument,
                outputPath,
                null,
                'de',
            );

            expect(status.ok() && status.done()).toBe(true);
            expect(status.billedCharacters).toBe(exampleText.en.length);
            expect(fs.statSync(outputPath).size).toBeGreaterThan(0);
        },
        testTimeout,
    );
});
