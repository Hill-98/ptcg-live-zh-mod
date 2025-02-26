export type PopupBoxIcons = 'error' | 'info' | 'success' | 'warning'

export interface PopupBoxOption {
  cancelButton?: boolean | string
  confirmButton?: boolean | string
  html?: string | HTMLElement
  icon?: PopupBoxIcons
  id?: string
  priority?: number
  text?: string
  title?: string
}

export interface PopupMessageBoxResult {
  cancelled: boolean
  confirmed: boolean
}

const ICONS: { [key in PopupBoxIcons]: string } = {
  error: `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-12 text-red-400">
  <path fill-rule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-1.72 6.97a.75.75 0 1 0-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 1 0 1.06 1.06L12 13.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L13.06 12l1.72-1.72a.75.75 0 1 0-1.06-1.06L12 10.94l-1.72-1.72Z" clip-rule="evenodd" />
  </svg>
  `,
  info: `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-12 text-blue-400">
  <path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clip-rule="evenodd" />
  </svg>
`,
  success: `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-12 text-green-400">
    <path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clip-rule="evenodd" />
  </svg>
  `,
  warning: `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-12 text-yellow-400">
  <path fill-rule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clip-rule="evenodd" />
  </svg>
  `,
}

const POPUP_BOX_TEMPLATE = `
<div class="fixed size-full inset-0 flex items-center justify-center bg-black/50" data-popup-box="true">
<div
  class="max-h-[75%] p-5 flex flex-col backdrop-blur-md bg-white/75 dark:bg-black/75 rounded-md shadow shadow-neutral-700 dark:shadow-neutral-800 w-[352px]"
  role="alertdialog"
  aria-modal="true"
>
<h1 class="pb-2 font-bold text-2xl text-center" data-slot="title"></h1>
<div class="*:block *:mx-auto" data-slot="icon"></div>
<div class="pt-2 grow overflow-auto text-sm" data-slot="content"></div>
<div class="flex gap-4 justify-center pt-4" data-slot="footer">
<button
  class="px-4 py-2 cursor-pointer bg-blue-500 hover:bg-blue-600 active:bg-blue-700 rounded-md font-medium text-xs text-white"
  data-action="confirm"
  type="button"
></button>
<button
  class="px-4 py-2 cursor-pointer bg-red-500 hover:bg-red-600 active:bg-red-700 rounded-md font-medium text-xs text-white"
  data-action="cancel"
  type="button"
></button>
</div>
<button
  data-action="destroy"
  hidden="hidden"
  type="button"
></button>
<div>
</div>
`

const getId = function getPopupBoxId (id: string) {
  return `popup-box-${id}`
}

export const close = function closePopupBox (id: string) {
  (document.getElementById(getId(id))?.querySelector('button[data-action=destroy]') as HTMLButtonElement)?.click()
}

function showPopupBox (text: string, title?: string, icon?: PopupBoxIcons): Promise<PopupMessageBoxResult>
function showPopupBox (options: PopupBoxOption): Promise<PopupMessageBoxResult>
function showPopupBox (text: string | PopupBoxOption, title?: string, icon?: PopupBoxIcons): Promise<PopupMessageBoxResult> {
  const opt: PopupBoxOption = {
    confirmButton: true,
    icon,
    title,
    ...(typeof text === 'string' ? { text } : text),
  }

  const container = Object.assign(document.createElement('template'), { innerHTML: POPUP_BOX_TEMPLATE }).content.firstElementChild as HTMLDivElement
  const popupBox = container.querySelector('div') as HTMLDivElement
  const contentSlot = popupBox.querySelector('div[data-slot=content]') as HTMLDivElement
  const footerSlot = popupBox.querySelector('div[data-slot=footer]') as HTMLDivElement
  const iconSlot = popupBox.querySelector('div[data-slot=icon]') as HTMLDivElement
  const titleSlot = popupBox.querySelector('h1[data-slot=title]') as HTMLHeadingElement
  const cancelButton = popupBox.querySelector('button[data-action=cancel]') as HTMLButtonElement
  const confirmButton = popupBox.querySelector('button[data-action=confirm]') as HTMLButtonElement
  const destroyButton = popupBox.querySelector('button[data-action=destroy]') as HTMLButtonElement

  if (opt.id) {
    close(opt.id)
    container.id = getId(opt.id)
  }

  if (opt.icon) {
    iconSlot.innerHTML = ICONS[opt.icon]
  } else {
    iconSlot.remove()
  }

  if (opt.title) {
    titleSlot.textContent = opt.title
  } else {
    titleSlot.remove()
  }

  if (opt.html) {
    if (typeof opt.html === 'string') {
      contentSlot.innerHTML = opt.html
    } else {
      contentSlot.append(opt.html)
    }
  } else if (opt.text) {
    const p = document.createElement('p')
    p.classList.add('break-words', 'text-center', 'text-pretty')
    p.textContent = opt.text
    p.innerHTML = p.innerHTML.replaceAll('\n', '<br>')
    contentSlot.append(p)
  } else {
    contentSlot.remove()
  }

  if (opt.cancelButton) {
    cancelButton.textContent = typeof opt.cancelButton === 'string' ? opt.cancelButton : '取消'
  } else {
    cancelButton.remove()
  }

  if (opt.confirmButton) {
    confirmButton.textContent = typeof opt.confirmButton === 'string' ? opt.confirmButton : '确定'
  } else {
    confirmButton.remove()
  }

  if (!opt.cancelButton && !opt.confirmButton) {
    footerSlot.remove()
  }

  container.style.zIndex = opt.priority?.toString() ?? '1'

  document.body.append(container)
  container.classList.add('opacity-0', 'ease-in-out', 'duration-300')
  popupBox.classList.add('opacity-0', 'scale-50', 'ease-in-out', 'duration-300')
  requestIdleCallback(() => {
    container.classList.remove('opacity-0')
    popupBox.classList.remove('opacity-0', 'scale-50')
    popupBox.addEventListener('transitionend', () => {
      container.classList.remove( 'ease-in-out', 'duration-300')
      popupBox.classList.remove('ease-in-out', 'duration-300')
    }, { once: true })
  })

  const p = new Promise<PopupMessageBoxResult>((resolve, reject) => {
    const result = {
      cancelled: false,
      confirmed: false,
    }
    cancelButton.addEventListener('click', () => {
      result.cancelled = true
      resolve(result)
    }, { once: true })
    confirmButton.addEventListener('click', () => {
      result.confirmed = true
      resolve(result)
    }, { once: true })
    destroyButton.addEventListener('click', () => {
      reject(new Error('PopupBox destroyed'))
    }, { once: true })
  })

  p.finally(() => {
    container.classList.add('opacity-0', 'ease-in-out', 'duration-300')
    popupBox.classList.add('scale-0', 'ease-in-out', 'duration-300')
    container.addEventListener('transitionend', () => {
      container.remove()
    }, { once: true })
  })

  return p
}

export const show = showPopupBox

export default show
