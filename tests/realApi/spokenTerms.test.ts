// Copyright 2026 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import * as deepl from 'deepl-node';

import { makeDeeplClient } from './client';
import { getUniqueName, testTimeout } from './helpers';

describe('DeepLClient spoken terms', () => {
    it(
        'sends the spoken terms requests: create, get, list, update, entries, replace and delete',
        async () => {
            const client = makeDeeplClient();
            const name = getUniqueName('spokenTerms');

            const spokenTerms = await client.createSpokenTerms(name, [
                { lang: 'en', entries: ['DeepL', 'webhook'] },
            ]);
            const spokenTermsId = spokenTerms.spokenTermsId;
            try {
                expect(spokenTerms.name).toBe(name);
                expect(spokenTerms.creationTime).toBeInstanceOf(Date);
                expect(Number.isNaN(spokenTerms.creationTime.getTime())).toBe(false);
                expect(spokenTerms.termLists).toEqual([{ lang: 'en', entryCount: 2 }]);

                const fetched = await client.getSpokenTerms(spokenTermsId);
                expect(fetched.spokenTermsId).toBe(spokenTermsId);
                const listed = await client.listSpokenTerms();
                expect(listed.some((item) => item.spokenTermsId === spokenTermsId)).toBe(true);

                const updated = await client.updateSpokenTerms(spokenTermsId, {
                    termLists: [{ lang: 'en', entries: ['authentication'] }],
                });
                expect(updated.termLists).toEqual([{ lang: 'en', entryCount: 3 }]);
                const entries = await client.getSpokenTermsEntries(spokenTermsId, 'en');
                expect(new Set(entries.entries)).toEqual(
                    new Set(['DeepL', 'authentication', 'webhook']),
                );

                const replaced = await client.replaceSpokenTermsList(spokenTermsId, {
                    lang: 'en',
                    entries: ['API'],
                });
                expect(replaced).toEqual({ lang: 'en', entryCount: 1 });
                const replacedEntries = await client.getSpokenTermsEntries(spokenTermsId, 'en');
                expect(replacedEntries.entries).toEqual(['API']);

                await client.replaceSpokenTermsList(spokenTermsId, {
                    lang: 'de',
                    entries: ['Schnittstelle'],
                });
                await client.deleteSpokenTermsList(spokenTermsId, 'de');
                const afterListDelete = await client.getSpokenTerms(spokenTermsId);
                expect(afterListDelete.termLists).toEqual([{ lang: 'en', entryCount: 1 }]);

                await client.deleteSpokenTerms(spokenTermsId);
                await expect(client.getSpokenTerms(spokenTermsId)).rejects.toThrow(
                    deepl.DeepLError,
                );
            } finally {
                await client.deleteSpokenTerms(spokenTermsId).catch(() => undefined);
            }
        },
        testTimeout,
    );
});
