// Copyright 2025 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import nock from 'nock';

import { makeTranslator, serverUrl } from './client';

describe('Translator.getUsage', () => {
    it('parses character, document and team document usage', async () => {
        nock(serverUrl).get('/v2/usage').reply(200, {
            character_count: 10,
            character_limit: 100,
            document_count: 1,
            document_limit: 5,
            team_document_count: 2,
            team_document_limit: 50,
        });

        const usage = await makeTranslator().getUsage();

        expect(usage.character).toMatchObject({ count: 10, limit: 100 });
        expect(usage.document).toMatchObject({ count: 1, limit: 5 });
        expect(usage.teamDocument).toMatchObject({ count: 2, limit: 50 });
        expect(usage.anyLimitReached()).toBe(false);
        expect(usage.toString()).toBe(
            'Usage this billing period:\nCharacters: 10 of 100\nDocuments: 1 of 5\nTeam documents: 2 of 50',
        );
    });

    it('leaves out the usage types that the response does not contain', async () => {
        nock(serverUrl)
            .get('/v2/usage')
            .reply(200, { team_document_count: 1, team_document_limit: 1 });

        const usage = await makeTranslator().getUsage();

        expect([usage.character, usage.document]).toEqual([undefined, undefined]);
        expect(usage.teamDocument?.limitReached()).toBe(true);
        expect(usage.anyLimitReached()).toBe(true);
    });

    it('leaves out the usage types whose count or limit is not a number', async () => {
        nock(serverUrl).get('/v2/usage').reply(200, {
            character_count: null,
            character_limit: 100,
            document_count: '1',
            document_limit: 5,
            team_document_count: 2,
            team_document_limit: 50,
        });

        const usage = await makeTranslator().getUsage();

        expect([usage.character, usage.document]).toEqual([undefined, undefined]);
        expect(usage.teamDocument).toMatchObject({ count: 2, limit: 50 });
        expect(usage.anyLimitReached()).toBe(false);
        expect(usage.toString()).toBe('Usage this billing period:\nTeam documents: 2 of 50');
    });

    it('parses the API Pro usage fields', async () => {
        nock(serverUrl)
            .get('/v2/usage')
            .reply(200, {
                character_count: 180118,
                character_limit: 1250000,
                products: [
                    {
                        product_type: 'write',
                        billing_unit: 'characters',
                        api_key_unit_count: 0,
                        account_unit_count: 5643,
                        api_key_character_count: 0,
                        character_count: 5643,
                    },
                    {
                        product_type: 'speechToText',
                        billing_unit: 'minutes',
                        api_key_unit_count: 7,
                        account_unit_count: 30,
                    },
                ],
                api_key_character_count: 636,
                api_key_character_limit: 1000000000000,
                speech_to_text_milliseconds_count: 0,
                speech_to_text_milliseconds_limit: 0,
                speech_to_text_minutes_count: 30,
                speech_to_text_minutes_limit: 600,
                speech_to_speech_minutes_count: 12,
                speech_to_speech_minutes_limit: 600,
                start_time: '2025-05-13T09:18:42Z',
                end_time: '2025-06-13T09:18:42Z',
            });

        const usage = await makeTranslator().getUsage();

        expect(usage.character).toMatchObject({ count: 180118, limit: 1250000 });
        expect(usage.apiKeyCharacter).toMatchObject({ count: 636, limit: 1000000000000 });
        expect(usage.speechToTextMinutes).toMatchObject({ count: 30, limit: 600 });
        expect(usage.speechToSpeechMinutes).toMatchObject({ count: 12, limit: 600 });
        expect(usage.products).toEqual([
            {
                productType: 'write',
                billingUnit: 'characters',
                apiKeyUnitCount: 0,
                accountUnitCount: 5643,
            },
            {
                productType: 'speechToText',
                billingUnit: 'minutes',
                apiKeyUnitCount: 7,
                accountUnitCount: 30,
            },
        ]);
        expect(usage.startTime).toEqual(new Date('2025-05-13T09:18:42Z'));
        expect(usage.endTime).toEqual(new Date('2025-06-13T09:18:42Z'));
        expect(usage.anyLimitReached()).toBe(false);
        expect(usage.toString()).toBe('Usage this billing period:\nCharacters: 180118 of 1250000');
    });

    it('leaves the API Pro fields undefined for a Free response', async () => {
        nock(serverUrl).get('/v2/usage').reply(200, { character_count: 10, character_limit: 100 });

        const usage = await makeTranslator().getUsage();

        expect(usage.character).toMatchObject({ count: 10, limit: 100 });
        expect([
            usage.apiKeyCharacter,
            usage.speechToTextMinutes,
            usage.speechToSpeechMinutes,
            usage.products,
            usage.startTime,
            usage.endTime,
        ]).toEqual([undefined, undefined, undefined, undefined, undefined, undefined]);
        expect(usage.toString()).toBe('Usage this billing period:\nCharacters: 10 of 100');
    });

    it('ignores malformed API Pro fields', async () => {
        nock(serverUrl)
            .get('/v2/usage')
            .reply(200, {
                character_count: 10,
                character_limit: 100,
                start_time: 'not a timestamp',
                end_time: 42,
                products: [{ product_type: 'translate' }],
            });

        const usage = await makeTranslator().getUsage();

        expect(usage.character).toMatchObject({ count: 10, limit: 100 });
        expect([usage.startTime, usage.endTime]).toEqual([undefined, undefined]);
        expect(usage.products).toEqual([
            { productType: 'translate', billingUnit: '', apiKeyUnitCount: 0, accountUnitCount: 0 },
        ]);
    });
});
