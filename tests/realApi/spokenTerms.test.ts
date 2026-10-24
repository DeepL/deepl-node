// Copyright 2026 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import * as deepl from 'deepl-node';

import { timeout } from '../../src/utils';
import { makeDeeplClient } from './client';
import { getUniqueName, testTimeout } from './helpers';

// The SDK raises a DeepLError whose message starts with 'Not found' for a 404
const notFound = /^Not found/;

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

                // A new collection can be briefly invisible
                let fetched: deepl.SpokenTerms | undefined;
                for (let attempt = 0; fetched === undefined; attempt++) {
                    try {
                        fetched = await client.getSpokenTerms(spokenTermsId);
                    } catch (e) {
                        const isNotFound =
                            e instanceof deepl.DeepLError && notFound.test(e.message);
                        if (!isNotFound || attempt >= 9) throw e;
                        await timeout(1000);
                    }
                }
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
                const afterDelete = client.getSpokenTerms(spokenTermsId);
                await expect(afterDelete).rejects.toThrow(deepl.DeepLError);
                await expect(afterDelete).rejects.toThrow(notFound);
            } finally {
                await client.deleteSpokenTerms(spokenTermsId).catch(() => undefined);
            }
        },
        testTimeout,
    );
});
