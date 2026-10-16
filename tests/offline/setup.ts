// Copyright 2025 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import nock from 'nock';

nock.disableNetConnect();

afterEach(() => {
    const pending = nock.pendingMocks();
    nock.cleanAll();
    expect(pending).toEqual([]);
});
