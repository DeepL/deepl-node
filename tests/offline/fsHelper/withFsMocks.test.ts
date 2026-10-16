import { FsHelper } from '../../../src/fsHelper';
import * as fs from 'fs';
import * as path from 'path';
jest.mock('fs');

describe('FsHelper (with mocks)', () => {
    describe('readdirSyncRecursive', () => {
        beforeEach(() => {
            jest.resetAllMocks();
        });

        it('should throw an error if the directory does not exist', () => {
            jest.spyOn(fs, 'existsSync').mockReturnValue(false);
            expect(() => FsHelper.readdirSyncRecursive('nonexistent/')).toThrowError(
                'Error: no such file or directory, nonexistent/',
            );
        });

        it('should throw an error if the file does not exist', () => {
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.statSync as jest.Mock).mockReturnValueOnce({ isDirectory: () => false });

            expect(() => FsHelper.readdirSyncRecursive('file.txt')).toThrowError(
                'Error: not a directory, file.txt',
            );
        });

        it('should return an empty array if the directory is empty', () => {
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.readdirSync as jest.Mock).mockReturnValue([]);
            (fs.statSync as jest.Mock).mockReturnValueOnce({ isDirectory: () => true });

            expect(FsHelper.readdirSyncRecursive('emptyDir')).toEqual([]);
        });

        it('should return an array of files and subdirectories', () => {
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.statSync as jest.Mock).mockReturnValueOnce({ isDirectory: () => true });
            (fs.readdirSync as jest.Mock).mockReturnValueOnce([
                'file1.txt',
                'file2.txt',
                'emptyDir',
                'subDir',
            ]);
            (fs.statSync as jest.Mock).mockReturnValueOnce({ isDirectory: () => false });
            (fs.statSync as jest.Mock).mockReturnValueOnce({ isDirectory: () => false });

            (fs.statSync as jest.Mock).mockReturnValueOnce({ isDirectory: () => true });
            (fs.statSync as jest.Mock).mockReturnValueOnce({ isDirectory: () => true });
            (fs.readdirSync as jest.Mock).mockReturnValueOnce([]);

            (fs.statSync as jest.Mock).mockReturnValueOnce({ isDirectory: () => true });
            (fs.statSync as jest.Mock).mockReturnValueOnce({ isDirectory: () => true });
            (fs.readdirSync as jest.Mock).mockReturnValueOnce(['subfile1.txt', 'subfile2.txt']);
            (fs.statSync as jest.Mock).mockReturnValueOnce({ isDirectory: () => false });
            (fs.statSync as jest.Mock).mockReturnValueOnce({ isDirectory: () => false });

            expect(FsHelper.readdirSyncRecursive('dir')).toEqual([
                'file1.txt',
                'file2.txt',
                'emptyDir',
                'subDir',
                'subDir/subfile1.txt',
                'subDir/subfile2.txt',
            ]);
        });
    });

    describe('removeSyncRecursive', () => {
        beforeEach(() => {
            jest.resetAllMocks();
        });

        it('should throw an error if the file does not exist', () => {
            (fs.existsSync as jest.Mock).mockReturnValue(false);
            expect(() => FsHelper.removeSyncRecursive('nonexistent.txt')).toThrowError(
                'Error: no such file or directory, nonexistent.txt',
            );
        });

        it('should remove a file', () => {
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.statSync as jest.Mock).mockReturnValue({ isDirectory: () => false });

            const unlinkSyncSpy = jest.spyOn(fs, 'unlinkSync');

            FsHelper.removeSyncRecursive('file.txt');

            expect(unlinkSyncSpy).toHaveBeenCalledWith('file.txt');
        });

        it('should remove a directory with one file in it', () => {
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.statSync as jest.Mock).mockReturnValueOnce({ isDirectory: () => true });
            (fs.readdirSync as jest.Mock).mockReturnValueOnce(['file.txt']);

            (fs.readdirSync as jest.Mock).mockReturnValueOnce([]);
            (fs.statSync as jest.Mock).mockReturnValueOnce({ isDirectory: () => false });

            const unlinkSyncSpy = jest.spyOn(fs, 'unlinkSync');
            const rmdirSyncSpy = jest.spyOn(fs, 'rmdirSync');

            FsHelper.removeSyncRecursive('dir');

            expect(unlinkSyncSpy).toHaveBeenNthCalledWith(1, 'dir/file.txt');
            expect(rmdirSyncSpy).toHaveBeenNthCalledWith(1, 'dir');
        });

        it('should remove a directory and its contents, including subdirectories', () => {
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.statSync as jest.Mock).mockReturnValueOnce({ isDirectory: () => true });
            (fs.readdirSync as jest.Mock).mockReturnValueOnce([
                'file1.txt',
                'file2.txt',
                'emptyDir',
                'subDir',
            ]);

            (fs.statSync as jest.Mock).mockReturnValueOnce({ isDirectory: () => false });
            (fs.statSync as jest.Mock).mockReturnValueOnce({ isDirectory: () => false });

            (fs.statSync as jest.Mock).mockReturnValueOnce({ isDirectory: () => true });
            (fs.readdirSync as jest.Mock).mockReturnValueOnce([]);

            (fs.statSync as jest.Mock).mockReturnValueOnce({ isDirectory: () => true });
            (fs.readdirSync as jest.Mock).mockReturnValueOnce(['subfile1.txt', 'subfile2.txt']);

            (fs.statSync as jest.Mock).mockReturnValueOnce({ isDirectory: () => false });
            (fs.statSync as jest.Mock).mockReturnValueOnce({ isDirectory: () => false });

            const unlinkSyncSpy = jest.spyOn(fs, 'unlinkSync');
            const rmdirSyncSpy = jest.spyOn(fs, 'rmdirSync');

            FsHelper.removeSyncRecursive('dir');

            expect(unlinkSyncSpy).toHaveBeenCalledWith('dir/file1.txt');
            expect(unlinkSyncSpy).toHaveBeenCalledWith('dir/file2.txt');
            expect(rmdirSyncSpy).toHaveBeenCalledWith('dir/emptyDir');
            expect(unlinkSyncSpy).toHaveBeenCalledWith('dir/subDir/subfile1.txt');
            expect(unlinkSyncSpy).toHaveBeenCalledWith('dir/subDir/subfile2.txt');
            expect(rmdirSyncSpy).toHaveBeenCalledWith('dir/subDir');
            expect(rmdirSyncSpy).toHaveBeenCalledWith('dir');
        });

        it('should only remove paths that are within the provided input dir and not delete other files on the machine', () => {
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.statSync as jest.Mock).mockReturnValueOnce({ isDirectory: () => true });
            (fs.readdirSync as jest.Mock).mockReturnValueOnce(['subDir']);

            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.statSync as jest.Mock).mockReturnValueOnce({ isDirectory: () => true });
            (fs.readdirSync as jest.Mock).mockReturnValueOnce(['subfile1.txt', 'subfile2.txt']);

            (fs.statSync as jest.Mock).mockReturnValueOnce({ isDirectory: () => false });
            (fs.statSync as jest.Mock).mockReturnValueOnce({ isDirectory: () => false });

            const unlinkSyncSpy = jest.spyOn(fs, 'unlinkSync');
            const rmdirSyncSpy = jest.spyOn(fs, 'rmdirSync');

            const inputDir = 'dir';
            FsHelper.removeSyncRecursive(inputDir);

            expect(unlinkSyncSpy).toHaveBeenCalledWith('dir/subDir/subfile1.txt');
            expect(unlinkSyncSpy).toHaveBeenCalledWith('dir/subDir/subfile2.txt');
            expect(rmdirSyncSpy).toHaveBeenCalledWith('dir/subDir');
            expect(rmdirSyncSpy).toHaveBeenCalledWith('dir');

            const expectIsSubpath = (parentPath: string, childPath: string) => {
                expect(childPath.includes(parentPath)).toBe(true);
                expect(childPath.indexOf(parentPath) === 0).toBe(true);
            };

            const allCalls = [...unlinkSyncSpy.mock.calls, ...rmdirSyncSpy.mock.calls];
            allCalls.forEach((params) => {
                const inputDirPath = path.resolve(inputDir);
                const callPath = path.resolve(params[0] as string);
                expectIsSubpath(inputDirPath, callPath);
            });
        });
    });
});
