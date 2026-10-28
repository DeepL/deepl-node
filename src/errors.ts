// Copyright 2022 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import { DocumentHandle } from './index';

export class DeepLError extends Error {
    public error?: Error;
    /** HTTP status code of the failed response, or undefined if there was no HTTP response. */
    public httpStatusCode?: number;
    /**
     * True if retrying the request could succeed: HTTP 429, 5xx and transient network failures.
     * The client has already retried these up to `maxRetries` times before throwing.
     */
    public shouldRetry = false;

    constructor(message: string, error?: Error) {
        super(message);
        this.message = message;
        this.error = error;
    }
}

export class AuthorizationError extends DeepLError {}

export class QuotaExceededError extends DeepLError {}

export class TooManyRequestsError extends DeepLError {}

export class ConnectionError extends DeepLError {
    constructor(message: string, shouldRetry?: boolean, error?: Error) {
        super(message, error);
        this.shouldRetry = shouldRetry || false;
    }
}

export class DocumentTranslationError extends DeepLError {
    public readonly documentHandle?: DocumentHandle;

    constructor(message: string, handle?: DocumentHandle, error?: Error) {
        super(message, error);
        this.documentHandle = handle;
    }
}

/** Thrown when the API answers HTTP 404: the requested resource does not exist. */
export class NotFoundError extends DeepLError {}

/**
 * Thrown when the API answers HTTP 404 to a glossary request.
 * @deprecated Use NotFoundError instead, which this class extends. Will be removed in the next
 * major version.
 */
export class GlossaryNotFoundError extends NotFoundError {}

export class DocumentNotReadyError extends DeepLError {}

/**
 * Error thrown if an error occurs during the minification phase.
 * @see DocumentMinifier.minifyDocument
 * @deprecated Document minification is deprecated and will be removed in the next major version.
 * The DeepL API accepts larger documents; see the usage limits:
 * https://developers.deepl.com/docs/resources/usage-limits
 */
export class DocumentMinificationError extends DeepLError {}

/**
 * Error thrown if an error occurs during the deminification phase.
 * @see DocumentMinifier.deminifyDocument
 * @deprecated Document minification is deprecated and will be removed in the next major version.
 * The DeepL API accepts larger documents; see the usage limits:
 * https://developers.deepl.com/docs/resources/usage-limits
 */
export class DocumentDeminificationError extends DeepLError {}

export class ArgumentError extends DeepLError {}
