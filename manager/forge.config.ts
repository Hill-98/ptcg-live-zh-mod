import { createHash } from 'node:crypto'
import { existsSync as exists } from 'node:fs'
import { appendFile, cp, mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join, parse } from 'node:path'
import type { ForgeConfig } from '@electron-forge/shared-types'
import { FuseV1Options, FuseVersion } from '@electron/fuses'
import { MakerDMG } from '@electron-forge/maker-dmg'
import { FusesPlugin } from '@electron-forge/plugin-fuses'
import { defineConfig, VitePlugin } from "@hill-98/electron-forge-plugin-vite"
import SevenZSFXMaker from 'electron-forge-maker-7zsfx'
import tailwindcss from '@tailwindcss/vite'
import pkg from './package.json' with { type: 'json' }

const _dirname = import.meta.dirname
const RESOURCES_BUNDLE_DIR = join(_dirname, 'resources/bundle')
const isDarwin = process.platform === 'darwin'
const BepInEx = {
  macos: {
    sum: '01c2ae782eb016dfd6c345a18dbd2dcafffb3d9d318449d6486689f426b4a323',
    url: 'https://github.com/BepInEx/BepInEx/releases/download/v5.4.23.5/BepInEx_macos_universal_5.4.23.5.zip'
  },
  windows: {
    sum: '82f9878551030f54657792c0740d9d51a09500eeae1fba21106b0c441e6732c4',
    url: 'https://github.com/BepInEx/BepInEx/releases/download/v5.4.23.5/BepInEx_win_x64_5.4.23.5.zip',
  },
}

export default {
  packagerConfig: {
    appBundleId: pkg.name,
    appCopyright: 'Copyright (c) 2024-2025 Hill-98@GitHub',
    appVersion: pkg.version,
    executableName: pkg.name,
    icon: join(_dirname, 'resources/icons/app'),
    ignore(path) {
      if (path === '') {
        return false
      }
      if (isDarwin) {
        return path.match(/^\/(\.vite|resources|package\.json)/) === null
      } else {
        return path.match(/^\/(\.vite|bin|resources|package\.json)/) === null
      }
    },
    name: pkg.productName,
    asar: {
      unpack: isDarwin ? undefined : '**/bin/**',
    },
  },
  makers: [
    new MakerDMG({
      format: 'ULFO',
      icon: join(_dirname, 'resources/icons/app.icns'),
      title: pkg.productName.concat(' ', pkg.version),
    }),
    new SevenZSFXMaker({}),
  ],
  plugins: [
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
    new VitePlugin({
      configs: defineConfig({
        renderer: {
          plugins: [
            tailwindcss(),
          ]
        }
      }),
    }),
  ],
  hooks: {
    async generateAssets() {
      const bepInEx = join(RESOURCES_BUNDLE_DIR, 'BepInEx.zip')
      const downloadItem = isDarwin ? BepInEx.macos : BepInEx.windows
      if (!exists(bepInEx) || createHash('sha256').update(await readFile(bepInEx)).digest('hex').toLowerCase() !== downloadItem.sum) {
        console.warn('Downloading BepInEx ...')
        const response = await fetch(downloadItem.url)
        if (response.status !== 200) {
          throw new Error('Failed to download BepInEx.')
        }
        await writeFile(bepInEx, await response.bytes())
      }
      if (isDarwin) {
        await cp(join(_dirname, '../BepInExOSXLoader'), join(RESOURCES_BUNDLE_DIR, 'BepInExOSXLoader'), { recursive: true })
      }
      const modDir = join(RESOURCES_BUNDLE_DIR, 'mod')
      if (!exists(modDir)) {
        await mkdir(modDir)
        await mkdir(join(modDir, 'databases'))
        await mkdir(join(modDir, 'fonts'))
        await mkdir(join(modDir, 'text'))
        await cp(join(_dirname, '../dist/PTCGLiveZhMod.dll'), join(modDir, 'PTCGLiveZhMod.dll'))
        await cp(join(_dirname, `../fonts/TextMeshPro_font.${isDarwin ? 'osx' : 'windows'}`), join(modDir, 'fonts/TextMeshPro_font'))
        const files = [
          ...await readdir(join(_dirname, '../databases_zh-CN'), { withFileTypes: true }),
          ...await readdir(join(_dirname, '../text_zh-CN'), { withFileTypes: true }),
        ]
        for (const file of files) {
          const fullPath = join(file.parentPath, file.name)
          const path = parse(fullPath)
          const out = join(modDir, file.parentPath.includes('databases') ? 'databases' : 'text', `${path.name}.txt`)
          const map = JSON.parse(await readFile(fullPath, { encoding: 'utf8' }))
          for (const key in map) {
            const value = map[key].trimEnd()
            await appendFile(out, `|${key}:${value}\n`, { encoding: 'utf8' })
          }
        }
      }

    },
    async packageAfterExtract(_, buildPath) {
      await rename(join(buildPath, 'LICENSE'), join(buildPath, 'LICENSE.electron.txt'))
      await cp(join(_dirname, '../LICENSE'), join(buildPath, 'LICENSE.txt'), { force: true })
      await rm(join(buildPath, 'version'), { force: true })
    },
  },
} satisfies ForgeConfig
