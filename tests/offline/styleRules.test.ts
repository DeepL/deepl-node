// Copyright 2025 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import * as deepl from 'deepl-node';

import nock from 'nock';

import { makeOfflineDeeplClient, offlineServerUrl } from '../core';

const styleRuleReply = {
    style_id: 's-1',
    name: 'my rule',
    creation_time: '2025-01-02T03:04:05Z',
    updated_time: '2025-01-03T03:04:05Z',
    language: 'en',
    version: 2,
};

const instructionReply = { id: 'i-1', label: 'Label', prompt: 'Prompt', source_language: 'de' };

describe('DeepLClient.getAllStyleRules', () => {
    it('sends no query by default and parses the style rules', async () => {
        nock(offlineServerUrl, { reqheaders: { authorization: 'DeepL-Auth-Key k' } })
            .get('/v3/style_rules')
            .query({})
            .reply(200, { style_rules: [styleRuleReply] });

        const styleRules = await makeOfflineDeeplClient().getAllStyleRules();

        expect(styleRules).toEqual([
            {
                styleId: 's-1',
                name: 'my rule',
                creationTime: new Date('2025-01-02T03:04:05Z'),
                updatedTime: new Date('2025-01-03T03:04:05Z'),
                language: 'en',
                version: 2,
                configuredRules: undefined,
                customInstructions: undefined,
            },
        ]);
    });

    it('sends page, page_size and detailed and parses configured rules and instructions', async () => {
        nock(offlineServerUrl)
            .get('/v3/style_rules')
            .query({ page: '0', page_size: '10', detailed: 'true' })
            .reply(200, {
                style_rules: [
                    {
                        ...styleRuleReply,
                        configured_rules: { dates_and_times: { calendar_era: 'use_bc_and_ad' } },
                        custom_instructions: [instructionReply],
                    },
                ],
            });

        const [styleRule] = await makeOfflineDeeplClient().getAllStyleRules(0, 10, true);

        expect(styleRule.configuredRules?.datesAndTimes).toEqual({ calendar_era: 'use_bc_and_ad' });
        expect(styleRule.customInstructions).toEqual([
            { id: 'i-1', label: 'Label', prompt: 'Prompt', sourceLanguage: 'de' },
        ]);
    });
});

describe('DeepLClient.createStyleRule', () => {
    it('sends the style rule as JSON and parses the result', async () => {
        const body = {
            name: 'my rule',
            language: 'en',
            configured_rules: { dates_and_times: { calendar_era: 'use_bc_and_ad' } },
            custom_instructions: [{ label: 'Label', prompt: 'Prompt', source_language: 'de' }],
        };
        nock(offlineServerUrl, { reqheaders: { 'content-type': 'application/json' } })
            .post('/v3/style_rules', body)
            .reply(201, styleRuleReply);

        const styleRule = await makeOfflineDeeplClient().createStyleRule(body);

        expect(styleRule.styleId).toBe('s-1');
    });

    it.each([
        ['name', { name: '', language: 'en' }],
        ['language', { name: 'n', language: '' }],
    ])('throws ArgumentError when %s is empty', async (_, styleRule) => {
        await expect(makeOfflineDeeplClient().createStyleRule(styleRule)).rejects.toThrow(
            deepl.ArgumentError,
        );
    });
});

describe('DeepLClient.getStyleRule', () => {
    it('requests the style rule by ID, URL-encoded', async () => {
        nock(offlineServerUrl).get('/v3/style_rules/a%2Fb').reply(200, styleRuleReply);

        const styleRule = await makeOfflineDeeplClient().getStyleRule('a/b');

        expect(styleRule.styleId).toBe('s-1');
    });
});

describe('DeepLClient.updateStyleRuleName', () => {
    it('sends the new name as JSON with PATCH', async () => {
        nock(offlineServerUrl)
            .patch('/v3/style_rules/s-1', { name: 'new name' })
            .reply(200, { ...styleRuleReply, name: 'new name' });

        const styleRule = await makeOfflineDeeplClient().updateStyleRuleName('s-1', 'new name');

        expect(styleRule.name).toBe('new name');
    });
});

describe('DeepLClient.deleteStyleRule', () => {
    it('sends DELETE for the style rule ID', async () => {
        nock(offlineServerUrl).delete('/v3/style_rules/s-1').reply(204);

        await makeOfflineDeeplClient().deleteStyleRule('s-1');
    });
});

describe('DeepLClient.updateStyleRuleConfiguredRules', () => {
    it('sends the configured rules as JSON with PUT', async () => {
        const rules = { dates_and_times: { calendar_era: 'use_bc_and_ad' } };
        nock(offlineServerUrl)
            .put('/v3/style_rules/s-1/configured_rules', rules)
            .reply(200, { ...styleRuleReply, configured_rules: rules });

        const styleRule = await makeOfflineDeeplClient().updateStyleRuleConfiguredRules(
            's-1',
            rules,
        );

        expect(styleRule.configuredRules?.datesAndTimes).toEqual(rules.dates_and_times);
    });
});

describe('DeepLClient custom instructions', () => {
    const instruction = { label: 'Label', prompt: 'Prompt', source_language: 'de' };

    it('createStyleRuleCustomInstruction sends the instruction as JSON and parses the result', async () => {
        nock(offlineServerUrl)
            .post('/v3/style_rules/s-1/custom_instructions', instruction)
            .reply(201, instructionReply);

        const result = await makeOfflineDeeplClient().createStyleRuleCustomInstruction(
            's-1',
            instruction,
        );

        expect(result).toEqual({
            id: 'i-1',
            label: 'Label',
            prompt: 'Prompt',
            sourceLanguage: 'de',
        });
    });

    it('getStyleRuleCustomInstruction requests the instruction by ID, URL-encoded', async () => {
        nock(offlineServerUrl)
            .get('/v3/style_rules/a%2Fb/custom_instructions/i%2F1')
            .reply(200, instructionReply);

        await makeOfflineDeeplClient().getStyleRuleCustomInstruction('a/b', 'i/1');
    });

    it('updateStyleRuleCustomInstruction sends the instruction as JSON with PUT', async () => {
        nock(offlineServerUrl)
            .put('/v3/style_rules/s-1/custom_instructions/i-1', instruction)
            .reply(200, instructionReply);

        await makeOfflineDeeplClient().updateStyleRuleCustomInstruction('s-1', 'i-1', instruction);
    });

    it('deleteStyleRuleCustomInstruction sends DELETE for the instruction ID', async () => {
        nock(offlineServerUrl).delete('/v3/style_rules/s-1/custom_instructions/i-1').reply(204);

        await makeOfflineDeeplClient().deleteStyleRuleCustomInstruction('s-1', 'i-1');
    });
});

describe('DeepLClient style rule methods that validate their arguments', () => {
    const client = () => makeOfflineDeeplClient();
    const ok = { label: 'L', prompt: 'P' };

    it.each([
        ['getStyleRule', () => client().getStyleRule('')],
        ['updateStyleRuleName without ID', () => client().updateStyleRuleName('', 'n')],
        ['updateStyleRuleName without name', () => client().updateStyleRuleName('s', '')],
        ['deleteStyleRule', () => client().deleteStyleRule('')],
        ['updateStyleRuleConfiguredRules', () => client().updateStyleRuleConfiguredRules('', {})],
        [
            'createStyleRuleCustomInstruction without ID',
            () => client().createStyleRuleCustomInstruction('', ok),
        ],
        [
            'createStyleRuleCustomInstruction without label',
            () => client().createStyleRuleCustomInstruction('s', { ...ok, label: '' }),
        ],
        [
            'createStyleRuleCustomInstruction without prompt',
            () => client().createStyleRuleCustomInstruction('s', { ...ok, prompt: '' }),
        ],
        [
            'getStyleRuleCustomInstruction without ID',
            () => client().getStyleRuleCustomInstruction('', 'i'),
        ],
        [
            'getStyleRuleCustomInstruction without instruction ID',
            () => client().getStyleRuleCustomInstruction('s', ''),
        ],
        [
            'updateStyleRuleCustomInstruction without ID',
            () => client().updateStyleRuleCustomInstruction('', 'i', ok),
        ],
        [
            'updateStyleRuleCustomInstruction without instruction ID',
            () => client().updateStyleRuleCustomInstruction('s', '', ok),
        ],
        [
            'updateStyleRuleCustomInstruction without label',
            () => client().updateStyleRuleCustomInstruction('s', 'i', { ...ok, label: '' }),
        ],
        [
            'updateStyleRuleCustomInstruction without prompt',
            () => client().updateStyleRuleCustomInstruction('s', 'i', { ...ok, prompt: '' }),
        ],
        [
            'deleteStyleRuleCustomInstruction without ID',
            () => client().deleteStyleRuleCustomInstruction('', 'i'),
        ],
        [
            'deleteStyleRuleCustomInstruction without instruction ID',
            () => client().deleteStyleRuleCustomInstruction('s', ''),
        ],
    ])('%s throws ArgumentError', async (_, call) => {
        await expect(call()).rejects.toThrow(deepl.ArgumentError);
    });
});
