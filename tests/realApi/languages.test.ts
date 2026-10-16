// Copyright 2025 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import { makeDeeplClient, makeTranslator } from '../core';

describe('Translator.getSourceLanguages', () => {
    it('sends GET /v3/languages and parses the source languages', async () => {
        const languages = await makeTranslator().getSourceLanguages();

        expect(languages.filter((language) => language.code === 'en')).toHaveLength(1);
        for (const language of languages) {
            expect(language.name.length).toBeGreaterThan(0);
            expect(language.code).toBe(language.code.toLowerCase());
            expect(language).not.toHaveProperty('supportsFormality');
        }
    });
});

describe('DeepLClient.getLanguageResources', () => {
    it('sends GET /v3/languages/resources and parses the resources and their features', async () => {
        const resources = await makeDeeplClient().getLanguageResources();

        expect(resources.length).toBeGreaterThan(0);
        for (const resource of resources) {
            expect(resource.name.length).toBeGreaterThan(0);
            for (const [featureName, feature] of Object.entries(resource.features)) {
                expect(feature.name).toBe(featureName);
            }
        }
        const translateText = resources.find((resource) => resource.name === 'translate_text');
        expect(translateText?.features.glossary?.needsSourceSupport).toBe(true);
        expect(translateText?.features.glossary?.needsTargetSupport).toBe(true);
    });
});
