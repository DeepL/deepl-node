// Copyright 2025 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import { makeDeeplClient } from './client';

describe('DeepLClient.getUsage', () => {
    it('sends GET /v2/usage and parses the usage', async () => {
        const usage = await makeDeeplClient().getUsage();

        expect(usage.toString()).toContain('Usage this billing period');
        expect(typeof usage.anyCharacterLimitReached()).toBe('boolean');
    });
});
