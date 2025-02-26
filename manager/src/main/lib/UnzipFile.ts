import { createWriteStream, existsSync as exists } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import type { Entry, Options, ZipFile } from 'yauzl'
import { open } from 'yauzl'

export default class UnzipFile {
  readonly #zipFile: string

  constructor(file: string) {
    this.#zipFile = file
  }

  async #open(options?: Options): Promise<ZipFile> {
    return new Promise<ZipFile>((resolve, reject) => {
      open(this.#zipFile, { lazyEntries: true, ...options }, (err, zip) => {
        if (err) {
          reject(err)
          return
        }
        resolve(zip)
      })
    })
  }

  async extract(output: string, entries: string[] = []): Promise<void> {
    const zip = await this.#open()

    if (!exists(output)) {
      await mkdir(output, { recursive: true })
    }

    return new Promise((resolve, reject) => {
      const onerror = function onerror(err: Error) {
        reject(err)
        zip.removeAllListeners('close')
        zip.close()
      }

      zip.on('entry', (entry: Entry) => {
        if (entries.length !== 0 && !entries.some((v) => v.endsWith('/') ? entry.fileName.startsWith(v) : entry.fileName === v)) {
          zip.readEntry()
          return
        }

        const out = join(output, entry.fileName)
        const p = (exists(dirname(out)) ? Promise.resolve() : mkdir(dirname(out), { recursive: true }))
        p.then(() => {
          zip.openReadStream(entry, (err, readStream) => {
            if (err) {
              onerror(err)
              return
            }
            const writeStream = createWriteStream(out)
            pipeline(readStream, writeStream)
              .then(() => zip.readEntry())
              .catch(onerror)
          })
        }).catch(onerror)

      })

      zip.once('error', (err) => {
        reject(err)
      })

      zip.once('close', () => {
        resolve()
      })

      zip.readEntry()
    })
  }
}
