// Copyright 2025 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.
import * as deepl from 'deepl-node';
import fs from 'fs';
import {
    exampleText,
    makeDeeplClient,
    makeTranslator,
    tempFiles,
    testTimeout,
    withMockServer,
} from './core';

describe('Style Rules Tests', () => {
    const DEFAULT_STYLE_ID = 'dca2e053-8ae5-45e6-a0d2-881156e7f4e4';

    withMockServer('test getAllStyleRules', async () => {
        const deeplClient = makeDeeplClient();
        const styleRules = await deeplClient.getAllStyleRules(0, 10, true);

        expect(Array.isArray(styleRules)).toBe(true);
        expect(styleRules.length).toBeGreaterThan(0);
        expect(styleRules[0].styleId).toBe(DEFAULT_STYLE_ID);
        expect(styleRules[0].configuredRules).toBeDefined();
        expect(styleRules[0].customInstructions).toBeDefined();
    });

    withMockServer('test getAllStyleRules without detailed', async () => {
        const deeplClient = makeDeeplClient();
        const styleRules = await deeplClient.getAllStyleRules();

        expect(Array.isArray(styleRules)).toBe(true);
        expect(styleRules.length).toBeGreaterThan(0);
        expect(styleRules[0].styleId).toBe(DEFAULT_STYLE_ID);
        expect(styleRules[0].configuredRules).toBeUndefined();
        expect(styleRules[0].customInstructions).toBeUndefined();
    });

    it(
        'test style rule CRUD',
        async () => {
            const deeplClient = makeDeeplClient();

            // Create with optional configured_rules and custom_instructions
            const rule = await deeplClient.createStyleRule({
                name: 'Test Rule',
                language: 'en',
                configured_rules: { dates_and_times: { calendar_era: 'use_bc_and_ad' } },
                custom_instructions: [
                    { label: 'Init Instruction', prompt: 'Be formal', source_language: 'de' },
                ],
            });
            expect(rule.styleId).toBeDefined();
            expect(rule.name).toBe('Test Rule');

            // Get
            const retrieved = await deeplClient.getStyleRule(rule.styleId);
            expect(retrieved.styleId).toBe(rule.styleId);

            // Update name
            const updated = await deeplClient.updateStyleRuleName(rule.styleId, 'Updated');
            expect(updated.name).toBe('Updated');

            // Update configured rules
            const configuredResult = await deeplClient.updateStyleRuleConfiguredRules(
                rule.styleId,
                {
                    dates_and_times: { calendar_era: 'use_bc_and_ad' },
                },
            );
            expect(configuredResult.styleId).toBe(rule.styleId);

            // Create custom instruction with source_language
            const instruction = await deeplClient.createStyleRuleCustomInstruction(rule.styleId, {
                label: 'Label',
                prompt: 'Prompt',
                source_language: 'de',
            });
            expect(instruction.id).toBeDefined();
            expect(instruction.label).toBe('Label');
            const instructionId = instruction.id as string;

            // Get custom instruction
            const gotInstruction = await deeplClient.getStyleRuleCustomInstruction(
                rule.styleId,
                instructionId,
            );
            expect(gotInstruction.label).toBe('Label');

            // Update custom instruction with source_language
            const updatedInstruction = await deeplClient.updateStyleRuleCustomInstruction(
                rule.styleId,
                instructionId,
                { label: 'New Label', prompt: 'New Prompt', source_language: 'en' },
            );
            expect(updatedInstruction.label).toBe('New Label');

            // Delete custom instruction
            await deeplClient.deleteStyleRuleCustomInstruction(rule.styleId, instructionId);

            // Delete style rule
            await deeplClient.deleteStyleRule(rule.styleId);
        },
        testTimeout,
    );

    it('test style rule validation', async () => {
        const deeplClient = makeDeeplClient();

        // createStyleRule
        await expect(deeplClient.createStyleRule({ name: '', language: 'en' })).rejects.toThrow(
            deepl.ArgumentError,
        );
        await expect(deeplClient.createStyleRule({ name: 'Test', language: '' })).rejects.toThrow(
            deepl.ArgumentError,
        );

        // getStyleRule
        await expect(deeplClient.getStyleRule('')).rejects.toThrow(deepl.ArgumentError);

        // updateStyleRuleName
        await expect(deeplClient.updateStyleRuleName('', 'New Name')).rejects.toThrow(
            deepl.ArgumentError,
        );
        await expect(deeplClient.updateStyleRuleName('some-id', '')).rejects.toThrow(
            deepl.ArgumentError,
        );

        // deleteStyleRule
        await expect(deeplClient.deleteStyleRule('')).rejects.toThrow(deepl.ArgumentError);

        // updateStyleRuleConfiguredRules
        await expect(deeplClient.updateStyleRuleConfiguredRules('', {})).rejects.toThrow(
            deepl.ArgumentError,
        );

        // createStyleRuleCustomInstruction
        await expect(
            deeplClient.createStyleRuleCustomInstruction('', { label: 'L', prompt: 'P' }),
        ).rejects.toThrow(deepl.ArgumentError);
        await expect(
            deeplClient.createStyleRuleCustomInstruction('some-id', { label: '', prompt: 'P' }),
        ).rejects.toThrow(deepl.ArgumentError);
        await expect(
            deeplClient.createStyleRuleCustomInstruction('some-id', { label: 'L', prompt: '' }),
        ).rejects.toThrow(deepl.ArgumentError);

        // getStyleRuleCustomInstruction
        await expect(deeplClient.getStyleRuleCustomInstruction('', 'instr-id')).rejects.toThrow(
            deepl.ArgumentError,
        );
        await expect(deeplClient.getStyleRuleCustomInstruction('some-id', '')).rejects.toThrow(
            deepl.ArgumentError,
        );

        // updateStyleRuleCustomInstruction
        await expect(
            deeplClient.updateStyleRuleCustomInstruction('', 'instr-id', {
                label: 'L',
                prompt: 'P',
            }),
        ).rejects.toThrow(deepl.ArgumentError);
        await expect(
            deeplClient.updateStyleRuleCustomInstruction('some-id', '', {
                label: 'L',
                prompt: 'P',
            }),
        ).rejects.toThrow(deepl.ArgumentError);
        await expect(
            deeplClient.updateStyleRuleCustomInstruction('some-id', 'instr-id', {
                label: '',
                prompt: 'P',
            }),
        ).rejects.toThrow(deepl.ArgumentError);
        await expect(
            deeplClient.updateStyleRuleCustomInstruction('some-id', 'instr-id', {
                label: 'L',
                prompt: '',
            }),
        ).rejects.toThrow(deepl.ArgumentError);

        // deleteStyleRuleCustomInstruction
        await expect(deeplClient.deleteStyleRuleCustomInstruction('', 'instr-id')).rejects.toThrow(
            deepl.ArgumentError,
        );
        await expect(deeplClient.deleteStyleRuleCustomInstruction('some-id', '')).rejects.toThrow(
            deepl.ArgumentError,
        );
    });

    withMockServer('test translateText with styleRule', async () => {
        // Note: this test may use the mock server that will not translate the text
        // with a style rule, therefore we do not check the translated result.
        const deeplClient = makeDeeplClient();
        const exampleTextValue = 'Hallo, Welt!';
        await deeplClient.translateText(exampleTextValue, 'de', 'en-US', {
            styleRule: DEFAULT_STYLE_ID,
        });
    });

    withMockServer('test translateText with StyleRuleInfo object', async () => {
        const deeplClient = makeDeeplClient();
        const styleRules = await deeplClient.getAllStyleRules();
        const styleRule = styleRules[0];
        const exampleTextValue = 'Hallo, Welt!';
        await deeplClient.translateText(exampleTextValue, 'de', 'en-US', {
            styleRule: styleRule,
        });
    });

    withMockServer(
        'test translateDocument with styleRule',
        async () => {
            // Note: the default style rule language is 'en', so the target language
            // must be an English variant for the mock server to accept the request.
            const translator = makeTranslator();
            const [exampleDocument, , outputDocumentPath] = tempFiles();
            fs.writeFileSync(exampleDocument, exampleText.de);
            await translator.translateDocument(exampleDocument, outputDocumentPath, 'de', 'en-US', {
                styleRule: DEFAULT_STYLE_ID,
            });
        },
        testTimeout,
    );

    withMockServer(
        'test translateDocument with StyleRuleInfo object',
        async () => {
            const deeplClient = makeDeeplClient();
            const styleRules = await deeplClient.getAllStyleRules();
            const styleRule = styleRules[0];
            const [exampleDocument, , outputDocumentPath] = tempFiles();
            fs.writeFileSync(exampleDocument, exampleText.de);
            await deeplClient.translateDocument(
                exampleDocument,
                outputDocumentPath,
                'de',
                'en-US',
                {
                    styleRule: styleRule,
                },
            );
        },
        testTimeout,
    );
});
