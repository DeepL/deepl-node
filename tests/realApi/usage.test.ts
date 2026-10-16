// Copyright 2025 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import { makeTranslator } from './client';

describe('Translator.getUsage', () => {
    it('sends GET /v2/usage and parses the usage', async () => {
        const usage = await makeTranslator().getUsage();

        expect(usage.toString()).toContain('Usage this billing period');
        expect(typeof usage.anyLimitReached()).toBe('boolean');
    });
});
