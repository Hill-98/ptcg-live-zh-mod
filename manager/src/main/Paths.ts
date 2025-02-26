import { app as electron } from 'electron'
import { join } from 'node:path'

export const app = electron.getAppPath()

export const unpack = app.replace('app.asar', 'app.asar.unpacked')

export const bin = join(unpack, 'bin')

export const resources = join(app, 'resources')

export const resourcesBundle = join(resources, 'bundle')
