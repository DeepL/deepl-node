// Example of translating HTML content into multiple target languages
import * as deepl from 'deepl-node';
import 'dotenv/config';

const authKey = process.env.DEEPL_AUTH_KEY;
if (authKey === undefined) {
    console.error(
        'You must specify your DeepL auth key as the environment variable DEEPL_AUTH_KEY',
    );
    process.exit(1);
}
const deeplClient = new deepl.DeepLClient(authKey);
// Enter some language codes.
var languageCodes = ['bg', 'de', 'it', 'es'];

// Applying the deeplClient to each language code. Using Promises to iterate through languages in parallel. Await waits for a response before conducting further logic on output.
let translatePromises = languageCodes.map((code) =>
    deeplClient
        .translateDocument('index.html', 'index_' + code + '.html', 'en', code)
        .catch((error) => {
            if (error.documentHandle) {
                const handle = error.documentHandle;
                console.log(
                    `Document ID: ${handle.documentId}, ` +
                        `Document key: ${handle.documentKey}` +
                        `For Language Code: ${code}, error occurred during document translation: ${error}`,
                );
            } else {
                console.log(
                    `For Language Code: ${code}, error occurred during document upload: ${error}`,
                );
            }
        }),
);
await Promise.all(translatePromises);
