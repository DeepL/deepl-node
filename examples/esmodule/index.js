// Copyright 2022 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import * as deepl from 'deepl-node';

const authKey = process.env['DEEPL_AUTH_KEY'];
const serverUrl = process.env['DEEPL_SERVER_URL'];
const deeplClient = new deepl.DeepLClient(authKey, { serverUrl: serverUrl });

(async () => {
    try {
        console.log(await deeplClient.getUsage());

        const result = await deeplClient.translateText('Hello, world!', null, 'fr');

        console.log(result.text); // Bonjour, le monde !
    } catch (error) {
        console.log(error);
        process.exit(1);
    }
})();
