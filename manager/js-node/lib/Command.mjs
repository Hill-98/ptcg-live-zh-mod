import { spawnSync } from 'node:child_process';

class Command {
    #cli = '';

    #options = {
        encoding: 'utf8',
        trim: true,
        windowsVerbatimArguments: false,
    };

    #testArgs = [];

    constructor(cli, options = {}, testArgs = ['--help']) {
        this.#cli = cli;
        if (Array.isArray(options)) {
            this.#testArgs = options;
        } else {
            this.#options = {
                ...this.#options,
                ...options,
            };
            this.#testArgs = testArgs;
        }
    }

    get encoding() {
        return this.#options.encoding === 'url' ? 'utf-8' : this.#options.encoding;
    }

    #decodeOutput(str) {
        let result = str;
        if (this.#options.encoding === 'url') {
            result = decodeURIComponent(result);
        }
        if (this.#options.trim) {
            result = result.trim();
        }
        return result;
    }

    exec(...args) {
        const p = spawnSync(this.#cli, args, {
            encoding: this.encoding,
            windowsVerbatimArguments: this.#options.windowsVerbatimArguments,
        });
        return {
            status: p.status,
            stderr: typeof p.stderr === 'string' ? this.#decodeOutput(p.stderr) : p.stderr,
            stdout: typeof p.stdout === 'string' ? this.#decodeOutput(p.stdout) : p.stdout,
        };
    }

    isAvailable() {
        try {
            return this.exec(...this.#testArgs).status === 0;
        } catch (err) {
            console.error(err);
        }
        return false;
    }
}

export default Command;
