// Copyright 2025 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import * as deepl from 'deepl-node';

import nock from 'nock';

import { makeDeeplClient, makeTranslator, serverUrl } from './client';

const languages = [
    {
        lang: 'en',
        name: 'English',
        usable_as_source: true,
        usable_as_target: false,
        status: 'stable',
    },
    {
        lang: 'de',
        name: 'German',
        usable_as_source: true,
        usable_as_target: true,
        status: 'stable',
        features: { formality: { status: 'stable' } },
    },
    {
        lang: 'tr',
        name: 'Turkish',
        usable_as_source: false,
        usable_as_target: true,
        status: 'stable',
        features: {},
    },
];

describe('Translator.getSourceLanguages', () => {
    it('sends resource=translate_text and parses the source languages', async () => {
        nock(serverUrl)
            .get('/v3/languages')
            .query({ resource: 'translate_text' })
            .reply(200, languages);

        const result = await makeTranslator().getSourceLanguages();

        expect(result).toEqual([
            { code: 'en', name: 'English' },
            { code: 'de', name: 'German' },
        ]);
    });
});

describe('Translator.getTargetLanguages', () => {
    it('sends resource=translate_text and parses the target languages and formality support', async () => {
        nock(serverUrl)
            .get('/v3/languages')
            .query({ resource: 'translate_text' })
            .reply(200, languages);

        const result = await makeTranslator().getTargetLanguages();

        expect(result).toEqual([
            { code: 'de', name: 'German', supportsFormality: true },
            { code: 'tr', name: 'Turkish', supportsFormality: false },
        ]);
    });
});

describe('Translator.getGlossaryLanguagePairs', () => {
    it('sends resource=glossary and parses the pairs of different languages', async () => {
        nock(serverUrl).get('/v3/languages').query({ resource: 'glossary' }).reply(200, languages);

        const result = await makeTranslator().getGlossaryLanguagePairs();

        expect(result).toEqual([
            { sourceLang: 'en', targetLang: 'de' },
            { sourceLang: 'en', targetLang: 'tr' },
            { sourceLang: 'de', targetLang: 'tr' },
        ]);
    });
});

describe('DeepLClient.getLanguagesForResource', () => {
    it('sends the resource and one include parameter per value', async () => {
        nock(serverUrl)
            .get('/v3/languages')
            .query({ resource: 'glossary', include: ['beta', 'external'] })
            .reply(200, [
                {
                    lang: 'de',
                    name: 'German',
                    usable_as_source: true,
                    usable_as_target: false,
                    status: 'beta',
                    features: { glossary: { status: 'stable' } },
                },
            ]);

        const result = await makeDeeplClient().getLanguagesForResource('glossary', {
            include: ['beta', 'external'],
        });

        expect(result).toEqual([
            {
                code: 'de',
                name: 'German',
                status: 'beta',
                usableAsSource: true,
                usableAsTarget: false,
                features: { glossary: { status: 'stable' } },
            },
        ]);
    });

    it('sends no include parameter by default', async () => {
        nock(serverUrl).get('/v3/languages').query({ resource: 'write' }).reply(200, []);

        await makeDeeplClient().getLanguagesForResource('write');
    });

    it('throws ArgumentError when the resource is empty', async () => {
        await expect(
            makeDeeplClient().getLanguagesForResource('' as deepl.LanguageResourceName),
        ).rejects.toThrow(deepl.ArgumentError);
    });
});

describe('DeepLClient.getLanguageResources', () => {
    it('parses the resources and their features', async () => {
        nock(serverUrl)
            .get('/v3/languages/resources')
            .reply(200, [
                {
                    name: 'translate_text',
                    features: [
                        {
                            name: 'glossary',
                            needs_source_support: true,
                            needs_target_support: true,
                        },
                        { name: 'formality', needs_target_support: true },
                    ],
                },
            ]);

        const result = await makeDeeplClient().getLanguageResources();

        expect(result).toEqual([
            {
                name: 'translate_text',
                features: {
                    glossary: {
                        name: 'glossary',
                        needsSourceSupport: true,
                        needsTargetSupport: true,
                    },
                    formality: {
                        name: 'formality',
                        needsSourceSupport: undefined,
                        needsTargetSupport: true,
                    },
                },
            },
        ]);
    });
});
