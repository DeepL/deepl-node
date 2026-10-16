import * as path from 'path';
import * as fs from 'fs';
import AdmZip from 'adm-zip';
import { randomFillSync } from 'crypto';

const MINIFIABLE_FILE_SIZE = 90000000;

export const createMinifiableTestDocument = (
    testFilePath: string,
    tempZipContentDirectory: string,
    outputDirectory: string,
): string => {
    if (!fs.existsSync(testFilePath)) {
        throw new Error(`Test file does not exist: ${testFilePath}`);
    }
    const zipExtractor = new AdmZip(testFilePath);
    zipExtractor.extractAllTo(tempZipContentDirectory);

    // Create a placeholder file of size 90 MB filled with random data to avoid compression
    const buffer = new Uint8Array(MINIFIABLE_FILE_SIZE);
    randomFillSync(buffer);
    fs.writeFileSync(path.join(tempZipContentDirectory, 'placeholder_image.png'), buffer);

    const fileName = path.basename(testFilePath);
    const outputFilePath = path.join(outputDirectory, fileName);
    const zipCombiner = new AdmZip();
    zipCombiner.addLocalFolder(tempZipContentDirectory);
    zipCombiner.writeZip(outputFilePath);
    return outputFilePath;
};
