import { existsSync as exists } from 'node:fs'
import { appendFile, cp, mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join, parse } from 'node:path'
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

/** @type {import('@electron-forge/shared-types').ForgeConfig} */
const config = {
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
      if (!exists(bepInEx)) {
        const response = await fetch(`https://github.com/BepInEx/BepInEx/releases/download/v5.4.23.2/BepInEx_${isDarwin ? 'macos' : 'win'}_x64_5.4.23.2.zip`)
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
        await cp(join(_dirname, `../fonts/NotoSansSC_sdf32_optimized_12k_lzma_2019_${isDarwin ? 'macos' : 'windows'}.asset`), join(modDir, 'fonts/NotoSansSC_sdf32_optimized_12k_lzma_2019'))
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
    async packageAfterExtract(config, buildPath) {
      await rename(join(buildPath, 'LICENSE'), join(buildPath, 'LICENSE.electron.txt'))
      await cp(join(_dirname, '../LICENSE'), join(buildPath, 'LICENSE.txt'), { force: true })
      await rm(join(buildPath, 'version'), { force: true })
    },
  },
}

export default config
