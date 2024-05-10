export const manager = function managerVersion(detailed) {
    return window.ipc.wrapper('versions.manager', true)
        .then((obj) => Promise.resolve( detailed ? `${obj.app} (Electron ${obj.electron} on ${obj.platform})` : obj.app))
};

export const mod = function modVersion(installed = false) {
    return window.ipc.wrapper('versions.mod', true, installed);
};

export default {
    manager,
    mod,
};
