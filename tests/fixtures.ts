// Copyright 2025 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import fs from 'fs';
import os from 'os';
import path from 'path';

export const inputText: Record<string, string> = {
    en: 'proton beam',
    de: 'Protonenstrahl',
};

/**
 * Creates a temp directory with an example .txt document, and returns its path, a path for the
 * translated output and the directory.
 */
export function createTextDocument(): [string, string, string] {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deepl-node-test-'));
    const exampleDocument = `${tempDir}/example_document.txt`;
    fs.writeFileSync(exampleDocument, inputText.en);
    return [exampleDocument, `${tempDir}/output_document.txt`, tempDir];
}
