// Copyright 2026 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import * as deepl from 'deepl-node';

import { timeout } from '../../src/utils';
import { makeDeeplClient } from './client';
import { getUniqueName, testTimeout } from './helpers';

// The SDK raises a DeepLError whose message starts with 'Not found' for a 404
const notFound = /^Not found/;

function isNotFound(e: unknown): boolean {
    return e instanceof deepl.DeepLError && notFound.test(e.message);
}

describe('DeepLClient style profiles', () => {
    it(
        'sends the style profile requests: create, get, list, update and delete',
        async () => {
            const client = makeDeeplClient();
            const name = getUniqueName('styleProfile');
            const styleRule = await client.createStyleRule({
                name: getUniqueName('styleProfileRule'),
                language: 'de',
            });
            let styleProfileId: string | undefined;
            try {
                const created = await client.createStyleProfile(name, {
                    description: 'Contract wording',
                    styleRuleIds: [styleRule.styleId],
                });
                styleProfileId = created.styleProfileId;
                expect(created.name).toBe(name);
                expect(created.description).toBe('Contract wording');
                expect(created.styleRuleIds).toEqual([styleRule.styleId]);
                expect(created.glossaryIds).toEqual([]);
                expect(created.translationMemoryIds).toEqual([]);
                expect(created.creationTime).toBeInstanceOf(Date);

                // A new style profile can be briefly invisible
                let fetched: deepl.StyleProfile | undefined;
                for (let attempt = 0; fetched === undefined; attempt++) {
                    try {
                        fetched = await client.getStyleProfile(styleProfileId);
                    } catch (e) {
                        if (!isNotFound(e) || attempt >= 9) throw e;
                        await timeout(1000);
                    }
                }
                expect(fetched.name).toBe(name);
                expect(fetched.description).toBe('Contract wording');
                expect(fetched.styleRuleIds).toEqual([styleRule.styleId]);

                let listed = false;
                for (let page = 0; !listed && page < 20; page++) {
                    const profiles = await client.listStyleProfiles(page, 100);
                    if (profiles.length === 0) break;
                    listed = profiles.some((p) => p.styleProfileId === styleProfileId);
                }
                expect(listed).toBe(true);

                const updated = await client.updateStyleProfile(created, {
                    name: `${name}-renamed`,
                    industry: 'Legal',
                    description: '',
                    styleRuleIds: [],
                });
                expect(updated.name).toBe(`${name}-renamed`);
                expect(updated.industry).toBe('Legal');
                expect(updated.description).toBeUndefined();
                expect(updated.styleRuleIds).toEqual([]);

                await client.deleteStyleProfile(styleProfileId);
                await expect(client.getStyleProfile(styleProfileId)).rejects.toThrow(notFound);
            } finally {
                if (styleProfileId !== undefined) {
                    await client.deleteStyleProfile(styleProfileId).catch((e) => {
                        if (!isNotFound(e)) throw e;
                    });
                }
                await client.deleteStyleRule(styleRule.styleId).catch((e) => {
                    if (!isNotFound(e)) throw e;
                });
            }
        },
        testTimeout,
    );
});
