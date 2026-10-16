// Copyright 2025 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import * as deepl from 'deepl-node';

import { timeout } from '../../src/utils';
import { makeDeeplClient } from './client';
import { getUniqueName, testTimeout } from './helpers';

describe('DeepLClient multilingual glossaries', () => {
    it(
        'sends the v3 glossary requests: create, get, list, entries, rename, update, replace and delete',
        async () => {
            const client = makeDeeplClient();
            const name = getUniqueName('glossary-v3');
            const enDe = {
                sourceLangCode: 'en',
                targetLangCode: 'de',
                entries: new deepl.GlossaryEntries({ entries: { Apple: 'Apfel' } }),
            };
            const enFr = {
                sourceLangCode: 'en',
                targetLangCode: 'fr',
                entries: new deepl.GlossaryEntries({ entries: { Apple: 'Pomme' } }),
            };

            const glossary = await client.createMultilingualGlossary(name, [enDe, enFr]);
            try {
                expect(glossary.name).toBe(name);
                expect(
                    glossary.dictionaries.map((d) => `${d.sourceLangCode}-${d.targetLangCode}`),
                ).toEqual(expect.arrayContaining(['en-de', 'en-fr']));

                // A new glossary can be briefly invisible
                let fetched: deepl.MultilingualGlossaryInfo | undefined;
                for (let attempt = 0; fetched === undefined; attempt++) {
                    try {
                        fetched = await client.getMultilingualGlossary(glossary.glossaryId);
                    } catch (e) {
                        if (!(e instanceof deepl.GlossaryNotFoundError) || attempt >= 9) throw e;
                        await timeout(1000);
                    }
                }
                expect(fetched.glossaryId).toBe(glossary.glossaryId);
                expect(fetched.name).toBe(name);

                const listed = await client.listMultilingualGlossaries();
                expect(listed.map((info) => info.glossaryId)).toContain(glossary.glossaryId);

                const fetchedEntries = await client.getMultilingualGlossaryDictionaryEntries(
                    glossary,
                    'en',
                    'de',
                );
                expect(fetchedEntries.entries.entries()).toEqual({ Apple: 'Apfel' });

                const renamed = await client.updateMultilingualGlossaryName(
                    glossary,
                    `${name}-renamed`,
                );
                expect(renamed.name).toBe(`${name}-renamed`);

                const updated = await client.updateMultilingualGlossaryDictionary(glossary, {
                    ...enDe,
                    entries: new deepl.GlossaryEntries({
                        entries: { Apple: 'Apfel', Pear: 'Birne' },
                    }),
                });
                expect(updated.glossaryId).toBe(glossary.glossaryId);

                const replaced = await client.replaceMultilingualGlossaryDictionary(glossary, {
                    ...enDe,
                    entries: new deepl.GlossaryEntries({ entries: { Cherry: 'Kirsche' } }),
                });
                expect(replaced).toEqual({
                    sourceLangCode: 'en',
                    targetLangCode: 'de',
                    entryCount: 1,
                });

                await client.deleteMultilingualGlossaryDictionary(glossary, 'en', 'fr');
            } finally {
                await client.deleteMultilingualGlossary(glossary).catch(() => undefined);
            }
        },
        testTimeout,
    );
});
