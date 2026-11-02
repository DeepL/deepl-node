// Copyright 2022 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

const deepl = require('deepl-node');

const authKey = process.env['DEEPL_AUTH_KEY'];
const serverUrl = process.env['DEEPL_SERVER_URL'];
const deeplClient = new deepl.DeepLClient(authKey, { serverUrl: serverUrl });

deeplClient
    .getUsage()
    .then((usage) => {
        console.log(usage);
        return deeplClient.translateText('Hello, world!', null, 'fr');
    })
    .then((result) => {
        console.log(result.text); // Bonjour, le monde !
    })
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
