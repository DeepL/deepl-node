// Copyright 2025 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import nock from 'nock';

nock.disableNetConnect();

// Each test file loads its own nock, which wraps the http functions that all files in a jest
// worker share. Remove this file's wrapper when it ends, so a later file's nock.restore() really
// lets requests through instead of reaching this file's nock, which refuses them (ENETUNREACH).
afterAll(() => {
    nock.restore();
});

afterEach(() => {
    const pending = nock.pendingMocks();
    nock.cleanAll();
    expect(pending).toEqual([]);
});
