// Copyright 2022 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import * as deepl from 'deepl-node';
import { TranslateTextOptions } from 'deepl-node';

import fs from 'fs';

import nock from 'nock';

import {
    appendTextsAndReturnIsSingular,
    validateAndAppendTextOptions,
    nonRegionalLanguageCode,
    buildURLSearchParams,
    isFreeAccountAuthKey,
    isString,
    logInfo,
    streamToBuffer,
    streamToString,
    timeout,
} from './../src/utils';

import {
    exampleText,
    tempFiles,
    withMockServer,
    withMockProxyServer,
    makeTranslator,
    makeDeeplClient,
    proxyConfig,
    urlToMockRegexp,
    withRealServer,
} from './core';

const serverUrl = process.env.DEEPL_SERVER_URL;

describe('general', () => {
    it('rejects empty authKey', () => {
        expect(() => new deepl.Translator('', { serverUrl })).toThrow(/authKey.*empty/);
    });

    it('rejects invalid authKey', async () => {
        const translator = new deepl.Translator('invalid', { serverUrl });
        await expect(translator.getUsage()).rejects.toThrowError(deepl.AuthorizationError);
    });

    it('gives correct example translations across all languages', () => {
        const translator = makeTranslator();

        const promises = [];
        for (const langCode in exampleText) {
            const inputText = exampleText[langCode];
            const sourceLang = nonRegionalLanguageCode(langCode);
            const promise = translator
                .translateText(inputText, sourceLang, 'en-US')
                // eslint-disable-next-line @typescript-eslint/no-loop-func, promise/always-return
                .then((result: deepl.TextResult) => {
                    expect(result.text.toLowerCase()).toContain('proton');
                    expect(result.billedCharacters).toBe(inputText.length);
                });
            promises.push(promise);
        }
        return Promise.all(promises);
    }, 15000);

    it('throws AuthorizationError with an invalid auth key', async () => {
        const translator = makeTranslator({ authKey: 'invalid' });
        await expect(translator.getUsage()).rejects.toThrowError(deepl.AuthorizationError);
    });

    withRealServer('handles mixed text-direction tests', async () => {
        const translator = makeTranslator();
        const options: TranslateTextOptions = { tagHandling: 'xml', ignoreTags: 'ignore' };
        const arIgnorePart = '<ignore>يجب تجاهل هذا الجزء.</ignore>';
        const enSentenceWithARIgnorePart = `<p>This is a <b>short</b> <i>sentence</i>.</p> ${arIgnorePart} This is another sentence.`;
        const enIgnorePart = '<ignore>This part should be ignored.</ignore>';
        const arSentenceWithENIgnorePart = `<p>هذه <i>جملة</i> <b>قصيرة</b>. ${enIgnorePart} هذه جملة أخرى.</p>`;

        const enResult = await translator.translateText(
            enSentenceWithARIgnorePart,
            null,
            'en-US',
            options,
        );
        expect(enResult.text).toContain(arIgnorePart);

        const arResult = await translator.translateText(
            arSentenceWithENIgnorePart,
            null,
            'ar',
            options,
        );
        expect(arResult.text).toContain(enIgnorePart);
    });

    describe('user-agent tests', () => {
        beforeAll(() => {
            nock.disableNetConnect();
        });

        it('makes requests with the correct default user-agent header', async () => {
            nock(urlToMockRegexp)
                .get('/v2/usage')
                .reply(function () {
                    const userAgentHeader = this.req.headers['user-agent']; // nock lowercases headers
                    expect(userAgentHeader).toContain('deepl-node/');
                    expect(userAgentHeader).toContain('(');
                    expect(userAgentHeader).toContain(' node/');
                    return [200, '{"character_count": 180118,"character_limit": 1250000}', {}];
                });
            const translator = makeTranslator();
            await translator.getUsage();
        });

        it('makes requests with the correct opt-in user-agent header', async () => {
            nock(urlToMockRegexp)
                .get('/v2/usage')
                .reply(function () {
                    const userAgentHeader = this.req.headers['user-agent']; // nock lowercases headers
                    expect(userAgentHeader).toContain('deepl-node/');
                    expect(userAgentHeader).toContain('(');
                    expect(userAgentHeader).toContain(' node/');
                    return [200, '{"character_count": 180118,"character_limit": 1250000}', {}];
                });
            const translator = makeTranslator({ sendPlatformInfo: true });
            await translator.getUsage();
        });

        it('makes requests with the correct opt-out user-agent header', async () => {
            nock(urlToMockRegexp)
                .get('/v2/usage')
                .reply(function () {
                    const userAgentHeader = this.req.headers['user-agent']; // nock lowercases headers
                    expect(userAgentHeader).toContain('deepl-node/');
                    expect(userAgentHeader).not.toContain('(');
                    expect(userAgentHeader).not.toContain(' node/');
                    return [200, '{"character_count": 180118,"character_limit": 1250000}', {}];
                });
            const translator = makeTranslator({ sendPlatformInfo: false });
            await translator.getUsage();
        });

        it('makes requests with the correct default user-agent header and appInfo', async () => {
            nock(urlToMockRegexp)
                .get('/v2/usage')
                .reply(function () {
                    const userAgentHeader = this.req.headers['user-agent']; // nock lowercases headers
                    expect(userAgentHeader).toContain('deepl-node/');
                    expect(userAgentHeader).toContain('(');
                    expect(userAgentHeader).toContain(' node/');
                    expect(userAgentHeader).toContain(' sampleCSApp/1.2.3');
                    return [200, '{"character_count": 180118,"character_limit": 1250000}', {}];
                });
            const translator = makeTranslator({
                appInfo: { appName: 'sampleCSApp', appVersion: '1.2.3' },
            });
            await translator.getUsage();
        });

        it('makes requests with the correct opt-in user-agent header and appInfo', async () => {
            nock(urlToMockRegexp)
                .get('/v2/usage')
                .reply(function () {
                    const userAgentHeader = this.req.headers['user-agent']; // nock lowercases headers
                    expect(userAgentHeader).toContain('deepl-node/');
                    expect(userAgentHeader).toContain('(');
                    expect(userAgentHeader).toContain(' node/');
                    expect(userAgentHeader).toContain(' sampleCSApp/1.2.3');
                    return [200, '{"character_count": 180118,"character_limit": 1250000}', {}];
                });
            const translator = makeTranslator({
                sendPlatformInfo: true,
                appInfo: { appName: 'sampleCSApp', appVersion: '1.2.3' },
            });
            await translator.getUsage();
        });

        it('makes requests with the correct opt-out user-agent header and appInfo', async () => {
            nock(urlToMockRegexp)
                .get('/v2/usage')
                .reply(function () {
                    const userAgentHeader = this.req.headers['user-agent']; // nock lowercases headers
                    expect(userAgentHeader).toContain('deepl-node/');
                    expect(userAgentHeader).not.toContain('(');
                    expect(userAgentHeader).not.toContain(' node/');
                    expect(userAgentHeader).toContain(' sampleCSApp/1.2.3');
                    return [200, '{"character_count": 180118,"character_limit": 1250000}', {}];
                });
            const translator = makeTranslator({
                sendPlatformInfo: false,
                appInfo: { appName: 'sampleCSApp', appVersion: '1.2.3' },
            });
            await translator.getUsage();
        });

        afterAll(() => {
            nock.cleanAll();
            nock.enableNetConnect();
        });
    });

    it('outputs usage', async () => {
        const translator = makeTranslator();
        const usage = await translator.getUsage();
        expect(usage.toString()).toContain('Usage this billing period');
    });

    it('lists source and target languages', async () => {
        const translator = makeTranslator();
        const sourceLanguages = await translator.getSourceLanguages();
        const targetLanguages = await translator.getTargetLanguages();

        for (const language of sourceLanguages) {
            if (language.code === 'en') {
                expect(language.name).toBe('English');
            }
            expect(language).not.toHaveProperty('supportsFormality');
            expect(language.code).toBe(language.code.toLowerCase());
        }
        expect(sourceLanguages.filter((language) => language.code === 'en').length).toBe(1);

        for (const language of targetLanguages) {
            if (language.code === 'de') {
                expect(language.supportsFormality).toBe(true);
                expect(language.name).toBe('German');
            }
            expect(language.supportsFormality).toBeDefined();
        }
        expect(targetLanguages.filter((language) => language.code === 'de').length).toBe(1);
        // Formality is not supported by every target language, so the flag must vary rather than
        // always being true (which would indicate the feature check is a no-op).
        expect(targetLanguages.some((language) => language.supportsFormality === false)).toBe(
            true,
        );
    });

    it('lists language resources', async () => {
        const deeplClient = makeDeeplClient();
        const resources = await deeplClient.getLanguageResources();
        expect(resources.length).toBeGreaterThan(0);

        for (const resource of resources) {
            expect(resource.name.length).toBeGreaterThan(0);
            for (const [featureName, feature] of Object.entries(resource.features)) {
                expect(feature.name).toBe(featureName);
                expect([undefined, true, false]).toContain(feature.needsSourceSupport);
                expect([undefined, true, false]).toContain(feature.needsTargetSupport);
            }
        }

        const translateText = resources.find((resource) => resource.name === 'translate_text');
        expect(translateText).toBeDefined();
        expect(translateText?.features.glossary?.needsSourceSupport).toBe(true);
        expect(translateText?.features.glossary?.needsTargetSupport).toBe(true);
    });

    it('lists glossary language pairs', () => {
        const translator = makeTranslator();
        return translator
            .getGlossaryLanguagePairs()
            .then((languagePairs: readonly deepl.GlossaryLanguagePair[]) => {
                expect(languagePairs.length).toBeGreaterThan(0);
                // eslint-disable-next-line promise/always-return
                for (const languagePair of languagePairs) {
                    expect(languagePair.sourceLang.length).toBeGreaterThan(0);
                    expect(languagePair.targetLang.length).toBeGreaterThan(0);
                    expect(languagePair.sourceLang).not.toBe(languagePair.targetLang);
                    expect(languagePair.sourceLang).toBe(languagePair.sourceLang.toLowerCase());
                    expect(languagePair.targetLang).toBe(languagePair.targetLang.toLowerCase());
                }
            });
    });

    it('should determine API free accounts using auth key', () => {
        expect(isFreeAccountAuthKey('0000:fx')).toBe(true);
        expect(isFreeAccountAuthKey('0000')).toBe(false);
    });

    withMockProxyServer('should support proxy usage', async () => {
        const translator = makeTranslator({
            mockServerExpectProxy: true,
            randomAuthKey: true,
        });
        const translatorWithProxy = makeTranslator({
            mockServerExpectProxy: true,
            randomAuthKey: true,
            proxy: proxyConfig,
        });

        await expect(translator.getUsage()).rejects.toThrowError(deepl.DeepLError);
        await translatorWithProxy.getUsage();
    });

    withMockServer('should throw ConnectionError with timed-out responses', async () => {
        const translator = makeTranslator({
            mockServerNoResponseTimes: 2,
            maxRetries: 0,
            minTimeout: 1000,
        });
        await expect(translator.getUsage()).rejects.toThrowError(deepl.ConnectionError);
    });

    withMockServer('should throw TooManyRequestsError with 429 responses', async () => {
        const translator = makeTranslator({
            mockServer429ResponseTimes: 2,
            maxRetries: 0,
            minTimeout: 1000,
        });
        await expect(translator.translateText(exampleText.en, null, 'de')).rejects.toThrowError(
            deepl.TooManyRequestsError,
        );
    });

    withMockServer('should give QuotaExceededError when usage limits are reached', async () => {
        const characterLimit = 20;
        const documentLimit = 1;
        const [exampleDocument, , outputDocumentPath] = tempFiles();

        const translator = makeTranslator({
            randomAuthKey: true,
            mockServerInitCharacterLimit: characterLimit,
            mockServerInitDocumentLimit: documentLimit,
        });

        let usage = await translator.getUsage();
        expect(usage.character?.limit).toBe(characterLimit);
        expect(usage.document?.limit).toBe(documentLimit);
        expect(usage.character?.limitReached()).toBe(false);
        expect(usage.document?.limitReached()).toBe(false);
        expect(usage.teamDocument).toBeUndefined();

        // Translate a document with characterLimit characters
        fs.writeFileSync(exampleDocument, 'a'.repeat(characterLimit));
        await translator.translateDocument(exampleDocument, outputDocumentPath, null, 'de');

        usage = await translator.getUsage();
        expect(usage.character?.limitReached()).toBe(true);
        expect(usage.document?.limitReached()).toBe(true);

        // Translate another document to get error
        fs.unlinkSync(outputDocumentPath);
        await expect(
            translator.translateDocument(exampleDocument, outputDocumentPath, null, 'de'),
        ).rejects.toThrowError(
            'while translating document: Quota for this billing period has been exceeded',
        );

        // Translate text raises QuotaExceededError
        await expect(translator.translateText('Test', null, 'de')).rejects.toThrowError(
            deepl.QuotaExceededError,
        );
    });

    withMockServer(
        'should give QuotaExceededError when team document usage limits are reached',
        async () => {
            const characterLimit = 20;
            const documentLimit = 0;
            const teamDocumentLimit = 1;
            const [exampleDocument, , outputDocumentPath] = tempFiles();

            const translator = makeTranslator({
                randomAuthKey: true,
                mockServerInitCharacterLimit: characterLimit,
                mockServerInitDocumentLimit: documentLimit,
                mockServerInitTeamDocumentLimit: teamDocumentLimit,
            });

            let usage = await translator.getUsage();
            expect(usage.character?.limit).toBe(characterLimit);
            expect(usage.character?.limitReached()).toBe(false);
            expect(usage.document).toBeUndefined();
            expect(usage.teamDocument?.limit).toBe(teamDocumentLimit);
            expect(usage.teamDocument?.limitReached()).toBe(false);

            // Translate a document with characterLimit characters
            fs.writeFileSync(exampleDocument, 'a'.repeat(characterLimit));
            await translator.translateDocument(exampleDocument, outputDocumentPath, null, 'de');

            usage = await translator.getUsage();
            expect(usage.character?.limitReached()).toBe(true);
            expect(usage.teamDocument?.limitReached()).toBe(true);

            // Translate another document to get error
            fs.unlinkSync(outputDocumentPath);
            await expect(
                translator.translateDocument(exampleDocument, outputDocumentPath, null, 'de'),
            ).rejects.toThrowError(
                'while translating document: Quota for this billing period has been exceeded',
            );

            // Translate text raises QuotaExceededError
            await expect(translator.translateText('Test', null, 'de')).rejects.toThrowError(
                deepl.QuotaExceededError,
            );
        },
    );

    withMockServer('should give QuotaExceededError when usage limits are reached', async () => {
        const teamDocumentLimit = 1;
        const [exampleDocument, , outputDocumentPath] = tempFiles();

        const translator = makeTranslator({
            randomAuthKey: true,
            mockServerInitCharacterLimit: 0,
            mockServerInitDocumentLimit: 0,
            mockServerInitTeamDocumentLimit: teamDocumentLimit,
        });

        let usage = await translator.getUsage();
        expect(usage.character).toBeUndefined();
        expect(usage.document).toBeUndefined();
        expect(usage.teamDocument?.limit).toBe(teamDocumentLimit);
        expect(usage.teamDocument?.limitReached()).toBe(false);

        await translator.translateDocument(exampleDocument, outputDocumentPath, null, 'de');

        usage = await translator.getUsage();
        expect(usage.anyLimitReached()).toBe(true);
        expect(usage.character).toBeUndefined();
        expect(usage.document).toBeUndefined();
        expect(usage.teamDocument?.limitReached()).toBe(true);

        // Translate another document to get error
        fs.unlinkSync(outputDocumentPath);
        await expect(
            translator.translateDocument(exampleDocument, outputDocumentPath, null, 'de'),
        ).rejects.toThrowError(
            'while translating document: Quota for this billing period has been exceeded',
        );
    });
});
