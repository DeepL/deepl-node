// Copyright 2026 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import { HttpClient, buildRequestHeaders, createHttpClient } from './client';
import { ArgumentError, DeepLError } from './errors';
import {
    parseAdminUsageReport,
    parseCustomTagUsageReport,
    parseDeveloperKey,
    parseDeveloperKeyList,
} from './parsing';
import { checkStatusCode } from './translator';
import {
    AdminUsageGroupBy,
    AdminUsageReport,
    BaseRequestOptions,
    CreateDeveloperKeyOptions,
    CustomTagUsageAggregateBy,
    CustomTagUsageReport,
    DeactivateDeveloperKeyOptions,
    DeepLAdminClientOptions,
    DeveloperKey,
    DeveloperKeyUsageLimitsUpdate,
    RenameDeveloperKeyOptions,
    SetDeveloperKeyUsageLimitsOptions,
} from './types';
import { isString, resolveExtraBodyParameters } from './utils';

import { URLSearchParams } from 'url';

/**
 * Client for the DeepL Admin API, used to manage the developer keys of your organization and to
 * retrieve usage analytics. Requires an admin API key; admin keys cannot be used for translation.
 */
export class DeepLAdminClient {
    /**
     * HttpClient implements all HTTP requests and retries.
     * @private
     */
    private readonly httpClient: HttpClient;

    /**
     * Construct a DeepLAdminClient object wrapping the DeepL Admin API using your admin key.
     * This does not connect to the API, and returns immediately.
     * @param adminKey Admin API key as specified in your account.
     * @param options Additional options controlling client behavior.
     */
    constructor(adminKey: string, options?: DeepLAdminClientOptions) {
        if (isString(adminKey)) adminKey = adminKey.trim();
        if (!isString(adminKey) || adminKey.length === 0) {
            throw new ArgumentError('adminKey must be a non-empty string');
        }

        this.httpClient = createHttpClient(
            options?.serverUrl ?? 'https://api.deepl.com',
            buildRequestHeaders(adminKey, options),
            options,
        );
    }

    /**
     * Retrieves usage statistics of the organization within the given date range. Dates are UTC
     * calendar days and both the start and the end day are included. The API requires endDate to
     * be after startDate (a report covers at least two days) and at most 366 days after it.
     * @param startDate Start date of the report, as a 'YYYY-MM-DD' string such as '2025-09-29', or
     *     as a Date. For a Date, the UTC date of that moment is sent, so local midnight in UTC+2
     *     (2026-10-20T00:00+02:00) is sent as 2026-10-19.
     * @param endDate End date of the report, in the same format as startDate.
     * @param groupBy Optional grouping of the usage by key ('key') or by key and day
     *     ('key_and_day'); not sent if omitted.
     * @throws {ArgumentError} If a date is not a valid Date or 'YYYY-MM-DD' string.
     * @return Fulfills with an AdminUsageReport.
     */
    async getUsageAnalytics(
        startDate: Date | string,
        endDate: Date | string,
        groupBy?: AdminUsageGroupBy,
    ): Promise<AdminUsageReport> {
        const data = DeepLAdminClient.dateRangeParams(startDate, endDate);
        if (groupBy !== undefined) {
            data.append('group_by', groupBy);
        }
        const content = await this.request('GET', '/v2/admin/analytics', { data });
        return parseAdminUsageReport(content);
    }

    /**
     * Retrieves usage statistics per custom tag within the given date range. Results are
     * paginated: pass the `nextPage` value of a report as `page` to retrieve the following
     * page. Dates are UTC calendar days and both the start and the end day are included. The API
     * requires endDate to be after startDate (a report covers at least two days) and at most 366
     * days after it.
     * @param startDate Start date of the report, as a 'YYYY-MM-DD' string such as '2025-09-29', or
     *     as a Date. For a Date, the UTC date of that moment is sent, so local midnight in UTC+2
     *     (2026-10-20T00:00+02:00) is sent as 2026-10-19.
     * @param endDate End date of the report, in the same format as startDate.
     * @param aggregateBy Optional aggregation over the whole period ('period', the API default) or
     *     by day ('day'); not sent if omitted.
     * @param page Optional page number, from the `nextPage` value of a previous report.
     * @throws {ArgumentError} If a date is not a valid Date or 'YYYY-MM-DD' string.
     * @return Fulfills with a CustomTagUsageReport.
     */
    async getCustomTagUsageAnalytics(
        startDate: Date | string,
        endDate: Date | string,
        aggregateBy?: CustomTagUsageAggregateBy,
        page?: number,
    ): Promise<CustomTagUsageReport> {
        const data = DeepLAdminClient.dateRangeParams(startDate, endDate);
        if (aggregateBy !== undefined) {
            data.append('aggregate_by', aggregateBy);
        }
        if (page !== undefined) {
            data.append('page', String(page));
        }
        const content = await this.request('GET', '/v2/admin/analytics/custom-tags', { data });
        return parseCustomTagUsageReport(content);
    }

    /**
     * Creates a developer key in the organization.
     * @param options Optional label and extra body parameters, see
     *     {@link CreateDeveloperKeyOptions}. The API uses "DeepL API Key" if no label is given.
     * @return Fulfills with the created DeveloperKey.
     */
    async createDeveloperKey(options?: CreateDeveloperKeyOptions): Promise<DeveloperKey> {
        const jsonBody: Record<string, unknown> = {};
        if (options?.label !== undefined) {
            jsonBody.label = options.label;
        }
        const content = await this.request('POST', '/v2/admin/developer-keys', {
            jsonBody: DeepLAdminClient.withExtraBodyParameters(jsonBody, options),
            retryOnlyUnprocessed: true,
        });
        return parseDeveloperKey(content);
    }

    /**
     * Retrieves all developer keys of the organization, including deactivated ones.
     * @return Fulfills with an array of DeveloperKey objects.
     */
    async listDeveloperKeys(): Promise<DeveloperKey[]> {
        const content = await this.request('GET', '/v2/admin/developer-keys');
        return parseDeveloperKeyList(content);
    }

    /**
     * Deactivates a developer key. Deactivation is permanent.
     * @param key Key ID or DeveloperKey to deactivate.
     * @param options Additional options, see {@link DeactivateDeveloperKeyOptions}.
     * @return Fulfills with the deactivated DeveloperKey.
     */
    async deactivateDeveloperKey(
        key: string | DeveloperKey,
        options?: DeactivateDeveloperKeyOptions,
    ): Promise<DeveloperKey> {
        const keyId = DeepLAdminClient.keyId(key);
        return this.putDeveloperKey('deactivate', { key_id: keyId }, options);
    }

    /**
     * Changes the label of a developer key.
     * @param key Key ID or DeveloperKey to rename.
     * @param label New label for the key.
     * @param options Additional options, see {@link RenameDeveloperKeyOptions}.
     * @return Fulfills with the renamed DeveloperKey.
     */
    async renameDeveloperKey(
        key: string | DeveloperKey,
        label: string,
        options?: RenameDeveloperKeyOptions,
    ): Promise<DeveloperKey> {
        const keyId = DeepLAdminClient.keyId(key);
        return this.putDeveloperKey('label', { key_id: keyId, label }, options);
    }

    /**
     * Changes the usage limits of a developer key. Only the given limits are changed; omitted
     * limits keep their current value. A null limit means unlimited and 0 blocks that usage.
     * @param key Key ID or DeveloperKey to modify.
     * @param limits Usage limits to change.
     * @param options Additional options, see {@link SetDeveloperKeyUsageLimitsOptions}.
     * @return Fulfills with the modified DeveloperKey.
     */
    async setDeveloperKeyUsageLimits(
        key: string | DeveloperKey,
        limits: DeveloperKeyUsageLimitsUpdate,
        options?: SetDeveloperKeyUsageLimitsOptions,
    ): Promise<DeveloperKey> {
        const keyId = DeepLAdminClient.keyId(key);
        const limitsBody: Record<string, unknown> = {};
        if (limits?.characters !== undefined) {
            limitsBody.characters = limits.characters;
        }
        if (limits?.speechToTextMilliseconds !== undefined) {
            limitsBody.speech_to_text_milliseconds = limits.speechToTextMilliseconds;
        }
        if (limits?.speechToSpeechMilliseconds !== undefined) {
            limitsBody.speech_to_speech_milliseconds = limits.speechToSpeechMilliseconds;
        }
        return this.putDeveloperKey('limits', { key_id: keyId, ...limitsBody }, options);
    }

    private async putDeveloperKey(
        action: string,
        jsonBody: Record<string, unknown>,
        options: BaseRequestOptions | undefined,
    ): Promise<DeveloperKey> {
        const content = await this.request('PUT', `/v2/admin/developer-keys/${action}`, {
            jsonBody: DeepLAdminClient.withExtraBodyParameters(jsonBody, options),
        });
        return parseDeveloperKey(content);
    }

    private static withExtraBodyParameters(
        jsonBody: Record<string, unknown>,
        options: BaseRequestOptions | undefined,
    ): Record<string, unknown> {
        // Added last, so they replace library-set fields with the same key
        const extraBodyParameters = resolveExtraBodyParameters(options);
        return extraBodyParameters === undefined
            ? jsonBody
            : { ...jsonBody, ...extraBodyParameters };
    }

    private async request(
        method: 'GET' | 'POST' | 'PUT',
        url: string,
        options?: {
            data?: URLSearchParams;
            jsonBody?: Record<string, unknown>;
            retryOnlyUnprocessed?: boolean;
        },
    ): Promise<string> {
        const { statusCode, content } = await this.httpClient.sendRequestWithBackoff<string>(
            method,
            url,
            options,
        );
        try {
            await checkStatusCode(statusCode, content);
        } catch (error) {
            // A 5xx may come after the server processed the request, so only a 429 is safe to repeat.
            if (options?.retryOnlyUnprocessed && error instanceof DeepLError) {
                error.shouldRetry = statusCode === 429;
            }
            throw error;
        }
        return content;
    }

    private static dateRangeParams(
        startDate: Date | string,
        endDate: Date | string,
    ): URLSearchParams {
        const start = DeepLAdminClient.formatDate(startDate);
        const end = DeepLAdminClient.formatDate(endDate);
        return new URLSearchParams({ start_date: start, end_date: end });
    }

    private static formatDate(date: Date | string): string {
        if (isString(date)) {
            const parsed = new Date(`${date}T00:00:00Z`);
            if (isNaN(parsed.getTime()) || parsed.toISOString().substring(0, 10) !== date) {
                throw new ArgumentError(`Invalid date '${date}', expected format YYYY-MM-DD`);
            }
            return date;
        }
        if (!(date instanceof Date) || isNaN(date.getTime())) {
            throw new ArgumentError('Invalid date, expected a valid Date or a YYYY-MM-DD string');
        }
        return date.toISOString().substring(0, 10);
    }

    private static keyId(key: string | DeveloperKey): string {
        const keyId = isString(key) ? key : key?.keyId;
        if (!isString(keyId) || keyId.length === 0) {
            throw new ArgumentError('key must be a non-empty key ID or a DeveloperKey');
        }
        return keyId;
    }
}
