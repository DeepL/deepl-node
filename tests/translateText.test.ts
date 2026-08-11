// Copyright 2022 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import * as deepl from 'deepl-node';

import nock from 'nock';

import {
    exampleText,
    makeTranslator,
    testTimeout,
    urlToMockRegexp,
    withMockServer,
    withRealServer,
} from './core';
import { ModelType, QuotaExceededError, TranslateTextOptions } from 'deepl-node';

describe('translate text', () => {
    it('should translate a single text', async () => {
        const translator = makeTranslator();
        const result = await translator.translateText(exampleText.en, null, 'de');
        expect(result.text).toBe(exampleText.de);
        expect(result.detectedSourceLang).toBe('en');
        expect(result.billedCharacters).toBe(exampleText.en.length);
    });

    it.each([['quality_optimized'], ['latency_optimized'], ['prefer_quality_optimized']])(
        'should translate using model_type = %s',
        async (modelTypeStr) => {
            const translator = makeTranslator();
            const modelType = modelTypeStr as ModelType;
            const result = await translator.translateText(exampleText.en, 'en', 'de', {
                modelType: modelType,
            });
            expect(result.modelTypeUsed).toBeTruthy();
        },
    );

    it('should translate an array of texts', async () => {
        const translator = makeTranslator();
        const result = await translator.translateText([exampleText.fr, exampleText.en], null, 'de');
        expect(result[0].text).toBe(exampleText.de);
        expect(result[0].detectedSourceLang).toBe('fr');
        expect(result[1].text).toBe(exampleText.de);
        expect(result[1].detectedSourceLang).toBe('en');
    });

    it('should accept language codes in any case', async () => {
        const translator = makeTranslator();
        let result = await translator.translateText(exampleText.en, 'en', 'de');
        expect(result.text).toBe(exampleText.de);
        expect(result.detectedSourceLang).toBe('en');

        const sourceLangEn = <deepl.SourceLanguageCode>'eN'; // Type cast to silence type-checks
        const targetLangDe = <deepl.TargetLanguageCode>'De'; // Type cast to silence type-checks
        result = await translator.translateText(exampleText.en, sourceLangEn, targetLangDe);
        expect(result.text).toBe(exampleText.de);
        expect(result.detectedSourceLang).toBe('en');
    });

    withMockServer('should translate using overridden path', async () => {
        const translator = makeTranslator();
        const result = await translator.translateText(exampleText.en, null, 'de', {
            __path: '/v2/translate_secondary',
        });
        expect(result.text).toBe(exampleText.de);
        expect(result.detectedSourceLang).toBe('en');
        expect(result.billedCharacters).toBe(exampleText.en.length);
    });

    it('should reject deprecated target codes', async () => {
        const translator = makeTranslator();

        const targetLangEn = <deepl.TargetLanguageCode>'en'; // Type cast to silence type-checks
        await expect(translator.translateText(exampleText.de, null, targetLangEn)).rejects.toThrow(
            /deprecated/,
        );

        const targetLangPt = <deepl.TargetLanguageCode>'pt'; // Type cast to silence type-checks
        await expect(translator.translateText(exampleText.de, null, targetLangPt)).rejects.toThrow(
            /deprecated/,
        );
    });

    it('should reject invalid language codes', async () => {
        const translator = makeTranslator();

        const sourceLangInvalid = <deepl.SourceLanguageCode>'xx'; // Type cast to silence type-checks
        await expect(
            translator.translateText(exampleText.de, sourceLangInvalid, 'en-US'),
        ).rejects.toThrow('source_lang');

        const targetLangInvalid = <deepl.TargetLanguageCode>'xx'; // Type cast to silence type-checks
        await expect(
            translator.translateText(exampleText.de, null, targetLangInvalid),
        ).rejects.toThrow('target_lang');
    });

    it('should reject empty texts', async () => {
        const translator = makeTranslator();
        await expect(translator.translateText('', null, 'de')).rejects.toThrow('texts parameter');
        await expect(translator.translateText([''], null, 'de')).rejects.toThrow('texts parameter');
    });

    withMockServer('should retry 429s with delay', async () => {
        const translator = makeTranslator({ mockServer429ResponseTimes: 2 });
        const timeBefore = Date.now();
        await translator.translateText(exampleText.en, null, 'de');
        const timeAfter = Date.now();
        // Elapsed time should be at least 1 second
        expect(timeAfter - timeBefore).toBeGreaterThan(1000);
    });

    withRealServer(
        'should translate with formality',
        async () => {
            const translator = makeTranslator();
            const input = 'How are you?';
            const formal = 'Ihnen'; // Wie geht es Ihnen?
            const informal = 'dir'; // Wie geht es dir?
            // Default formality is automatic, so the output may be either formal or informal
            const defaultResult = (await translator.translateText(input, null, 'de')).text;
            expect(defaultResult.includes(formal) || defaultResult.includes(informal)).toBe(true);
            expect(
                (await translator.translateText(input, null, 'de', { formality: 'less' })).text,
            ).toContain(informal);
            const defaultExplicitResult = (
                await translator.translateText(input, null, 'de', { formality: 'default' })
            ).text;
            expect(
                defaultExplicitResult.includes(formal) || defaultExplicitResult.includes(informal),
            ).toBe(true);
            expect(
                (await translator.translateText(input, null, 'de', { formality: 'more' })).text,
            ).toContain(formal);

            const formalityLess = <deepl.Formality>'LESS'; // Type cast to silence type-checks
            expect(
                (await translator.translateText(input, null, 'de', { formality: formalityLess }))
                    .text,
            ).toContain(informal);

            const formalityDefault = <deepl.Formality>'DEFAULT'; // Type cast to silence type-checks
            const formalityDefaultResult = (
                await translator.translateText(input, null, 'de', { formality: formalityDefault })
            ).text;
            expect(
                formalityDefaultResult.includes(formal) ||
                    formalityDefaultResult.includes(informal),
            ).toBe(true);

            const formalityMore = <deepl.Formality>'MORE'; // Type cast to silence type-checks
            expect(
                (await translator.translateText(input, null, 'de', { formality: formalityMore }))
                    .text,
            ).toContain(formal);

            expect(
                (await translator.translateText(input, null, 'de', { formality: 'prefer_less' }))
                    .text,
            ).toContain(informal);
            expect(
                (await translator.translateText(input, null, 'de', { formality: 'prefer_more' }))
                    .text,
            ).toContain(formal);

            // Using prefer_* with a language that does not support formality is not an error
            await translator.translateText(input, null, 'tr', { formality: 'prefer_more' });
            await expect(
                translator.translateText(input, null, 'tr', { formality: 'more' }),
            ).rejects.toThrow('formality');
        },
        testTimeout,
    );

    it('should reject invalid formality', async () => {
        const translator = makeTranslator();
        const invalidFormality = <deepl.Formality>'invalid'; // Type cast to silence type-checks
        await expect(
            translator.translateText('Test', null, 'de', { formality: invalidFormality }),
        ).rejects.toThrow('formality');
    });

    it('should translate with split sentences', async () => {
        const translator = makeTranslator();
        const input = 'The firm said it had been\nconducting an internal investigation.';
        await translator.translateText(input, null, 'de', { splitSentences: 'off' });
        await translator.translateText(input, null, 'de', { splitSentences: 'on' });
        await translator.translateText(input, null, 'de', { splitSentences: 'nonewlines' });
        await translator.translateText(input, null, 'de', { splitSentences: 'default' });

        // Invalid sentence splitting modes are rejected
        const invalidSplitSentences = <deepl.SentenceSplittingMode>'invalid'; // Type cast to silence type-checks
        await expect(
            translator.translateText(input, null, 'de', { splitSentences: invalidSplitSentences }),
        ).rejects.toThrow('split_sentences');
    });

    it('should translate with preserve formatting', async () => {
        const translator = makeTranslator();
        const input = exampleText.en;
        await translator.translateText(input, null, 'de', { preserveFormatting: false });
        await translator.translateText(input, null, 'de', { preserveFormatting: true });
    });

    it('should translate with tag_handling option', async () => {
        const text =
            '\
     <!DOCTYPE html>\n\
     <html>\n\
       <body>\n\
         <p>This is an example sentence.</p>\n\
     </body>\n\
     </html>';
        const translator = makeTranslator();
        // Note: this test may use the mock server that will not translate the text,
        // therefore we do not check the translated result.
        await translator.translateText(text, null, 'de', { tagHandling: 'xml' });
        await translator.translateText(text, null, 'de', { tagHandling: 'html' });
    });

    it('should translate with tag_handling_version option', async () => {
        const text = '<p>Hello world</p>';
        const translator = makeTranslator();
        // Test with v1
        const resultV1 = await translator.translateText(text, null, 'de', {
            tagHandling: 'html',
            tagHandlingVersion: 'v1',
        });
        expect(resultV1.text).toBeTruthy();
        expect(resultV1.detectedSourceLang).toBe('en');

        // Test with v2
        const resultV2 = await translator.translateText(text, null, 'de', {
            tagHandling: 'html',
            tagHandlingVersion: 'v2',
        });
        expect(resultV2.text).toBeTruthy();
        expect(resultV2.detectedSourceLang).toBe('en');
    });

    it('should translate with context option', async () => {
        const translator = makeTranslator();
        const text = 'Das ist scharf!';
        // In German, "scharf" can mean:
        // - spicy/hot when referring to food, or
        // - sharp when referring to other objects such as a knife (Messer).
        await translator.translateText(text, null, 'en-US');
        // Result: "That is hot!"
        await translator.translateText(text, null, 'en-US', { context: 'Das ist ein Messer' });
        // Result: "That is sharp!"
    });

    withRealServer('should translate using specified XML tags', async () => {
        const translator = makeTranslator();
        const text =
            "\
<document>\n\
    <meta>\n\
        <title>A document's title</title>\n\
    </meta>\n\
    <content>\n\
        <par>\n\
            <span>This is a sentence split</span><span>across two &lt;span&gt; tags that should be treated as one.</span>\n\
        </par>\n\
        <par>Here is a sentence. Followed by a second one.</par>\n\
        <raw>This sentence will not be translated.</raw>\n\
    </content>\n\
</document>";
        const result = await translator.translateText(text, null, 'de', {
            tagHandling: 'xml',
            outlineDetection: false,
            nonSplittingTags: 'span',
            splittingTags: ['title', 'par'],
            ignoreTags: ['raw'],
        });
        expect(result.text).toContain('<raw>This sentence will not be translated.</raw>');
        expect(result.text).toContain('<title>Der Titel');
    });

    withRealServer('should translate using specified HTML tags', async () => {
        const translator = makeTranslator();
        const text =
            '\
<!DOCTYPE html>\n\
<html>\n\
  <body>\n\
    <h1>My First Heading</h1>\n\
    <p translate="no">My first paragraph.</p>\n\
  </body>\n\
</html>';

        const result = await translator.translateText(text, null, 'de', { tagHandling: 'html' });

        expect(result.text).toContain('<h1>Meine erste Überschrift</h1>');
        expect(result.text).toContain('<p translate="no">My first paragraph.</p>');
    });

    it('allows extra parameters to override standard parameters', async () => {
        const translator = makeTranslator();
        const options: TranslateTextOptions = {
            extraRequestParameters: { target_lang: 'fr', example_extra_param: 'true' },
        };
        const result = await translator.translateText(exampleText.en, null, 'de', options);
        expect(result.text).toBe(exampleText.fr);
        expect(result.detectedSourceLang).toBe('en');
        expect(result.billedCharacters).toBe(exampleText.en.length);
    });

    withRealServer('should translate with custom instructions', async () => {
        const translator = makeTranslator();
        const text = 'Hello world. I am testing if custom instructions are working correctly.';
        // Assert the instruction was applied, rather than that the output merely differs from an
        // unconstrained translation. This previously used 'Use informal language' / 'Be concise'
        // and compared against a translation made without instructions, but the default
        // translation of this sentence is already informal and concise, so the API legitimately
        // returned identical text and the comparison drifted with the model.
        const result = await translator.translateText(text, null, 'de', {
            customInstructions: ['Render the whole text in ALL CAPS'],
        });
        expect(result.text).toBeTruthy();
        expect(result.detectedSourceLang).toBe('en');
        expect(result.text).toBe(result.text.toUpperCase());
    });

    it('should translate with empty custom instructions array', async () => {
        const translator = makeTranslator();
        const result = await translator.translateText(exampleText.en, null, 'de', {
            customInstructions: [],
        });
        expect(result.text).toBe(exampleText.de);
    });

    describe('request parameter tests', () => {
        beforeAll(() => {
            nock.disableNetConnect();
        });

        it('sends extra request parameters', async () => {
            nock(urlToMockRegexp)
                .post('/v2/translate', function (body) {
                    expect(body['my-extra-parameter']).toBe('my-extra-value');
                    return true;
                })
                .reply(456);
            const translator = makeTranslator();
            const options: TranslateTextOptions = {
                extraRequestParameters: { 'my-extra-parameter': 'my-extra-value' },
            };
            await expect(translator.translateText('test', null, 'de', options)).rejects.toThrow(
                QuotaExceededError,
            );
        });
    });
});
