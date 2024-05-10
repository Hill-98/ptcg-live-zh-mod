const { contextBridge, ipcRenderer } = require('electron/renderer');

contextBridge.exposeInMainWorld('OS', {
    isOSX: process.platform === 'darwin',
    isWindows: process.platform === 'win32',
});

const ipcWrapper = function ipcWrapper(channel, receive, ...args) {
    return new Promise((resolve, reject) => {
        const errorHandler = function errorHandler(ev, err) {
            reject(err);
            offEvents();
        };
        const resultHandler = function resultHandler(ev, value) {
            resolve(value);
            offEvents();
        };
        const offEvents = () => {
            ipcRenderer.off(channel + '.result', resultHandler);
            ipcRenderer.off(channel + '.error', errorHandler);
        };

        if (receive) {
            ipcRenderer.once(channel + '.result', resultHandler);
            ipcRenderer.once(channel + '.error', errorHandler);
            ipcRenderer.send(channel, ...args);
        } else {
            ipcRenderer.send(channel, ...args);
            resolve();
        }
    });
};

contextBridge.exposeInMainWorld('ipc', {
    wrapper: ipcWrapper,
    off() {
        return ipcRenderer.off(...arguments);
    },
    on() {
        return ipcRenderer.on(...arguments);
    },
});

contextBridge.exposeInMainWorld('app', {
    quit: ipcRenderer.send.bind(this,'quit'),
});
