import { app, ipcMain } from 'electron';
import { normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const appPath = normalize(app.getAppPath());
const senderCache = new Map();

/**
 * @param {boolean} error
 * @param {*} result
 * @returns {Promise<*>}
 */
const resultPromiseWrapper = function resultPromiseWrapper(error, result) {
    return typeof result === 'object' && result instanceof Promise
        ? result.then(resultPromiseWrapper.bind(this, false)).catch(resultPromiseWrapper.bind(this, true))
        : (error ? Promise.reject(result) : Promise.resolve(result));
};

const validateSender = function validateSender(id, frame) {
    const cache = senderCache.get(id);
    if (typeof cache !== 'undefined') {
        return cache;
    }
    try {
        const valid = frame.url.startsWith('file:') && normalize(fileURLToPath(frame.url)).startsWith(appPath);
        senderCache.set(id, valid);
        return valid;
    } catch (err) {
        console.error(err);
    }
};

app.on('web-contents-created', (ev, webContents) => {
    if (senderCache.has(webContents.mainFrame.processId)) {
        senderCache.delete(webContents.mainFrame.processId)
    }
});

/**
 * @callback ipcWrapperCallback
 * @param {...*} args
 * @returns {*}
 */

/**
 * @param {string} channel
 * @param {ipcWrapperCallback} callback
 * @param {boolean} eventArg
 */
export const wrapper = function wrapper(channel, callback, eventArg = false) {
    ipcMain.on(channel, (ev, ...args) => {
        if (!validateSender(ev.processId, ev.senderFrame)) {
            return;
        }
        try {
            resultPromiseWrapper(false, eventArg ? callback(ev, ...args) : callback(...args))
                .then((result) => {
                    ev.sender.send(channel + '.result', result);
                })
                .catch((err) => {
                    console.error(err);
                    ev.sender.send(channel + '.error', err);
                });
        } catch (err) {
            console.error(err);
            ev.sender.send(channel + '.error', err);
        }
    });
};

/**
 * @param {string} channel
 * @param {WebContents} sender
 * @param {number?} interval
 */
export const processWrapper = function processWrapper(channel, sender, interval = 0) {
    return {
        emitted: false,
        emit(value) {
            if (!this.emitted) {
                sender.send(channel + '.process', value);
                this.emitted = interval !== 0;
            }
            if (!this.waiting && this.emitted) {
                this.waiting = true;
                setTimeout(() => {
                    this.emitted = false;
                    this.waiting = false;
                }, interval);
            }
        },
        waiting: false,
    }
};

export default {
    wrapper,
    processWrapper,
};
