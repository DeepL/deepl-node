import * as fs from 'fs';
import { FsHelper } from '../../../src/fsHelper';
import mock from 'mock-fs';

describe('FsHelper (without mocks)', () => {
    beforeEach(() => {
        // Use in-memory file system for fs, but load real folder from tests/resources
        mock();
    });

    afterEach(() => {
        mock.restore();
    });

    describe('readdirSyncRecursive', () => {
        let tempDir: string;

        beforeEach(() => {
            tempDir = fs.mkdtempSync('test-fs-helper-');
        });

        afterEach(() => {
            if (fs.existsSync(tempDir)) {
                FsHelper.removeSyncRecursive(tempDir);
            }
        });

        it('should throw an error if the directory does not exist', () => {
            expect(() => FsHelper.readdirSyncRecursive(`${tempDir}/nonexistent/`)).toThrowError(
                `Error: no such file or directory, ${tempDir}/nonexistent/`,
            );
        });

        it('should throw an error if the file does not exist', () => {
            fs.writeFileSync(`${tempDir}/file.txt`, 'content');

            expect(() => FsHelper.readdirSyncRecursive(`${tempDir}/file.txt`)).toThrowError(
                `Error: not a directory, ${tempDir}/file.txt`,
            );
        });

        it('should return an empty array if the directory is empty', () => {
            fs.mkdirSync(`${tempDir}/emptyDir`);
            expect(FsHelper.readdirSyncRecursive(`${tempDir}/emptyDir`)).toEqual([]);
        });

        it('should return an array of files and subdirectories', () => {
            fs.mkdirSync(`${tempDir}/dir`);
            fs.writeFileSync(`${tempDir}/dir/file1.txt`, 'content');
            fs.mkdirSync(`${tempDir}/dir/subDir`);
        });

        it('should return an array of files and subdirectories', () => {
            fs.mkdirSync(`${tempDir}/dir`);
            fs.writeFileSync(`${tempDir}/dir/file1.txt`, 'content');
            fs.writeFileSync(`${tempDir}/dir/file2.txt`, 'content');
            fs.mkdirSync(`${tempDir}/dir/emptyDir`);
            fs.mkdirSync(`${tempDir}/dir/subDir`);
            fs.writeFileSync(`${tempDir}/dir/subDir/subfile1.txt`, 'content');
            fs.writeFileSync(`${tempDir}/dir/subDir/subfile2.txt`, 'content');

            expect(FsHelper.readdirSyncRecursive(`${tempDir}/dir`)).toEqual(
                expect.arrayContaining([
                    'file1.txt',
                    'file2.txt',
                    'emptyDir',
                    'subDir',
                    'subDir/subfile1.txt',
                    'subDir/subfile2.txt',
                ]),
            );
        });
    });

    describe('removeSync', () => {
        let tempDir: string;

        beforeEach(() => {
            tempDir = fs.mkdtempSync('test-fs-helper-');
        });

        afterEach(() => {
            if (fs.existsSync(tempDir)) {
                FsHelper.removeSyncRecursive(tempDir);
            }
        });

        it('should throw an error if the file does not exist', () => {
            expect(() => FsHelper.removeSyncRecursive(`${tempDir}/nonexistent.txt`)).toThrowError(
                `Error: no such file or directory, ${tempDir}/nonexistent.txt`,
            );
        });

        it('should remove a file', () => {
            fs.writeFileSync(`${tempDir}/file.txt`, 'content');

            FsHelper.removeSyncRecursive(`${tempDir}/file.txt`);

            expect(fs.existsSync(`${tempDir}/file.txt`)).toBe(false);
        });

        it('should remove a directory with one file in it', () => {
            fs.mkdirSync(`${tempDir}/dir`);
            fs.writeFileSync(`${tempDir}/dir/file.txt`, 'content');

            FsHelper.removeSyncRecursive(`${tempDir}/dir`);

            expect(fs.existsSync(`${tempDir}/dir`)).toBe(false);
        });

        it('should remove a directory and its contents, including subdirectories', () => {
            fs.mkdirSync(`${tempDir}/dir`);
            fs.writeFileSync(`${tempDir}/dir/file1.txt`, 'content');
            fs.writeFileSync(`${tempDir}/dir/file2.txt`, 'content');
            fs.mkdirSync(`${tempDir}/dir/emptyDir`);
            fs.mkdirSync(`${tempDir}/dir/subDir`);
            fs.writeFileSync(`${tempDir}/dir/subDir/subfile1.txt`, 'content');
            fs.writeFileSync(`${tempDir}/dir/subDir/subfile2.txt`, 'content');

            FsHelper.removeSyncRecursive(`${tempDir}/dir`);

            expect(fs.existsSync(`${tempDir}/dir`)).toBe(false);
        });
    });
});
