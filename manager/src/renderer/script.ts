import * as ipc from './ipc.ts'
import { show as popup } from './PopupDialog.ts'
import './members.ts'
import './termsOfUse.ts'

type PrimaryAction = 'install' | 'start' | 'upgrade'

const ASSETS_NO_INSTALLED = '检测到当前尚未安装中文卡牌资源包，推荐安装以获得更好中文化体验，是否选择本地的中文卡牌资源包并安装？'
const ASSETS_VERSION_IS_LOW = '检测到当前安装的中文卡牌资源包不是最新版本，推荐更新以获得更好中文化体验，是否选择本地的中文卡牌资源包并更新？'

const app = ipc.app.functions
const game = ipc.game.functions

const e = {
  cardLeftText: document.getElementById('card-left-text') as HTMLInputElement,
  disablePlugin: document.getElementById('disable-plugin') as HTMLInputElement,
  gameInstallPath: document.getElementById('game-install-path') as HTMLInputElement,
  primaryButton: document.getElementById('primary-button') as HTMLButtonElement,
  reinstallButton: document.getElementById('reinstall-button') as HTMLButtonElement,
  selectGameInstallPath: document.getElementById('select-game-install-path') as HTMLButtonElement,
  statusText: document.getElementById('status-text') as HTMLSpanElement,
  uninstallButton: document.getElementById('uninstall-button') as HTMLButtonElement,
  version: document.getElementById('version') as HTMLSpanElement
}

async function errorPopup(err: any): Promise<ReturnType<typeof popup>> {
  return err instanceof Error
    ? popup(`发生错误：${err.message}\n${err.stack}`, '', 'error')
    : popup(`发生错误：${err}`, '', 'error')
}

function setAllButtonDisable(disable: boolean): void {
  document.querySelectorAll('button, input').forEach((e) => {
    if (disable) {
      e.setAttribute('disabled', 'disabled')
    } else {
      e.removeAttribute('disabled')
    }
  })
}

function setGameInstallDirectory(dir: string): void {
  e.gameInstallPath.value = dir
}

function setPrimaryButtonAction(action: PrimaryAction): void {
  e.primaryButton.dataset.action = action
  if (action === 'install') {
    e.primaryButton.textContent = '安装中文化模组'
  }
  if (action === 'start') {
    e.primaryButton.textContent = '启动游戏'
  }
  if (action === 'upgrade') {
    e.primaryButton.textContent = '更新中文化模组'
  }
}

function setStatusText(text: string) {
  e.statusText.textContent = text
}

async function install(): Promise<void> {
  setStatusText('正在安装中文化模组...')
  try {
    await app.installPlugin()
  } catch (err: any) {
    app.uninstallPlugin().catch(console.error)
    await popup(`安装中文化模组时发生错误，尝试关闭防病毒软件后重新安装。\n错误信息：${err.message}`, '', 'error')
    return
  }

  setStatusText('正在检查资源包版本...')
  const checkResult = await app.checkPluginAssets()
  if (!checkResult) {
    const popupText = checkResult === undefined
      ? ASSETS_NO_INSTALLED
      : ASSETS_VERSION_IS_LOW
    if ((await popup({ cancelButton: '否', confirmButton: '是', text: popupText })).confirmed) {
      setStatusText('正在等待用户选择文件...')
      while (true) {
        const asar = await app.selectPluginAssetsPackage()
        if (typeof asar === 'string') {
          setStatusText('正在准备安装中文卡牌资源包...')
          const progressHandler = (_: any, progress: string) => {
            setStatusText(`正在安装中文卡牌资源包 (${progress}%) ...`)
          }
          ipc.app.on('onInstallPluginAssets', progressHandler)
          try {
            await app.installPluginAssets(asar)
          } catch (err: any) {
            await popup(`安装中文卡牌资源包时发生错误，请尝试重新下载中文卡牌资源包后再次安装。\n错误信息：${err.message}`, '', 'error')
            return
          }
          ipc.app.off('onInstallPluginAssets', progressHandler)
          const result = await app.checkPluginAssets()
          if (result || (await popup({ cancelButton: '否', confirmButton: '是', text: ASSETS_VERSION_IS_LOW })).cancelled) {
            break
          }
        } else if (asar === 0) {
          await popup('您没有选择中文卡牌资源包，取消安装中文卡牌资源包。')
          break
        } else if (asar === 1) {
          await popup('您选择的不是中文卡牌资源包。')
        } else if (asar === 2) {
          await popup('您选择的中文卡牌资源包是升级包，但是可升级版本与当前已安装版本不匹配，请选择匹配的升级包或完整包。')
        }
      }

    }
  }
  setStatusText('中文化模组安装完成')
  await popup('中文化模组安装完成。')
}

async function main(): Promise<void> {
  setStatusText('正在检查外部实用工具可用性...')
  if (!await game.extUtilIsAvailable()) {
    await popup('外部实用工具不可用，尝试关闭防病毒软件后重新运行。', '', 'error')
    window.close()
    return
  }
  setStatusText('正在检查游戏是否正在运行...')
  if (await game.running()) {
    await popup('Pokémon TCG Live 正在运行，请先关闭游戏。', '', 'error')
    location.reload()
    return
  }

  if (!await app.hostnameIsValid()) {
    await popup('检测到您的计算机名称包含非法字符，将会导致游戏启动后出现错误，请将计算机名称更改为英文后重试。', '', 'warning')
    window.open('https://xtgs.mivm.cn/guide/faq/InvalidHostname')
    window.close()
    return
  }

  setStatusText('正在检查游戏安装目录...')
  let gameDir = await app.gameInstallDirectory()

  if (!await game.isInstallDirectory(gameDir)) {
    const auto = await game.detectInstallDirectory()
    const manual = !auto || (await popup({
      cancelButton: '否',
      confirmButton: '是',
      html: `
<p class="text-center break-words">
已找到 Pokémon TCG Live 安装目录<br><a class="text-sm text-blue-500 hover:underline" href="open-path://app/${encodeURIComponent(auto)}" rel="external" target="_blank">${auto}</a><br>是否需要选择其他位置的安装目录？
</p>`,
      icon: 'info',
    })).confirmed
    if (manual) {
      if (!auto) {
        await popup('未找到 Pokémon TCG Live 安装目录，请点击确定后手动选择游戏安装目录。', '', 'info')
      }
      const result = await app.selectGameInstallDirectory()
      if (typeof result === 'string' && result.trim() !== '') {
        gameDir = result
      } else {
        if (result === '') {
          await popup('您选择的不是 Pokémon TCG Live 安装目录。', '', 'error')
        }
        window.close()
        return
      }
    } else {
      gameDir = auto
    }
    await app.gameInstallDirectory(gameDir)
  }
  setGameInstallDirectory(gameDir)

  setStatusText('正在检查模组是否已安装...')
  if (await app.pluginInstalled()) {
    const upgradable = await app.pluginUpgradable()
    e.reinstallButton.style.display = upgradable ? 'none' : ''
    setPrimaryButtonAction(upgradable ? 'upgrade' : 'start')
  } else {
    e.reinstallButton.style.display = 'none'
    e.uninstallButton.style.display = 'none'
    setPrimaryButtonAction('install')
  }

  e.cardLeftText.checked = !!await app.pluginFeature('EnableCardGraphicText')
  e.disablePlugin.checked = await app.disablePlugin()

  setStatusText('准备就绪')
}

app.version().then((version) => {
  e.version.textContent = version
})

setAllButtonDisable(true)

try {
  await main()
} catch (err) {
  await errorPopup(err)
  window.close()
}

if (await app.pluginInstalled()) {
  e.cardLeftText.addEventListener('click', () => {
    setAllButtonDisable(true)
    app.pluginFeature('EnableCardGraphicText', e.cardLeftText.checked)
      .then((result) => {
        e.cardLeftText.checked = !!result
        if (result === undefined) {
          popup('未找到配置文件，请先启动一次游戏以自动生成配置文件。', '', 'warning').catch(console.error)
        }
        if (e.cardLeftText.checked) {
          popup('此功能为实验性功能，可能会对游戏造成未知影响，如果您在游戏里遇到了未知行为，请尝试关闭此功能后重新进入游戏。', '', 'warning').catch(console.error)
        }
      })
      .catch(errorPopup)
      .finally(setAllButtonDisable.bind(null, false))
  })

  e.disablePlugin.addEventListener('click', () => {
    setAllButtonDisable(true)
    app.disablePlugin(e.disablePlugin.checked)
      .then((result) => {
        e.disablePlugin.checked = result
      })
      .catch(errorPopup)
      .finally(setAllButtonDisable.bind(null, false))
  })

  e.reinstallButton.addEventListener('click', () => {
    setAllButtonDisable(true)
    install().finally(() => {
      location.reload()
    })
  })

  e.uninstallButton.addEventListener('click', () => {
    setAllButtonDisable(true)
    app.uninstallPlugin()
      .then(() => {
        return popup('中文化模组卸载完成。', '', 'info')
      })
      .catch(errorPopup)
      .finally(() => {
        location.reload()
      })
  })
} else {
  const noInstallHandler = (e: Event) => {
    e.preventDefault()
    popup(`请先安装中文化模组。`, '', 'info').catch(console.error)
  }
  e.cardLeftText.addEventListener('click', noInstallHandler)
  e.disablePlugin.addEventListener('click', noInstallHandler)
}

e.gameInstallPath.addEventListener('dblclick', () => {
  if (e.gameInstallPath.value !== '') {
    window.open(`open-path://app/${encodeURIComponent(e.gameInstallPath.value)}`)
  }
})

e.primaryButton.addEventListener('click', () => {
  setAllButtonDisable(true)
  const action = e.primaryButton.dataset.action as PrimaryAction
  if (action === 'install') {
    install().finally(() => {
      location.reload()
    })
  }
  if (action === 'start') {
    game.start()
      .then(() => {
        let count = 0
        const timer = setInterval(() => {
          if (count > 10) {
            setAllButtonDisable(false)
            clearInterval(timer)
            popup('启动游戏超时。', '', 'error').catch(console.error)
            return
          }
          game.running().then((result) => {
            if (result) {
              clearInterval(timer)
              setTimeout(window.close.bind(window), 1000)
            } else {
              count += 1
            }
          })
        }, 1000)
      })
      .catch((err: Error) => {
        setAllButtonDisable(false)
        popup(`启动游戏时发生错误。错误信息：${err.message}`, '', 'error').catch(console.error)
      })
  }
  if (action === 'upgrade') {
    install().finally(() => {
      location.reload()
    })
  }
})

e.selectGameInstallPath.addEventListener('click', () => {
  app.selectGameInstallDirectory().then((result) => {
    if (typeof result === 'string' && result.trim() !== '') {
      app.gameInstallDirectory(result)
        .then(() => setGameInstallDirectory(result))
        .then(() => {
          location.reload()
        })
    } else if (result === '') {
      popup('您选择的不是 Pokémon TCG Live 安装目录。', '', 'error').catch(console.error)
    }
  })
})

setAllButtonDisable(false)
e.primaryButton.focus()
