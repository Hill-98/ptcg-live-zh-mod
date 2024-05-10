import {
    swalButtonDefaultOptions,
    swalButtonsNoOrYes,
    swalButtonsOK,
    swalButtonsQuit,
    swalButtonsYesOrNo,
} from './swalButtons.js';
import plugin from './plugin.js';
import PTCGLUtility from './utils/PTCGLUtility.js';
import versions from './utils/versions.js';
import versionParse from '../js-node/utils/versionParse.mjs';

const TERMS_OF_USE_VERSION = 2024050901;
const ASSETS_VERSION = 2024032201;

const INSTALL_BUTTON = document.getElementById('install-button');
const UNINSTALL_BUTTON = document.getElementById('uninstall-button');
const PLUGIN_SWITCH = document.getElementById('plugin-switch');
const STATUS_TEXT = document.getElementById('status-text');

const enableOrDisableAll = function enableOrDisableAll(enable) {
    if (enable) {
        INSTALL_BUTTON.removeAttribute('disabled');
        UNINSTALL_BUTTON.removeAttribute('disabled');
        PLUGIN_SWITCH.removeAttribute('disabled');
    } else {
        INSTALL_BUTTON.setAttribute('disabled', '');
        UNINSTALL_BUTTON.setAttribute('disabled', '');
        PLUGIN_SWITCH.setAttribute('disabled', '');
    }
};

const handleInstall = async function handleInstallButton() {
    await plugin.install();

    const p = document.createElement('p');
    let buttons = swalButtonsYesOrNo;

    const assetsVersion = await plugin.getAssetsInstalledVersion() ?? 0;
    let assetsAction = '安装';
    if (assetsVersion === 0) {
        p.innerHTML = `是否需要安装额外的中文化卡牌图片资源？<br>
如果选择不安装，游戏内的卡牌图片将不是中文。<br>
注：并非所有卡牌图片都有中文化。`;
    } else if (assetsVersion < ASSETS_VERSION) {
        assetsAction = '更新';
        p.innerHTML = '检测到你已安装的中文化卡牌图片资源不是最新版本，是否需要更新？';
    } else {
        return;
    }

    const result = await swal({
        buttons,
        icon: 'info',
        content: p,
    });

    if (result === 'yes') {
        let x = 1;
        let timer = 0;
        try {
            await plugin.installAssets((process) => {
                if (process === 'x') {
                    timer = setInterval(() => {
                        x++;
                        x = x > 3 ? 1 : x;
                        STATUS_TEXT.textContent = `正在准备${assetsAction}中文化资源文件${'.'.repeat(x)}`;
                    }, 500);
                } else {
                    clearInterval(timer);
                    STATUS_TEXT.textContent = `正在${assetsAction}中文化资源文件：${process}%`;
                }
            });
            clearInterval(timer);
        } catch (err) {
            clearInterval(timer);
            throw err;
        }
    }
};

const onInstallButtonClick = function onInstallButtonClick() {
    enableOrDisableAll(false);
    const action = INSTALL_BUTTON.dataset?.action === 'update' ? '更新' : '安装';
    handleInstall().then(() => swal({
        buttons: swalButtonsOK,
        icon: 'success',
        text: `中文化模组${action}操作已完成。`,
    })).catch((err) => swal({
        buttons: swalButtonsOK,
        icon: 'error',
        text: action + '中文化模组时出现错误：' + err.message,
    })).finally(() => {
        enableOrDisableAll(true);
        refreshState().catch(window.errorHandler);
    });
};

const onPluginSwitchClick = function handleSwitchEnable() {
    plugin.onOff(this.checked).catch((err) => swal({
        buttons: swalButtonsOK,
        icon: 'error',
        text: '出现错误：' + err.message,
    }));
};

const onUninstallButtonClick = function onUninstallButtonClick() {
    enableOrDisableAll(false);
    swal({
        buttons: swalButtonsYesOrNo,
        icon: 'info',
        text: '是否同时卸载 BepInEx？',
    }).then((value) => plugin.uninstall(value === 'yes'),).then(() => swal({
        buttons: swalButtonsOK,
        icon: 'success',
        text: `中文化模组卸载操作已完成。`,
    })).catch((err) => swal({
        buttons: swalButtonsOK,
        icon: 'error',
        text: '卸载中文化模组时出现错误：' + err.message,
    })).finally(() => {
        enableOrDisableAll(true);
        refreshState().catch(window.errorHandler);
    });
};

const refreshState = async function refreshState() {
    const installedModVersionText = document.querySelector('#mod-installed-version .version');
    const modVersionText = document.querySelector('#mod-version .version');

    let modVersion = '0.0.0.0';
    try {
        modVersion = await versions.mod();
        modVersionText.textContent = modVersion;
    } catch {
        modVersionText.textContent = '获取失败';
    }

    if (await plugin.installed()) {
        let installedModVersion = '0.0.0.0';
        try {
            installedModVersion = await versions.mod(true);
            installedModVersionText.parentElement.style.display = '';
            installedModVersionText.textContent = installedModVersion;
        } catch {
            installedModVersionText.textContent = '获取失败';
        }

        if (versionParse(installedModVersion) < versionParse(modVersion)) {
            INSTALL_BUTTON.dataset.action = 'update';
            INSTALL_BUTTON.textContent = '更新中文化模组';
        } else {
            INSTALL_BUTTON.dataset.action = 'reinstall';
            INSTALL_BUTTON.textContent = '重新安装中文化模组';
        }

        PLUGIN_SWITCH.checked = await plugin.switchState();
    } else {
        INSTALL_BUTTON.textContent = '安装中文化模组';
        UNINSTALL_BUTTON.setAttribute('disabled', '');
        PLUGIN_SWITCH.checked = false;
        PLUGIN_SWITCH.setAttribute('disabled', '');
        installedModVersionText.parentElement.style.display = 'none';
    }

    STATUS_TEXT.textContent = '';
};

const showQuitAlert = (text) => swal({
    buttons: swalButtonsQuit,
    icon: 'error',
    text,
}).then(() => window.app.quit());

const showTermsOfUse = function showTermsOfUse() {
    const p = swal({
        className: 'terms-of-use-modal',
        title: '使用条款',
        buttons: {
            confirm: {
                text: '同意',
                value: 'agree',
                ...swalButtonDefaultOptions,
            },
            cancel: {
                text: '拒绝',
                value: 'reject',
                ...swalButtonDefaultOptions,
            },
        },
        content: document.querySelector('#terms > .terms-of-use'),
    });
    setTimeout(() => {
        document.querySelector('.terms-of-use-modal .swal-button--cancel').focus();
    }, 500);
    return p.then((value) => Promise.resolve(value === 'agree'));
};

const main = async function main() {
    document.querySelector('#manager-version .version').textContent = await versions.manager(true);

    if (!await PTCGLUtility.isAvailable()) {
        await showQuitAlert('PTCGLUtility is not available');
        return;
    }

    if (await PTCGLUtility.PTCGLIsRunning()) {
        await showQuitAlert('检测到 Pokémon TCG Live 正在运行，请关闭游戏后重试。');
        return;
    }

    if (await PTCGLUtility.getPTCGLInstallDirectory() === null) {
        const dir = await PTCGLUtility.detectPTCGLInstallDirectory() ? await PTCGLUtility.getPTCGLInstallDirectory() : null;
        let select = window.OS.isWindows;
        if (dir === null && !window.OS.isWindows) {
            await showQuitAlert('未检测到 Pokémon TCG Live 游戏安装目录，请检查游戏是否已安装，或者尝试重新安装游戏。');
            return;
        }
        if (dir && window.OS.isWindows) {
            const p = document.createElement('p');
            p.innerHTML = `已检测到 Pokémon TCG Live 安装目录：
<b><a href="open-path://dir/${encodeURIComponent(dir)}" target="_blank" title="打开此目录" rel="external">${dir}</a></b><br>
是否需要选择其他安装目录？`;
            select = await swal({
                buttons: swalButtonsNoOrYes,
                icon: 'info',
                content: p,
            }) === 'yes';
            p.remove();
        }
        if (select) {
            try {
                if (!await PTCGLUtility.selectDirectory()) {
                    await showQuitAlert('你选择不是 Pokémon TCG Live 安装目录');
                    return;
                }
            } catch (err) {
                await showQuitAlert(`未选择 Pokémon TCG Live 游戏安装目录。\n\n${err.message}`);
                return;
            }
        }
    }

    const dir = await PTCGLUtility.getPTCGLInstallDirectory();
    const pathElement = document.querySelector('#game-path .path');
    pathElement.href = `open-path://dir/${encodeURIComponent(dir)}`;
    pathElement.textContent = dir;
    pathElement.title = dir + '\n点击以打开此路径';

    await refreshState();

    INSTALL_BUTTON.addEventListener('click', onInstallButtonClick);
    UNINSTALL_BUTTON.addEventListener('click', onUninstallButtonClick);
    PLUGIN_SWITCH.addEventListener('click', onPluginSwitchClick);
};

swal.setDefaults({
    closeOnClickOutside: false,
    closeOnEsc: false,
});

if (Number.parseInt(localStorage.getItem('TERMS_OF_USE_VERSION') || '0') !== TERMS_OF_USE_VERSION) {
    try {
        document.getElementById('app').style.display = 'none';
        const result = await showTermsOfUse();
        if (result) {
            localStorage.setItem('TERMS_OF_USE_VERSION', TERMS_OF_USE_VERSION.toString());
            document.getElementById('app').style.display = '';
        } else {
            await window.app.quit();
        }
    } catch (err) {
        await showQuitAlert('初始化过程中出现错误：' + err.message);
    }
}

try {
    await main();
} catch (err) {
    await showQuitAlert('初始化过程中出现错误：' + err.message);
}
