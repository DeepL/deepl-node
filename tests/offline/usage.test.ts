// Copyright 2025 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import nock from 'nock';

import { makeOfflineTranslator, offlineServerUrl } from '../core';

describe('Translator.getUsage', () => {
    it('parses character, document and team document usage', async () => {
        nock(offlineServerUrl).get('/v2/usage').reply(200, {
            character_count: 10,
            character_limit: 100,
            document_count: 1,
            document_limit: 5,
            team_document_count: 2,
            team_document_limit: 50,
        });

        const usage = await makeOfflineTranslator().getUsage();

        expect(usage.character).toMatchObject({ count: 10, limit: 100 });
        expect(usage.document).toMatchObject({ count: 1, limit: 5 });
        expect(usage.teamDocument).toMatchObject({ count: 2, limit: 50 });
        expect(usage.anyLimitReached()).toBe(false);
        expect(usage.toString()).toBe(
            'Usage this billing period:\nCharacters: 10 of 100\nDocuments: 1 of 5\nTeam documents: 2 of 50',
        );
    });

    it('leaves out the usage types that the response does not contain', async () => {
        nock(offlineServerUrl)
            .get('/v2/usage')
            .reply(200, { team_document_count: 1, team_document_limit: 1 });

        const usage = await makeOfflineTranslator().getUsage();

        expect([usage.character, usage.document]).toEqual([undefined, undefined]);
        expect(usage.teamDocument?.limitReached()).toBe(true);
        expect(usage.anyLimitReached()).toBe(true);
    });
});
