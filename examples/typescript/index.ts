import * as deepl from 'deepl-node';

const authKey = process.env['DEEPL_AUTH_KEY'];
if (authKey === undefined) throw new Error('DEEPL_AUTH_KEY environment variable not defined');
const serverUrl = process.env['DEEPL_SERVER_URL'];
const deeplClient = new deepl.DeepLClient(authKey, { serverUrl: serverUrl });

(async () => {
    try {
        console.log(await deeplClient.getUsage());

        const targetLang: deepl.TargetLanguageCode = 'fr';

        const result: deepl.TextResult = await deeplClient.translateText(
            'Hello, world!',
            null,
            targetLang,
        );

        console.log(result.text); // Bonjour, le monde !
    } catch (error) {
        console.log(error);
        process.exit(1);
    }
})();
