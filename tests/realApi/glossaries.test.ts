// Copyright 2022 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import * as deepl from 'deepl-node';

import { timeout } from '../../src/utils';
import { makeTranslator, runName, testTimeout } from '../core';

describe('Translator glossaries', () => {
    it(
        'sends the v2 glossary requests: create, get, list, entries and delete',
        async () => {
            const translator = makeTranslator();
            const name = runName('glossary');
            const entries = new deepl.GlossaryEntries({
                entries: { Apple: 'Apfel', Banana: 'Banane' },
            });

            const glossary = await translator.createGlossary(name, 'en', 'de', entries);
            try {
                expect(glossary.name).toBe(name);
                expect(glossary.sourceLang).toBe('en');
                expect(glossary.targetLang).toBe('de');
                expect(glossary.entryCount).toBe(2);

                // A new glossary can be briefly invisible
                let fetched: deepl.GlossaryInfo | undefined;
                for (let attempt = 0; fetched === undefined; attempt++) {
                    try {
                        fetched = await translator.getGlossary(glossary.glossaryId);
                    } catch (e) {
                        if (!(e instanceof deepl.GlossaryNotFoundError) || attempt >= 9) throw e;
                        await timeout(1000);
                    }
                }
                expect(fetched.glossaryId).toBe(glossary.glossaryId);
                expect(fetched.name).toBe(name);
                expect(fetched.creationTime.getTime()).toBe(glossary.creationTime.getTime());

                const listed = await translator.listGlossaries();
                expect(listed.map((info) => info.glossaryId)).toContain(glossary.glossaryId);

                const fetchedEntries = await translator.getGlossaryEntries(glossary.glossaryId);
                expect(fetchedEntries.entries()).toEqual(entries.entries());
            } finally {
                await translator.deleteGlossary(glossary).catch(() => undefined);
            }
            await expect(translator.getGlossary(glossary.glossaryId)).rejects.toThrow(
                deepl.GlossaryNotFoundError,
            );
        },
        testTimeout,
    );
});
