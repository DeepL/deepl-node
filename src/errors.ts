// Copyright 2022 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import { DocumentHandle } from './index';
import { TranslationMemoryJob } from './types';

export class DeepLError extends Error {
    public error?: Error;
    /** HTTP status code of the failed response, or undefined if there was no HTTP response. */
    public httpStatusCode?: number;
    /**
     * True if retrying the request could succeed: HTTP 429, 5xx and transient network failures.
     * The client has already retried these up to `maxRetries` times before throwing. For
     * methods that create a resource, which are not safe to repeat, it is true only for
     * failures where the request was not processed: HTTP 429, DNS failures, refused connections,
     * unreachable hosts or networks and timeouts before the connection was established. A
     * response body cut off mid-read is true in both cases.
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

/**
 * Thrown by translateDocument() for any failure, including an existing or unwritable output path,
 * except a missing or unreadable input file path (ArgumentError). The cause is in `error`;
 * `httpStatusCode` and `shouldRetry` are copied from it when it is a DeepLError.
 */
export class DocumentTranslationError extends DeepLError {
    public readonly documentHandle?: DocumentHandle;

    constructor(message: string, handle?: DocumentHandle, error?: Error) {
        super(message, error);
        this.documentHandle = handle;
        if (error instanceof DeepLError) {
            this.httpStatusCode = error.httpStatusCode;
            this.shouldRetry = error.shouldRetry;
        }
    }
}

/**
 * Thrown by importTranslationMemoryFromFilepath() and exportTranslationMemoryToFilepath() for any
 * failure except a missing input file (ArgumentError) and caller cancellation. The cause is in
 * `error`; `httpStatusCode` and `shouldRetry` are copied from it when it is a DeepLError.
 */
export class TranslationMemoryJobError extends DeepLError {
    /**
     * ID of the import or export job, set as soon as the job was created; undefined if the
     * failure happened before. Pass it to getTranslationMemoryJob() or
     * waitUntilTranslationMemoryJobDone() to resume.
     */
    public readonly jobId?: string;

    /**
     * The last job status the helper fetched; undefined before the first status check, e.g.
     * when the upload of an import fails.
     */
    public readonly job?: TranslationMemoryJob;

    constructor(message: string, jobId?: string, job?: TranslationMemoryJob, error?: Error) {
        super(message, error);
        this.jobId = jobId;
        this.job = job;
        if (error instanceof DeepLError) {
            this.httpStatusCode = error.httpStatusCode;
            this.shouldRetry = error.shouldRetry;
        }
    }
}

/** Thrown when the API answers HTTP 404: the requested resource does not exist. */
export class NotFoundError extends DeepLError {}

export class DocumentNotReadyError extends DeepLError {}

export class ArgumentError extends DeepLError {}
