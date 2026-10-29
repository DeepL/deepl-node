// Copyright 2026 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import * as deepl from 'deepl-node';

import nock from 'nock';

import { makeAdminClient, serverUrl } from './client';

const KEY_ID = 'ca7d5694-96eb-4263-a9a4-7f7e4211529e:20c2abcf-4c3c-4cd6-8ae8-8bd2a7d4da38';
const DEVELOPER_KEY_JSON = {
    key_id: KEY_ID,
    label: 'developer key prod',
    creation_time: '2025-07-08T08:15:29.362Z',
    deactivated_time: null,
    is_deactivated: false,
    usage_limits: {
        characters: 5000,
        speech_to_text_milliseconds: null,
        speech_to_speech_milliseconds: 60000,
    },
};

describe('DeepLAdminClient', () => {
    it('requires an admin key', () => {
        expect(() => new deepl.DeepLAdminClient('')).toThrow(deepl.ArgumentError);
    });

    it('uses the server URL option', async () => {
        nock('http://localhost:3000').get('/v2/admin/developer-keys').reply(200, '[]');

        const client = makeAdminClient({ serverUrl: 'http://localhost:3000' });

        await expect(client.listDeveloperKeys()).resolves.toEqual([]);
    });

    it('gets usage analytics', async () => {
        nock(serverUrl, { reqheaders: { authorization: 'DeepL-Auth-Key k:adm' } })
            .get('/v2/admin/analytics')
            .query({ start_date: '2025-09-29', end_date: '2025-10-01', group_by: 'key_and_day' })
            .reply(200, {
                usage_report: {
                    total_usage: {
                        total_characters: 9619,
                        text_translation_characters: 4892,
                        document_translation_characters: 0,
                        text_improvement_characters: 4727,
                        speech_to_text_minutes: 107.46,
                        speech_to_speech_minutes: 3.5,
                    },
                    group_by: 'key_and_day',
                    start_date: '2025-09-29T00:00:00',
                    end_date: '2025-10-01T00:00:00',
                    key_and_day_usages: [
                        {
                            api_key: 'dc88****3a2c',
                            api_key_label: 'Staging API Key',
                            usage_date: '2025-09-29T00:00:00Z',
                            usage: {
                                total_characters: 315,
                                text_translation_characters: 159,
                                document_translation_characters: 0,
                                text_improvement_characters: 156,
                                speech_to_text_minutes: 11.94,
                            },
                        },
                    ],
                },
            });
        const client = makeAdminClient();

        const report = await client.getUsageAnalytics(
            new Date(Date.UTC(2025, 8, 29)),
            '2025-10-01',
            'key_and_day',
        );

        expect(report.totalUsage.totalCharacters).toBe(9619);
        expect(report.totalUsage.speechToTextMinutes).toBe(107.46);
        expect(report.totalUsage.speechToSpeechMinutes).toBe(3.5);
        expect(report.groupBy).toBe('key_and_day');
        expect(report.startDate).toEqual(new Date('2025-09-29T00:00:00Z'));
        expect(report.keyUsages).toEqual([]);
        expect(report.keyAndDayUsages).toEqual([
            {
                apiKey: 'dc88****3a2c',
                apiKeyLabel: 'Staging API Key',
                usageDate: new Date('2025-09-29T00:00:00Z'),
                usage: {
                    totalCharacters: 315,
                    textTranslationCharacters: 159,
                    documentTranslationCharacters: 0,
                    textImprovementCharacters: 156,
                    speechToTextMinutes: 11.94,
                    speechToSpeechMinutes: 0,
                },
            },
        ]);
    });

    it('sends the UTC date of a Date that is near midnight in another time zone', async () => {
        const scope = nock(serverUrl)
            .get('/v2/admin/analytics')
            .query({ start_date: '2026-10-19', end_date: '2026-10-21' })
            .reply(200, { usage_report: { total_usage: {}, group_by: 'none' } });
        const client = makeAdminClient();

        await client.getUsageAnalytics(new Date('2026-10-20T00:30:00+02:00'), '2026-10-21');

        expect(scope.isDone()).toBe(true);
    });

    it('gets custom tag usage analytics', async () => {
        nock(serverUrl)
            .get('/v2/admin/analytics/custom-tags')
            .query({
                start_date: '2026-05-03',
                end_date: '2026-05-15',
                aggregate_by: 'day',
                page: '2',
            })
            .reply(200, {
                custom_tag_usage_report: {
                    aggregate_by: 'day',
                    start_date: '2026-05-03T00:00:00',
                    end_date: '2026-05-15T00:00:00',
                    next_page: 3,
                    usage: [
                        {
                            custom_tag: 'example-custom-tag',
                            usage_date: '2026-05-04T00:00:00Z',
                            breakdown: {
                                total_characters: 380,
                                text_translation_characters: 380,
                                text_improvement_characters: 0,
                                speech_to_text_minutes: 12.5,
                                speech_to_speech_minutes: 4.2,
                            },
                        },
                    ],
                },
            });
        const client = makeAdminClient();

        const report = await client.getCustomTagUsageAnalytics(
            new Date('2026-05-03T12:30:00Z'),
            '2026-05-15',
            'day',
            2,
        );

        expect(report.aggregateBy).toBe('day');
        expect(report.endDate).toEqual(new Date('2026-05-15T00:00:00Z'));
        expect(report.nextPage).toBe(3);
        expect(report.usage[0].customTag).toBe('example-custom-tag');
        expect(report.usage[0].breakdown.speechToSpeechMinutes).toBe(4.2);
        expect(report.usage[0].usageDate).toEqual(new Date('2026-05-04T00:00:00Z'));
    });

    it('creates a developer key', async () => {
        nock(serverUrl)
            .post('/v2/admin/developer-keys', { label: 'developer key prod' })
            .reply(200, DEVELOPER_KEY_JSON);
        const client = makeAdminClient();

        const key = await client.createDeveloperKey({ label: 'developer key prod' });

        expect(key).toEqual({
            keyId: KEY_ID,
            label: 'developer key prod',
            creationTime: new Date('2025-07-08T08:15:29.362Z'),
            deactivatedTime: undefined,
            isDeactivated: false,
            usageLimits: {
                characters: 5000,
                speechToTextMilliseconds: null,
                speechToSpeechMilliseconds: 60000,
            },
        });
    });

    it('lists developer keys', async () => {
        const deactivated = {
            ...DEVELOPER_KEY_JSON,
            is_deactivated: true,
            deactivated_time: '2025-07-09T08:15:29.362Z',
        };
        nock(serverUrl)
            .get('/v2/admin/developer-keys')
            .reply(200, [DEVELOPER_KEY_JSON, deactivated]);
        const client = makeAdminClient();

        const keys = await client.listDeveloperKeys();

        expect(keys.map((k) => k.isDeactivated)).toEqual([false, true]);
        expect(keys[1].deactivatedTime).toEqual(new Date('2025-07-09T08:15:29.362Z'));
    });

    it('modifies developer keys', async () => {
        nock(serverUrl)
            .put('/v2/admin/developer-keys/deactivate', { key_id: KEY_ID })
            .reply(200, DEVELOPER_KEY_JSON)
            .put('/v2/admin/developer-keys/label', { key_id: KEY_ID, label: 'renamed' })
            .reply(200, DEVELOPER_KEY_JSON)
            .put('/v2/admin/developer-keys/limits', {
                key_id: KEY_ID,
                characters: 0,
                speech_to_text_milliseconds: null,
            })
            .reply(200, DEVELOPER_KEY_JSON);
        const client = makeAdminClient();

        const developerKey = await client.deactivateDeveloperKey(KEY_ID);
        await client.renameDeveloperKey(developerKey, 'renamed');
        await client.setDeveloperKeyUsageLimits(developerKey, {
            characters: 0,
            speechToTextMilliseconds: null,
        });
    });

    it('sends only the given usage limits', async () => {
        nock(serverUrl)
            .put('/v2/admin/developer-keys/limits', {
                key_id: KEY_ID,
                speech_to_speech_milliseconds: 60000,
            })
            .reply(200, DEVELOPER_KEY_JSON);

        const key = await makeAdminClient().setDeveloperKeyUsageLimits(KEY_ID, {
            speechToSpeechMilliseconds: 60000,
        });

        expect(key.usageLimits.speechToSpeechMilliseconds).toBe(60000);
    });

    it('sends a group_by and aggregate_by value outside the known set unchanged', async () => {
        const scope = nock(serverUrl)
            .get('/v2/admin/analytics')
            .query({ start_date: '2025-09-29', end_date: '2025-10-01', group_by: 'key_and_week' })
            .reply(200, { usage_report: {} })
            .get('/v2/admin/analytics/custom-tags')
            .query({ start_date: '2025-09-29', end_date: '2025-10-01', aggregate_by: 'week' })
            .reply(200, { custom_tag_usage_report: {} });
        const client = makeAdminClient();

        await client.getUsageAnalytics('2025-09-29', '2025-10-01', 'key_and_week');
        await client.getCustomTagUsageAnalytics('2025-09-29', '2025-10-01', 'week');

        expect(scope.isDone()).toBe(true);
    });

    it('sends the page without an aggregation', async () => {
        const scope = nock(serverUrl)
            .get('/v2/admin/analytics/custom-tags')
            .query({ start_date: '2025-09-29', end_date: '2025-10-01', page: '3' })
            .reply(200, { custom_tag_usage_report: {} });

        await makeAdminClient().getCustomTagUsageAnalytics(
            '2025-09-29',
            '2025-10-01',
            undefined,
            3,
        );

        expect(scope.isDone()).toBe(true);
    });

    it('adds extraBodyParameters last to the developer key request bodies', async () => {
        const scope = nock(serverUrl)
            .post('/v2/admin/developer-keys', { label: 'override', beta: 'true' })
            .reply(200, DEVELOPER_KEY_JSON)
            .put('/v2/admin/developer-keys/deactivate', { key_id: KEY_ID, beta: 'x' })
            .reply(200, DEVELOPER_KEY_JSON)
            .put('/v2/admin/developer-keys/label', { key_id: KEY_ID, label: 'renamed', n: '1' })
            .reply(200, DEVELOPER_KEY_JSON)
            .put('/v2/admin/developer-keys/limits', { key_id: 'other', characters: 0 })
            .reply(200, DEVELOPER_KEY_JSON);
        const client = makeAdminClient();

        await client.createDeveloperKey({
            label: 'mine',
            extraBodyParameters: { label: 'override', beta: 'true' },
        });
        await client.deactivateDeveloperKey(KEY_ID, { extraBodyParameters: { beta: 'x' } });
        await client.renameDeveloperKey(KEY_ID, 'renamed', { extraBodyParameters: { n: '1' } });
        await client.setDeveloperKeyUsageLimits(
            KEY_ID,
            { characters: 0 },
            { extraBodyParameters: { key_id: 'other' } },
        );

        expect(scope.isDone()).toBe(true);
    });

    it('sends an empty body to create a developer key without options', async () => {
        const scope = nock(serverUrl)
            .post('/v2/admin/developer-keys', (body) => Object.keys(body).length === 0)
            .reply(200, DEVELOPER_KEY_JSON);

        await makeAdminClient().createDeveloperKey();

        expect(scope.isDone()).toBe(true);
    });

    it.each<[Date | string, Date | string]>([
        ['2025-9-29', '2025-10-01'],
        ['2025-02-30', '2025-10-01'],
        ['29.09.2025', '2025-10-01'],
        [new Date('invalid'), '2025-10-01'],
    ])('rejects the invalid date %p, %p before sending a request', async (start, end) => {
        const client = makeAdminClient();

        await expect(client.getUsageAnalytics(start, end)).rejects.toThrow(deepl.ArgumentError);
        await expect(client.getCustomTagUsageAnalytics(start, end)).rejects.toThrow(
            deepl.ArgumentError,
        );
    });

    it('does not retry developer key creation after server errors', async () => {
        const scope = nock(serverUrl).post('/v2/admin/developer-keys').reply(503).persist();
        const client = makeAdminClient();
        let requests = 0;
        scope.on('request', () => requests++);

        await expect(client.createDeveloperKey()).rejects.toBeInstanceOf(deepl.DeepLError);
        expect(requests).toBe(1);
    });

    it.each<[string, boolean, (scope: nock.Interceptor) => nock.Scope]>([
        ['a 500 response', false, (i) => i.reply(500)],
        ['a connection reset', false, (i) => i.replyWithError({ code: 'ECONNRESET' })],
        ['a 429 response', true, (i) => i.reply(429)],
        ['a refused connection', true, (i) => i.replyWithError({ code: 'ECONNREFUSED' })],
    ])(
        'sets shouldRetry of a failed developer key creation after %s to %s',
        async (_, shouldRetry, reply) => {
            reply(nock(serverUrl).post('/v2/admin/developer-keys'));

            const error = await makeAdminClient({ maxRetries: 0 })
                .createDeveloperKey()
                .catch((e) => e);

            expect(error).toBeInstanceOf(deepl.DeepLError);
            expect(error.shouldRetry).toBe(shouldRetry);
        },
    );

    it.each([['EAI_AGAIN'], ['ENOTFOUND'], ['ECONNREFUSED']])(
        'retries developer key creation after the unsent-request error %s',
        async (code) => {
            nock(serverUrl)
                .post('/v2/admin/developer-keys')
                .replyWithError({ code })
                .post('/v2/admin/developer-keys')
                .reply(200, DEVELOPER_KEY_JSON);

            const key = await makeAdminClient().createDeveloperKey();

            expect(key.keyId).toBe(KEY_ID);
        },
    );

    it('does not retry developer key creation after a connection reset', async () => {
        nock(serverUrl).post('/v2/admin/developer-keys').replyWithError({ code: 'ECONNRESET' });

        await expect(makeAdminClient().createDeveloperKey()).rejects.toThrow(deepl.ConnectionError);
    });

    it('trims the admin key and rejects a whitespace-only key', async () => {
        expect(() => new deepl.DeepLAdminClient('  \n')).toThrow(deepl.ArgumentError);
        nock(serverUrl, { reqheaders: { authorization: 'DeepL-Auth-Key k:adm' } })
            .get('/v2/admin/developer-keys')
            .reply(200, []);

        await makeAdminClient({ adminKey: ' k:adm\n' }).listDeveloperKeys();
    });

    it('retries rate-limited developer key creation', async () => {
        nock(serverUrl)
            .post('/v2/admin/developer-keys')
            .reply(429)
            .post('/v2/admin/developer-keys')
            .reply(200, DEVELOPER_KEY_JSON);

        const key = await makeAdminClient().createDeveloperKey();

        expect(key.keyId).toBe(KEY_ID);
    });

    it.each<[string, (client: deepl.DeepLAdminClient) => Promise<unknown>]>([
        ['deactivate with an empty key ID', (c) => c.deactivateDeveloperKey('')],
        [
            'set limits on a key without ID',
            (c) =>
                c.setDeveloperKeyUsageLimits({ keyId: '' } as deepl.DeveloperKey, {
                    characters: 0,
                }),
        ],
    ])('rejects %s before sending a request', async (_, call) => {
        await expect(call(makeAdminClient())).rejects.toThrow(deepl.ArgumentError);
    });

    it('parses malformed developer key responses tolerantly', async () => {
        nock(serverUrl)
            .get('/v2/admin/developer-keys')
            .reply(200, [
                { ...DEVELOPER_KEY_JSON, creation_time: 'not a timestamp' },
                'not an object',
                { label: 'no id', usage_limits: 'bad' },
                { ...DEVELOPER_KEY_JSON, usage_limits: { characters: 'many' } },
            ]);

        const keys = await makeAdminClient().listDeveloperKeys();

        expect(keys).toHaveLength(2);
        expect(keys[0].creationTime).toBeUndefined();
        expect(keys[0].keyId).toBe(KEY_ID);
        expect(keys[0].usageLimits.speechToSpeechMilliseconds).toBe(60000);
        expect(keys[1].usageLimits.characters).toBeNull();
        expect(keys[1].label).toBe('developer key prod');
    });

    it.each([
        ['null', null],
        ['no key_id', { label: 'no id' }],
        ['an empty key_id', { ...DEVELOPER_KEY_JSON, key_id: '' }],
        ['a numeric key_id', { ...DEVELOPER_KEY_JSON, key_id: 7 }],
        ['an array', [DEVELOPER_KEY_JSON]],
    ])('throws a DeepLError if a developer key response is %s', async (_, body) => {
        nock(serverUrl).post('/v2/admin/developer-keys').reply(200, JSON.stringify(body));

        await expect(makeAdminClient().createDeveloperKey()).rejects.toThrow(deepl.DeepLError);
    });

    it('throws a DeepLError if the developer key list is not an array', async () => {
        nock(serverUrl).get('/v2/admin/developer-keys').reply(200, { keys: [] });

        await expect(makeAdminClient().listDeveloperKeys()).rejects.toThrow(deepl.DeepLError);
    });

    it('treats only JSON true as deactivated', async () => {
        nock(serverUrl)
            .get('/v2/admin/developer-keys')
            .reply(200, [
                { ...DEVELOPER_KEY_JSON, is_deactivated: 'false' },
                { ...DEVELOPER_KEY_JSON, is_deactivated: null },
                { ...DEVELOPER_KEY_JSON, is_deactivated: true },
            ]);

        const keys = await makeAdminClient().listDeveloperKeys();

        expect(keys.map((k) => k.isDeactivated)).toEqual([false, false, true]);
    });

    it('throws a DeepLError if an analytics response is not a JSON object', async () => {
        nock(serverUrl)
            .get('/v2/admin/analytics')
            .query(true)
            .reply(200, '[]')
            .get('/v2/admin/analytics/custom-tags')
            .query(true)
            .reply(200, '"x"');
        const client = makeAdminClient();

        const message = 'Usage analytics response is not a JSON object';
        await expect(client.getUsageAnalytics('2025-01-01', '2025-02-01')).rejects.toThrow(
            new deepl.DeepLError(message),
        );
        await expect(client.getCustomTagUsageAnalytics('2025-01-01', '2025-02-01')).rejects.toThrow(
            new deepl.DeepLError(message),
        );
    });

    it('parses malformed analytics responses tolerantly', async () => {
        nock(serverUrl)
            .get('/v2/admin/analytics')
            .query(true)
            .reply(200, {
                usage_report: {
                    total_usage: { total_characters: 'x', text_translation_characters: 5 },
                    start_date: 'garbage',
                    group_by: 'keyAndDay',
                    key_and_day_usages: [null, 7, { api_key: 'k', usage_date: 42 }],
                },
            })
            .get('/v2/admin/analytics/custom-tags')
            .query(true)
            .reply(200, {
                custom_tag_usage_report: {
                    aggregate_by: 'day',
                    next_page: null,
                    usage: ['x', { custom_tag: 't', breakdown: 'bad' }],
                },
            });
        const client = makeAdminClient();

        const report = await client.getUsageAnalytics('2025-01-01', '2025-02-01', 'key_and_day');
        const tags = await client.getCustomTagUsageAnalytics('2025-01-01', '2025-02-01');

        expect(report.totalUsage.totalCharacters).toBe(0);
        expect(report.totalUsage.textTranslationCharacters).toBe(5);
        expect(report.totalUsage.speechToSpeechMinutes).toBe(0);
        expect(report.startDate).toBeUndefined();
        expect(report.groupBy).toBe('keyAndDay');
        expect(report.keyAndDayUsages).toHaveLength(1);
        expect(report.keyAndDayUsages[0]).toMatchObject({ apiKey: 'k', apiKeyLabel: '' });
        expect(report.keyAndDayUsages[0].usageDate).toBeUndefined();
        expect(tags.aggregateBy).toBe('day');
        expect(tags.nextPage).toBeUndefined();
        expect(tags.usage).toHaveLength(1);
        expect(tags.usage[0].customTag).toBe('t');
        expect(tags.usage[0].breakdown.totalCharacters).toBe(0);
    });

    it('throws AuthorizationError on 403', async () => {
        nock(serverUrl).get('/v2/admin/developer-keys').reply(403, { message: 'Forbidden' });
        const client = makeAdminClient();

        await expect(client.listDeveloperKeys()).rejects.toBeInstanceOf(deepl.AuthorizationError);
    });
});
