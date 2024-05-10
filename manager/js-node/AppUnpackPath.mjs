import { app } from 'electron';

export default (function () {
    return app.isPackaged ? app.getAppPath().replace('app.asar', 'app.asar.unpacked') : app.getAppPath();
})();
