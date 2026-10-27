// Copyright 2026 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import { makeAdminClient } from './client';
import { getUniqueName, testTimeout } from './helpers';

const today = new Date();
const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('DeepLAdminClient', () => {
    it('sends GET /v2/admin/analytics and parses the report', async () => {
        const report = await makeAdminClient().getUsageAnalytics(weekAgo, today, {
            groupBy: 'key_and_day',
        });

        expect(typeof report.totalUsage.totalCharacters).toBe('number');
        expect(typeof report.totalUsage.speechToSpeechMinutes).toBe('number');
        expect(report.startDate).toBeDefined();
        expect(report.endDate).toBeDefined();
        expect(report.groupBy).toBeDefined();
        expect(report.groupBy).toBe('keyAndDay');
        expect(Array.isArray(report.keyAndDayUsages)).toBe(true);
    });

    it('sends GET /v2/admin/analytics/custom-tags and parses the report', async () => {
        const report = await makeAdminClient().getCustomTagUsageAnalytics(weekAgo, today, {
            aggregateBy: 'day',
        });

        expect(report.startDate).toBeDefined();
        expect(report.endDate).toBeDefined();
        expect(report.aggregateBy).toBe('day');
        expect(Array.isArray(report.usage)).toBe(true);
    });

    it(
        'sends the developer key requests: create, list, rename, set limits and deactivate',
        async () => {
            const client = makeAdminClient();

            const key = await client.createDeveloperKey(getUniqueName('developer-key'));
            let deactivated;
            let bodyError;
            try {
                expect(key.isDeactivated).toBe(false);

                // A newly created key can be briefly invisible in the list.
                let visible = false;
                for (let attempt = 0; attempt < 5 && !visible; attempt++) {
                    if (attempt > 0) {
                        await sleep(1000);
                    }
                    const listed = await client.getDeveloperKeys();
                    visible = listed.some((k) => k.keyId === key.keyId);
                }
                if (!visible) {
                    throw new Error('New developer key not listed after 5 attempts');
                }

                const newLabel = getUniqueName('developer-key-renamed');
                const renamed = await client.renameDeveloperKey(key, newLabel);
                expect(renamed.label).toBe(newLabel);

                const limited = await client.setDeveloperKeyUsageLimits(key, {
                    characters: 5000,
                    speechToTextMilliseconds: null,
                });
                expect(limited.usageLimits.characters).toBe(5000);
                expect(limited.usageLimits.speechToTextMilliseconds).toBeNull();

                deactivated = await client.deactivateDeveloperKey(key);
                expect(deactivated.isDeactivated).toBe(true);
            } catch (error) {
                bodyError = error;
            }
            if (!deactivated) {
                // Clean up after a failed body; a key that does not exist anymore is fine.
                try {
                    await client.deactivateDeveloperKey(key);
                } catch (error) {
                    if (!/^Not found/.test(String((error as Error)?.message))) {
                        if (bodyError) {
                            console.error('Developer key cleanup failed:', error);
                        } else {
                            bodyError = error;
                        }
                    }
                }
            }
            if (bodyError) {
                throw bodyError as Error;
            }
        },
        testTimeout,
    );
});
