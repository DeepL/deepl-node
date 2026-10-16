// Copyright 2025 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import { randomBytes } from 'crypto';

const runId = (() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const stamp =
        `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
        `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}`;
    const rand = Array.from(randomBytes(6), (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]);
    return `${stamp}-${rand.join('')}`;
})();

/** Name for a resource created by this test run, e.g. sdktest-node-202610151530-k3f9qz-glossary. */
export function getUniqueName(label: string): string {
    return `sdktest-node-${runId}-${label}`;
}

// Real-API flow tests poll jobs that take a minute or more
export const testTimeout = 60000;
