// Copyright 2022 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import { DocumentHandle } from './index';

export class DeepLError extends Error {
    public error?: Error;

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
    shouldRetry: boolean;
    /** True if the request failed before it was sent, so the server cannot have processed it. */
    requestNotSent = false;

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

export class GlossaryNotFoundError extends DeepLError {}

export class DocumentNotReadyError extends DeepLError {}

/**
 * Error thrown if an error occurs during the minification phase.
 * @see DocumentMinifier.minifyDocument
 */
export class DocumentMinificationError extends DeepLError {}

/**
 * Error thrown if an error occurs during the deminification phase.
 * @see DocumentMinifier.deminifyDocument
 */
export class DocumentDeminificationError extends DeepLError {}

export class ArgumentError extends DeepLError {}
