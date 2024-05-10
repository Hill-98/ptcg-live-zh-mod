export const getAssetsInstalledVersion = window.ipc.wrapper.bind(this, 'getAssetsInstalledVersion', true);

export const install = window.ipc.wrapper.bind(this, 'installPlugin', true);

export const installAssets = function installAssets(processCb) {
    return new Promise((resolve, reject) => {
        const ipcCb = function installAssetsIpcCb(ev, process) {
            processCb(process);
        };
        window.ipc.wrapper('installAssets', true).then(resolve).catch(reject).finally(() => {
            window.ipc.off('installAssets.process', ipcCb);
        });
        window.ipc.on('installAssets.process', ipcCb);
    });
};

export const installed = window.ipc.wrapper.bind(this, 'pluginInstalled', true);

export const onOff = window.ipc.wrapper.bind(this, 'switchPlugin', true);

export const switchState = window.ipc.wrapper.bind(this, 'getPluginSwitchState', true);

export const uninstall = window.ipc.wrapper.bind(this, 'uninstallPlugin', true);

export default {
    getAssetsInstalledVersion,
    install,
    installAssets,
    installed,
    onOff,
    switchState,
    uninstall,
};
