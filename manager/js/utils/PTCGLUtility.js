export const detectPTCGLInstallDirectory = window.ipc.wrapper.bind(this, 'detectPTCGLInstallDirectory', true);
export const getPTCGLInstallDirectory = window.ipc.wrapper.bind(this, 'getPTCGLInstallDirectory', true);
export const isAvailable = window.ipc.wrapper.bind(this, 'PTCGLUtilityIsAvailable', true);
export const PTCGLIsRunning = window.ipc.wrapper.bind(this, 'PTCGLIsRunning', true);
export const selectDirectory = window.ipc.wrapper.bind(this, 'selectDirectory', true);

export default {
    detectPTCGLInstallDirectory,
    getPTCGLInstallDirectory,
    isAvailable,
    PTCGLIsRunning,
    selectDirectory,
};
