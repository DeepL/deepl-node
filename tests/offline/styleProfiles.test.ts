// Copyright 2026 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import * as deepl from 'deepl-node';

import nock from 'nock';

import { makeDeeplClient, serverUrl } from './client';

const profileId = '3f1c9d0e-7a24-4b58-9c31-8f0e5d2a1b47';

// The spec's StyleProfile example
const profileReply = {
    style_profile_id: profileId,
    name: 'Legal, German',
    description: 'Contract wording for the German market.',
    industry: 'Legal',
    glossary_ids: ['4d0a2e1c-6b93-4f7a-8d15-2c6e9a3b7f81'],
    style_rule_ids: ['bd0a38f3-1831-440b-a8dd-2c702e2325ab'],
    translation_memory_ids: ['a74d88fb-ed2a-4943-a664-a4512398b994'],
    glossary_priority_order_enabled: true,
    creation_time: '2026-04-01T16:34:25.223Z',
    updated_time: '2026-08-06T09:12:44.108Z',
};

const profile: deepl.StyleProfile = {
    styleProfileId: profileId,
    name: 'Legal, German',
    description: 'Contract wording for the German market.',
    industry: 'Legal',
    glossaryIds: ['4d0a2e1c-6b93-4f7a-8d15-2c6e9a3b7f81'],
    styleRuleIds: ['bd0a38f3-1831-440b-a8dd-2c702e2325ab'],
    translationMemoryIds: ['a74d88fb-ed2a-4943-a664-a4512398b994'],
    glossaryPriorityOrderEnabled: true,
    creationTime: new Date('2026-04-01T16:34:25.223Z'),
    updatedTime: new Date('2026-08-06T09:12:44.108Z'),
};

/** Returns a nock body matcher that records the request body into the given array. */
function capture(bodies: unknown[]) {
    return (body: unknown) => {
        bodies.push(body);
        return true;
    };
}

describe('DeepLClient.listStyleProfiles', () => {
    it('sends no query by default and parses every field of the spec example', async () => {
        nock(serverUrl, { reqheaders: { authorization: 'DeepL-Auth-Key k' } })
            .get('/v3/style_profiles')
            .query({})
            .reply(200, { style_profiles: [profileReply], total_count: 1 });

        expect(await makeDeeplClient().listStyleProfiles()).toStrictEqual([profile]);
    });

    it('sends page and page_size', async () => {
        nock(serverUrl)
            .get('/v3/style_profiles')
            .query({ page: '2', page_size: '100' })
            .reply(200, { style_profiles: [], total_count: 0 });

        expect(await makeDeeplClient().listStyleProfiles(2, 100)).toEqual([]);
    });

    it('returns an empty array when style_profiles is missing', async () => {
        nock(serverUrl).get('/v3/style_profiles').reply(200, { total_count: 0 });

        expect(await makeDeeplClient().listStyleProfiles()).toEqual([]);
    });
});

describe('DeepLClient.createStyleProfile', () => {
    it('sends only the name when no options are given', async () => {
        const bodies: unknown[] = [];
        nock(serverUrl).post('/v3/style_profiles', capture(bodies)).reply(201, {
            style_profile_id: profileId,
            name: 'Minimal',
            glossary_ids: [],
            style_rule_ids: [],
            translation_memory_ids: [],
            glossary_priority_order_enabled: false,
            creation_time: '2026-10-26T16:27:10.2982869Z',
            updated_time: '2026-10-26T16:27:10.2982869Z',
        });

        const created = await makeDeeplClient().createStyleProfile('Minimal');

        expect(bodies).toStrictEqual([{ name: 'Minimal' }]);
        expect(created).toStrictEqual({
            styleProfileId: profileId,
            name: 'Minimal',
            description: undefined,
            industry: undefined,
            glossaryIds: [],
            styleRuleIds: [],
            translationMemoryIds: [],
            glossaryPriorityOrderEnabled: false,
            creationTime: new Date('2026-10-26T16:27:10.298Z'),
            updatedTime: new Date('2026-10-26T16:27:10.298Z'),
        });
    });

    it('sends every option with arrays in order and the boolean as JSON true', async () => {
        const bodies: unknown[] = [];
        nock(serverUrl).post('/v3/style_profiles', capture(bodies)).reply(201, profileReply);

        await makeDeeplClient().createStyleProfile('Legal, German', {
            description: 'Contract wording for the German market.',
            industry: 'Legal',
            glossaryIds: ['g-2', 'g-1'],
            styleRuleIds: ['s-1'],
            translationMemoryIds: ['t-1'],
            glossaryPriorityOrderEnabled: true,
        });

        expect(bodies).toStrictEqual([
            {
                name: 'Legal, German',
                description: 'Contract wording for the German market.',
                industry: 'Legal',
                glossary_ids: ['g-2', 'g-1'],
                style_rule_ids: ['s-1'],
                translation_memory_ids: ['t-1'],
                glossary_priority_order_enabled: true,
            },
        ]);
    });
});

describe('DeepLClient.getStyleProfile', () => {
    it('accepts an ID or a StyleProfile object and escapes the ID', async () => {
        nock(serverUrl).get(`/v3/style_profiles/${profileId}`).twice().reply(200, profileReply);
        nock(serverUrl).get('/v3/style_profiles/a%2Fb%20c').reply(200, profileReply);

        const client = makeDeeplClient();
        expect(await client.getStyleProfile(profileId)).toStrictEqual(profile);
        expect(await client.getStyleProfile(profile)).toStrictEqual(profile);
        await client.getStyleProfile('a/b c');
    });

    it('ignores unknown fields and treats missing description and industry as undefined', async () => {
        const { description, industry, ...withoutOptional } = profileReply;
        void description;
        void industry;
        nock(serverUrl)
            .get(`/v3/style_profiles/${profileId}`)
            .reply(200, {
                ...withoutOptional,
                example_document_ids: ['e-1'],
                spoken_terms_ids: ['st-1'],
            });

        const fetched = await makeDeeplClient().getStyleProfile(profileId);

        expect(fetched).toStrictEqual({ ...profile, description: undefined, industry: undefined });
    });

    it('tolerates a malformed timestamp and non-string IDs', async () => {
        nock(serverUrl)
            .get(`/v3/style_profiles/${profileId}`)
            .reply(200, {
                ...profileReply,
                creation_time: 'not a timestamp',
                glossary_ids: ['g-1', 42, null, 'g-2'],
                style_rule_ids: null,
                translation_memory_ids: undefined,
                glossary_priority_order_enabled: undefined,
            });

        const fetched = await makeDeeplClient().getStyleProfile(profileId);

        expect(fetched).toStrictEqual({
            ...profile,
            creationTime: undefined,
            glossaryIds: ['g-1', 'g-2'],
            styleRuleIds: [],
            translationMemoryIds: [],
            glossaryPriorityOrderEnabled: false,
        });
    });

    it('maps 404 to the not-found DeepLError', async () => {
        nock(serverUrl)
            .get(`/v3/style_profiles/${profileId}`)
            .reply(404, { message: 'Style profile not found' });

        await expect(makeDeeplClient().getStyleProfile(profileId)).rejects.toThrow(
            new deepl.DeepLError('Not found, message: Style profile not found'),
        );
    });
});

describe('DeepLClient.updateStyleProfile', () => {
    it('sends only the set fields, keeping empty strings and arrays', async () => {
        const bodies: unknown[] = [];
        nock(serverUrl)
            .patch(`/v3/style_profiles/${profileId}`, capture(bodies))
            .reply(200, profileReply);

        await makeDeeplClient().updateStyleProfile(profileId, {
            name: 'Renamed',
            description: '',
            styleRuleIds: [],
            glossaryPriorityOrderEnabled: false,
        });

        expect(bodies).toStrictEqual([
            {
                name: 'Renamed',
                description: '',
                style_rule_ids: [],
                glossary_priority_order_enabled: false,
            },
        ]);
    });

    it('sends an empty object when nothing is set, also for a StyleProfile object', async () => {
        const bodies: unknown[] = [];
        nock(serverUrl)
            .patch(`/v3/style_profiles/${profileId}`, capture(bodies))
            .reply(200, profileReply);
        nock(serverUrl)
            .patch('/v3/style_profiles/a%2Fb%20c', capture(bodies))
            .reply(200, profileReply);

        const client = makeDeeplClient();
        expect(await client.updateStyleProfile(profile, {})).toStrictEqual(profile);
        await client.updateStyleProfile('a/b c', {});

        expect(bodies).toStrictEqual([{}, {}]);
    });
});

describe('DeepLClient.deleteStyleProfile', () => {
    it('accepts an ID or a StyleProfile object and escapes the ID', async () => {
        nock(serverUrl).delete(`/v3/style_profiles/${profileId}`).twice().reply(204);
        nock(serverUrl).delete('/v3/style_profiles/a%2Fb%20c').reply(204);

        const client = makeDeeplClient();
        await client.deleteStyleProfile(profileId);
        await client.deleteStyleProfile(profile);
        await client.deleteStyleProfile('a/b c');
    });
});

describe('DeepLClient style profiles with an empty ID', () => {
    // No nock interceptor: a request would fail with a network error instead
    it.each([
        ['getStyleProfile', (c: deepl.DeepLClient) => c.getStyleProfile('')],
        ['updateStyleProfile', (c: deepl.DeepLClient) => c.updateStyleProfile('', { name: 'x' })],
        ['deleteStyleProfile', (c: deepl.DeepLClient) => c.deleteStyleProfile('')],
        [
            'getStyleProfile with an object',
            (c: deepl.DeepLClient) => c.getStyleProfile({ ...profile, styleProfileId: '' }),
        ],
    ])('%s throws ArgumentError before sending a request', async (_name, call) => {
        await expect(call(makeDeeplClient())).rejects.toThrow(deepl.ArgumentError);
    });
});
