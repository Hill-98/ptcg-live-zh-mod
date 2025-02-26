import { app } from './ipc.ts'

const dialog = document.getElementById('terms-of-use') as HTMLDialogElement
const agreeButton = dialog.querySelector('button[data-action="agree"]') as HTMLButtonElement
const rejectButton = dialog.querySelector('button[data-action="reject"]') as HTMLButtonElement
const agreeHandler = dialog.close.bind(dialog, 'agree')
const rejectHandler = dialog.close.bind(dialog, 'reject')
const lastVersion = Number.parseInt(dialog.dataset.version ?? '0')

if (await app.functions.termsOfUseVersion() < lastVersion) {
  document.getElementById('app')!.style.display = 'none'

  agreeButton.addEventListener('click', agreeHandler)
  rejectButton.addEventListener('click', rejectHandler)

  const p = new Promise((resolve, reject) => {
    dialog.addEventListener('close', () => {
      if (dialog.returnValue === 'agree') {
        resolve(app.functions.termsOfUseVersion(lastVersion))
      } else {
        window.close()
        reject()
      }
    }, { once: true })
    dialog.showModal()
  }).finally(() => {
    agreeButton.removeEventListener('click', agreeHandler)
    rejectButton.removeEventListener('click', rejectHandler)
  })

  await p

  document.getElementById('app')!.style.display = ''
}
