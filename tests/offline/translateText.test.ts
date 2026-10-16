// Copyright 2022 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import * as deepl from 'deepl-node';

import nock from 'nock';

import { makeTranslator, serverUrl } from './client';

const translation = {
    translations: [{ detected_source_language: 'EN', text: 'out', billed_characters: 3 }],
};
const baseBody = { text: 'abc', target_lang: 'de', show_billed_characters: '1' };

/** Declares a POST /v2/translate that expects exactly this body. */
function expectTranslateBody(body: nock.DataMatcherMap, reply: object = translation) {
    return nock(serverUrl).post('/v2/translate', body).reply(200, reply);
}

describe('Translator.translateText', () => {
    it('sends the text, the target language and the billed characters flag', async () => {
        nock(serverUrl, { reqheaders: { authorization: 'DeepL-Auth-Key k' } })
            .post('/v2/translate', baseBody)
            .reply(200, translation);

        await makeTranslator().translateText('abc', null, 'de');
    });

    it('parses the detected language, billed characters and model type', async () => {
        expectTranslateBody(baseBody, {
            translations: [
                {
                    detected_source_language: 'PT',
                    text: 'out',
                    billed_characters: 7,
                    model_type_used: 'quality_optimized',
                },
            ],
        });

        const result = await makeTranslator().translateText('abc', null, 'de');

        expect(result).toEqual({
            text: 'out',
            detectedSourceLang: 'pt',
            billedCharacters: 7,
            modelTypeUsed: 'quality_optimized',
        });
    });

    it('sends every text of an array and returns one result per text', async () => {
        expectTranslateBody(
            { ...baseBody, text: ['a', 'b'] },
            {
                translations: [
                    { detected_source_language: 'EN', text: 'A', billed_characters: 1 },
                    { detected_source_language: 'FR', text: 'B', billed_characters: 1 },
                ],
            },
        );

        const results = await makeTranslator().translateText(['a', 'b'], null, 'de');

        expect(results.map((result) => result.text)).toEqual(['A', 'B']);
        expect(results.map((result) => result.detectedSourceLang)).toEqual(['en', 'fr']);
    });

    it('sends language codes in standard case', async () => {
        expectTranslateBody({ ...baseBody, source_lang: 'en', target_lang: 'en-US' });

        await makeTranslator().translateText(
            'abc',
            <deepl.SourceLanguageCode>'eN',
            <deepl.TargetLanguageCode>'EN-us',
        );
    });

    it.each([
        ['less', 'less'],
        ['more', 'more'],
        ['prefer_less', 'prefer_less'],
        ['prefer_more', 'prefer_more'],
        ['default', 'default'],
        ['MORE', 'more'],
    ])('sends formality %s as %s', async (formality, sent) => {
        expectTranslateBody({ ...baseBody, formality: sent });

        await makeTranslator().translateText('abc', null, 'de', {
            formality: <deepl.Formality>formality,
        });
    });

    it.each([
        ['on', '1'],
        ['default', '1'],
        ['off', '0'],
        ['nonewlines', 'nonewlines'],
        ['OFF', '0'],
    ])('sends splitSentences %s as %s', async (splitSentences, sent) => {
        expectTranslateBody({ ...baseBody, split_sentences: sent });

        await makeTranslator().translateText('abc', null, 'de', {
            splitSentences: <deepl.SentenceSplittingMode>splitSentences,
        });
    });

    it.each([
        [true, '1'],
        [false, '0'],
    ])('sends preserveFormatting %s as %s', async (preserveFormatting, sent) => {
        expectTranslateBody({ ...baseBody, preserve_formatting: sent });

        await makeTranslator().translateText('abc', null, 'de', { preserveFormatting });
    });

    it('sends the tag handling options', async () => {
        expectTranslateBody({
            ...baseBody,
            tag_handling: 'xml',
            tag_handling_version: 'v2',
            outline_detection: '0',
            non_splitting_tags: 'span',
            splitting_tags: 'title,par',
            ignore_tags: 'raw,code',
        });

        await makeTranslator().translateText('abc', null, 'de', {
            tagHandling: 'xml',
            tagHandlingVersion: 'v2',
            outlineDetection: false,
            nonSplittingTags: 'span',
            splittingTags: ['title', 'par'],
            ignoreTags: ['raw', 'code'],
        });
    });

    it('sends context and model type', async () => {
        expectTranslateBody({
            ...baseBody,
            context: 'a knife',
            model_type: 'latency_optimized',
        });

        await makeTranslator().translateText('abc', null, 'de', {
            context: 'a knife',
            modelType: 'latency_optimized',
        });
    });

    it('sends one custom_instructions parameter per instruction', async () => {
        expectTranslateBody({ ...baseBody, custom_instructions: ['Be brief', 'Use "Sie"'] });

        await makeTranslator().translateText('abc', null, 'de', {
            customInstructions: ['Be brief', 'Use "Sie"'],
        });
    });

    it('sends no custom_instructions parameter for an empty array', async () => {
        expectTranslateBody(baseBody);

        await makeTranslator().translateText('abc', null, 'de', { customInstructions: [] });
    });

    it('sends the style rule ID of a StyleRuleInfo', async () => {
        expectTranslateBody({ ...baseBody, style_id: 'style-1' });

        await makeTranslator().translateText('abc', null, 'de', {
            styleRule: <deepl.StyleRuleInfo>{ styleId: 'style-1' },
        });
    });

    it('sends the translation memory ID and threshold', async () => {
        expectTranslateBody({
            ...baseBody,
            translation_memory_id: 'tm-1',
            translation_memory_threshold: '80',
        });

        await makeTranslator().translateText('abc', null, 'de', {
            translationMemory: <deepl.TranslationMemoryInfo>{ translationMemoryId: 'tm-1' },
            translationMemoryThreshold: 80,
        });
    });

    it('sends the glossary ID of a glossary and of a glossary ID string', async () => {
        expectTranslateBody({ ...baseBody, source_lang: 'en', glossary_id: 'g-1' });
        expectTranslateBody({ ...baseBody, source_lang: 'en', glossary_id: 'g-2' });
        const translator = makeTranslator();

        await translator.translateText('abc', 'en', 'de', {
            glossary: <deepl.GlossaryInfo>{ glossaryId: 'g-1' },
        });
        await translator.translateText('abc', 'en', 'de', { glossary: 'g-2' });
    });

    it('sends glossaryIds as one comma-separated parameter', async () => {
        expectTranslateBody({ ...baseBody, source_lang: 'en', glossary_ids: 'g-1,g-2' });

        await makeTranslator().translateText('abc', 'en', 'de', {
            glossaryIds: ['g-1', <deepl.GlossaryInfo>{ glossaryId: 'g-2' }],
        });
    });

    it('sends extraRequestParameters, which override standard parameters', async () => {
        expectTranslateBody({ ...baseBody, target_lang: 'fr', 'my-extra-parameter': 'v' });

        await makeTranslator().translateText('abc', null, 'de', {
            extraRequestParameters: { target_lang: 'fr', 'my-extra-parameter': 'v' },
        });
    });

    it('sends the request to __path when it is set', async () => {
        nock(serverUrl).post('/v2/translate_secondary', baseBody).reply(200, translation);

        await makeTranslator().translateText('abc', null, 'de', {
            __path: '/v2/translate_secondary',
        });
    });

    it.each([[''], [[''] as unknown as string], [['ok', ''] as unknown as string]])(
        'throws DeepLError when a text is empty: %p',
        async (texts) => {
            await expect(makeTranslator().translateText(texts, null, 'de')).rejects.toThrow(
                /texts parameter/,
            );
        },
    );

    it('throws DeepLError when the target language is empty', async () => {
        await expect(
            makeTranslator().translateText('abc', null, <deepl.TargetLanguageCode>''),
        ).rejects.toThrow(deepl.DeepLError);
    });

    it('throws DeepLError when glossary and glossaryIds are both set', async () => {
        await expect(
            makeTranslator().translateText('abc', 'en', 'de', {
                glossary: 'g-1',
                glossaryIds: ['g-2'],
            }),
        ).rejects.toThrow(/cannot be used together/);
    });

    it('throws DeepLError when more than 5 glossaryIds are set', async () => {
        await expect(
            makeTranslator().translateText('abc', 'en', 'de', {
                glossaryIds: ['1', '2', '3', '4', '5', '6'],
            }),
        ).rejects.toThrow(/at most 5/);
    });

    it.each([
        ['glossary', { glossary: 'g-1' }],
        ['glossaryIds', { glossaryIds: ['g-1'] }],
    ])('throws DeepLError when %s is set without a source language', async (_, options) => {
        await expect(makeTranslator().translateText('abc', null, 'de', options)).rejects.toThrow(
            /sourceLang is required/,
        );
    });

    it('throws DeepLError when translationMemoryThreshold is set without a translation memory', async () => {
        await expect(
            makeTranslator().translateText('abc', null, 'de', {
                translationMemoryThreshold: 80,
            }),
        ).rejects.toThrow(/requires translationMemory/);
    });

    it.each([[-1], [101]])(
        'throws DeepLError when translationMemoryThreshold is %i',
        async (translationMemoryThreshold) => {
            await expect(
                makeTranslator().translateText('abc', null, 'de', {
                    translationMemory: 'tm-1',
                    translationMemoryThreshold,
                }),
            ).rejects.toThrow(/between 0 and 100/);
        },
    );

    it('throws DeepLError when the response is not valid JSON', async () => {
        nock(serverUrl).post('/v2/translate').reply(200, 'not json');

        await expect(makeTranslator().translateText('abc', null, 'de')).rejects.toThrow(
            /Error parsing response JSON/,
        );
    });
});
