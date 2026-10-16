// Copyright 2025 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import { makeDeeplClient } from './client';
import { getUniqueName, testTimeout } from './helpers';

describe('DeepLClient style rules', () => {
    it(
        'sends the style rule requests: create, get, list, rename, configure, custom instructions and delete',
        async () => {
            const client = makeDeeplClient();
            const name = getUniqueName('styleRule');
            const rules = { dates_and_times: { calendar_era: 'use_bc_and_ad' } };

            const styleRule = await client.createStyleRule({
                name,
                language: 'en',
                configured_rules: rules,
                custom_instructions: [
                    { label: 'Init', prompt: 'Be formal', source_language: 'de' },
                ],
            });
            const styleId = styleRule.styleId;
            try {
                expect(styleRule.name).toBe(name);
                expect(styleRule.language).toBe('en');
                expect(styleRule.creationTime).toBeInstanceOf(Date);

                const fetched = await client.getStyleRule(styleId);
                expect(fetched.styleId).toBe(styleId);
                expect(fetched.name).toBe(name);

                let listed = false;
                for (let page = 0; !listed && page < 20; page++) {
                    const styleRules = await client.getAllStyleRules(page, 25, true);
                    if (styleRules.length === 0) break;
                    listed = styleRules.some((rule) => rule.styleId === styleId);
                }
                expect(listed).toBe(true);

                const renamed = await client.updateStyleRuleName(styleId, `${name}-renamed`);
                expect(renamed.name).toBe(`${name}-renamed`);

                const configured = await client.updateStyleRuleConfiguredRules(styleId, rules);
                expect(configured.styleId).toBe(styleId);

                const instruction = await client.createStyleRuleCustomInstruction(styleId, {
                    label: 'Label',
                    prompt: 'Prompt',
                    source_language: 'de',
                });
                const instructionId = instruction.id as string;
                expect(instructionId).toEqual(expect.any(String));
                expect(instruction.label).toBe('Label');

                const fetchedInstruction = await client.getStyleRuleCustomInstruction(
                    styleId,
                    instructionId,
                );
                expect(fetchedInstruction.prompt).toBe('Prompt');

                const updatedInstruction = await client.updateStyleRuleCustomInstruction(
                    styleId,
                    instructionId,
                    { label: 'New Label', prompt: 'New Prompt', source_language: 'en' },
                );
                expect(updatedInstruction.label).toBe('New Label');

                await client.deleteStyleRuleCustomInstruction(styleId, instructionId);
            } finally {
                await client.deleteStyleRule(styleId).catch(() => undefined);
            }
        },
        testTimeout,
    );
});
