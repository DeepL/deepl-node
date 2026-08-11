// Copyright 2022 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import { ConnectionError } from './errors';
import { logDebug, logInfo, timeout } from './utils';

import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { URLSearchParams } from 'url';
import FormData from 'form-data';
import { IncomingMessage } from 'http';
import { ProxyConfig } from './types';
import * as https from 'https';
import * as http from 'http';

type HttpMethod = 'GET' | 'DELETE' | 'POST' | 'PUT' | 'PATCH';

/**
 * Axios error codes for transient transport-level failures that should be retried.
 * Mirrors deepl-python's broader ConnectionError retry coverage.
 * @internal
 */
export const RETRYABLE_AXIOS_ERROR_CODES = new Set([
    'ETIMEDOUT',
    'ECONNABORTED',
    'ECONNRESET',
    'EPIPE',
    'EAI_AGAIN',
]);

const axiosInstance = axios.create({
    httpAgent: new http.Agent({ keepAlive: true }),
    httpsAgent: new https.Agent({ keepAlive: true }),
});

/**
 * Options for sending HTTP requests.
 * @private
 */
interface SendRequestOptions {
    /**
     * Fields to include in message body (or params) as form-encoded data. Values must be either
     * strings, or arrays of strings (for repeated parameters).
     * Cannot be used together with jsonBody.
     */
    data?: URLSearchParams;
    /**
     * JSON body to send with the request. If provided, Content-Type will be set to
     * application/json. Cannot be used together with data or fileBuffer.
     */
    jsonBody?: Record<string, unknown>;
    /** Extra HTTP headers to include in request, in addition to headers defined in constructor. */
    headers?: Record<string, string>;
    /** Buffer containing file data to include. */
    fileBuffer?: Buffer;
    /** Filename of file to include. */
    filename?: string;
    /**
     * Request body sent verbatim, without form or JSON encoding. Used to upload files to storage
     * URLs handed out by the API. Cannot be used together with data, jsonBody or fileBuffer.
     */
    rawBody?: Buffer;
}

/**
 * Internal class implementing exponential-backoff timer.
 * @private
 */
class BackoffTimer {
    private backoffInitial = 1.0;
    private backoffMax = 120.0;
    private backoffJitter = 0.23;
    private backoffMultiplier = 1.6;
    private numRetries: number;
    private backoff: number;
    private deadline: number;

    constructor() {
        this.numRetries = 0;
        this.backoff = this.backoffInitial * 1000.0;
        this.deadline = Date.now() + this.backoff;
    }

    getNumRetries(): number {
        return this.numRetries;
    }

    getTimeout(): number {
        return this.getTimeUntilDeadline();
    }

    getTimeUntilDeadline(): number {
        return Math.max(this.deadline - Date.now(), 0.0);
    }

    async sleepUntilDeadline() {
        await timeout(this.getTimeUntilDeadline());

        // Apply multiplier to current backoff time
        this.backoff = Math.min(this.backoff * this.backoffMultiplier, this.backoffMax * 1000.0);

        // Get deadline by applying jitter as a proportion of backoff:
        // if jitter is 0.1, then multiply backoff by random value in [0.9, 1.1]
        this.deadline =
            Date.now() + this.backoff * (1 + this.backoffJitter * (2 * Math.random() - 1));
        this.numRetries++;
    }
}

/**
 * Internal class implementing HTTP requests.
 * @private
 */
export class HttpClient {
    private readonly serverUrl: string;
    private readonly headers: Record<string, string>;
    private readonly minTimeout: number;
    private readonly maxRetries: number;
    private readonly proxy?: ProxyConfig;

    constructor(
        serverUrl: string,
        headers: Record<string, string>,
        maxRetries: number,
        minTimeout: number,
        proxy?: ProxyConfig,
    ) {
        this.serverUrl = serverUrl;
        this.headers = headers;
        this.maxRetries = maxRetries;
        this.minTimeout = minTimeout;
        this.proxy = proxy;
    }

    prepareRequest(
        method: HttpMethod,
        url: string,
        timeoutMs: number,
        responseAsStream: boolean,
        options: SendRequestOptions,
    ): AxiosRequestConfig {
        const headers = Object.assign({}, this.headers, options.headers);

        const axiosRequestConfig: AxiosRequestConfig = {
            url,
            method,
            baseURL: this.serverUrl,
            headers,
            responseType: responseAsStream ? 'stream' : 'text',
            timeout: timeoutMs,
            validateStatus: null, // do not throw errors for any status codes
        };

        if (options.rawBody) {
            axiosRequestConfig.data = options.rawBody;
        } else if (options.fileBuffer) {
            const form = new FormData();
            form.append('file', options.fileBuffer, { filename: options.filename });
            if (options.data) {
                for (const [key, value] of options.data.entries()) {
                    form.append(key, value);
                }
            }
            axiosRequestConfig.data = form;
            if (axiosRequestConfig.headers === undefined) {
                axiosRequestConfig.headers = {};
            }
            Object.assign(axiosRequestConfig.headers, form.getHeaders());
        } else if (options.jsonBody) {
            axiosRequestConfig.data = options.jsonBody;
            if (axiosRequestConfig.headers === undefined) {
                axiosRequestConfig.headers = {};
            }
            axiosRequestConfig.headers['Content-Type'] = 'application/json';
        } else if (options.data) {
            if (method === 'GET') {
                axiosRequestConfig.params = options.data;
                // URLSearchParams serializes spaces as "+", which is correct for a form body
                // but not for a URI query string. Any literal "+" in a value is already
                // escaped as %2B by this point, so every remaining "+" is a space.
                axiosRequestConfig.paramsSerializer = {
                    serialize: (params) =>
                        new URLSearchParams(params).toString().replace(/\+/g, '%20'),
                };
            } else {
                axiosRequestConfig.data = options.data;
            }
        }
        axiosRequestConfig.proxy = this.proxy;
        return axiosRequestConfig;
    }

    /**
     * Makes API request retrying if necessary, and returns (as Promise) response.
     * @param method HTTP method, for example 'GET'
     * @param url Path to endpoint, excluding base server URL.
     * @param options Additional options controlling request.
     * @param responseAsStream Set to true if the return type is IncomingMessage.
     * @return Fulfills with status code and response (as text or stream).
     */
    async sendRequestWithBackoff<TContent extends string | IncomingMessage>(
        method: HttpMethod,
        url: string,
        options?: SendRequestOptions,
        responseAsStream = false,
    ): Promise<{ statusCode: number; content: TContent }> {
        options = options === undefined ? {} : options;
        logInfo(`Request to DeepL API ${method} ${url}`);
        logDebug(`Request details: ${options.data}`);
        const backoff = new BackoffTimer();
        let response, error;
        while (backoff.getNumRetries() <= this.maxRetries) {
            const timeoutMs = Math.max(this.minTimeout, backoff.getTimeout());
            const axiosRequestConfig = this.prepareRequest(
                method,
                url,
                timeoutMs,
                responseAsStream,
                options,
            );
            try {
                response = await HttpClient.sendAxiosRequest<TContent>(axiosRequestConfig);
                error = undefined;
            } catch (e) {
                response = undefined;
                error = e as ConnectionError;
            }

            if (
                !HttpClient.shouldRetry(response?.statusCode, error) ||
                backoff.getNumRetries() + 1 >= this.maxRetries
            ) {
                break;
            }

            if (error !== undefined) {
                logDebug(`Encountered a retryable-error: ${error.message}`);
            }

            logInfo(
                `Starting retry ${backoff.getNumRetries() + 1} for request ${method}` +
                    ` ${url} after sleeping for ${backoff.getTimeUntilDeadline()} seconds.`,
            );
            await backoff.sleepUntilDeadline();
        }

        if (response !== undefined) {
            const { statusCode, content } = response;
            logInfo(`DeepL API response ${method} ${url} ${statusCode}`);
            if (!responseAsStream) {
                logDebug('Response details:', { content: content });
            }
            return response;
        } else {
            throw error as Error;
        }
    }

    /**
     * Performs given HTTP request and returns status code and response content (text or stream).
     * @param axiosRequestConfig
     * @private
     */
    private static async sendAxiosRequest<TContent extends string | IncomingMessage>(
        axiosRequestConfig: AxiosRequestConfig,
    ): Promise<{ statusCode: number; content: TContent }> {
        try {
            const response = await axiosInstance.request(axiosRequestConfig);
            if (response.headers !== undefined) {
                logDebug('Trace details:', {
                    xTraceId: response.headers['x-trace-id'],
                });
            }

            if (axiosRequestConfig.responseType === 'text') {
                // Workaround for axios-bug: https://github.com/axios/axios/issues/907
                if (typeof response.data === 'object') {
                    response.data = JSON.stringify(response.data);
                }
            }
            return {
                statusCode: response.status,
                content: response.data,
            };
        } catch (axios_error_raw) {
            const axiosError = axios_error_raw as AxiosError;
            const message: string = axiosError.message || '';

            const error = new ConnectionError(`Connection failure: ${message}`);
            error.error = axiosError;
            if (axiosError.code !== undefined && RETRYABLE_AXIOS_ERROR_CODES.has(axiosError.code)) {
                error.shouldRetry = true;
            } else {
                logDebug('Unrecognized axios error', axiosError);
                error.shouldRetry = false;
            }
            throw error;
        }
    }

    private static shouldRetry(statusCode?: number, error?: ConnectionError): boolean {
        if (statusCode === undefined) {
            return (error as ConnectionError).shouldRetry;
        }

        // Retry on Too-Many-Requests error and internal errors
        return statusCode === 429 || statusCode >= 500;
    }
}
