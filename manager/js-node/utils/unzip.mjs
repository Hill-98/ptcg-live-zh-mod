import { open } from 'yauzl';
import { dirname, join, normalize } from 'path';
import fs from 'fs';

const extractFile = function extractFile(entry, output) {
    return new Promise((resolve, reject) => {
        if (fs.existsSync(output)) {
            fs.rmSync(output);
        }
        this.openReadStream(entry, (err, readStream) => {
            if (err) {
                reject(err);
                return;
            }
            const writeStream = fs.createWriteStream(output);
            readStream.once('end', () => {
                resolve();
            });
            readStream.once('error', reject);
            writeStream.once('error', reject);
            readStream.pipe(writeStream);
        });
    });
};

const openZip = function openZip(zipFile) {
    return new Promise((resolve, reject) => {
        open(zipFile, { lazyEntries: true }, (err, zip) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(zip);
        });
    });
};

export const all = async function unzipAll(zipFile, outputDir) {
    return new Promise((resolve, reject) => {
        openZip(zipFile).then((zip) => {
            const onerror = function onerror(err) {
                reject(err);
                zip.close();
            };

            zip.on('entry', (entry) => {
                if (entry.fileName.endsWith('/')) {
                    zip.readEntry();
                    return;
                }

                const file = join(outputDir, normalize(entry.fileName));
                const dir = dirname(file);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                extractFile.call(zip, entry, file).then(() => zip.readEntry()).catch(onerror);

            });
            zip.once('end', () => {
                resolve();
            });
            zip.once('error', (err) => {
                reject(err);
            });

            zip.readEntry();
        }).catch(reject);
    });
};

export const single = async function unzipSingle(zipFile, target, outputFile) {
    if (target.endsWith('/')) {
        throw new Error('target is a directory.');
    }
    return new Promise((resolve, reject) => {
        openZip(zipFile).then((zip) => {
            const onerror = function onerror(err) {
                reject(err);
                zip.close();
            };

            let found = false;

            zip.on('entry', (entry) => {
                if (entry.fileName === target) {
                    extractFile.call(zip, entry, outputFile).then(() => {
                        found = true;
                        zip.close();
                    }).catch(onerror);
                } else {
                    zip.readEntry();
                }
            });
            zip.once('close', () => {
                if (found) {
                    resolve();
                } else {
                    reject(new Error(`target file not found.`));
                }
            });
            zip.once('error', (err) => {
                reject(err);
            });

            zip.readEntry();
        }).catch(reject);
    });
};
