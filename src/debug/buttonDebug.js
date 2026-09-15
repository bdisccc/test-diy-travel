const PREFIX = '[ButtonDebug]'

let installed = false
let mutationVersion = 0
let lastInteraction = null
let cleanupFns = []

function buttonLabel(button) {
  if (!button) return 'Unknown button'
  return (
    button.dataset.debugName ||
    button.getAttribute('aria-label') ||
    button.getAttribute('title') ||
    button.textContent?.replace(/\s+/g, ' ').trim() ||
    'Unnamed button'
  )
}

function reactProps(element) {
  if (!element) return null
  const key = Object.keys(element).find((name) => name.startsWith('__reactProps$'))
  return key ? element[key] : null
}

function hasReactHandler(element, handlerName) {
  const props = reactProps(element)
  return typeof props?.[handlerName] === 'function'
}

function storageFingerprint() {
  try {
    const parts = []
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (key) parts.push(`${key}:${localStorage.getItem(key)}`)
    }
    return parts.sort().join('|')
  } catch {
    return 'storage-unavailable'
  }
}

function buttonAtPoint(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  const candidates = [...document.querySelectorAll('button')].filter((button) => {
    const rect = button.getBoundingClientRect()
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
  })
  return candidates.sort((a, b) => {
    const aRect = a.getBoundingClientRect()
    const bRect = b.getBoundingClientRect()
    return aRect.width * aRect.height - bRect.width * bRect.height
  })[0] || null
}

function inspectButton(button, point = null) {
  if (!(button instanceof HTMLButtonElement)) return null

  const rect = button.getBoundingClientRect()
  const style = getComputedStyle(button)
  const x = point?.x ?? rect.left + rect.width / 2
  const y = point?.y ?? rect.top + rect.height / 2
  const pointIsOnScreen = x >= 0 && y >= 0 && x <= window.innerWidth && y <= window.innerHeight
  const topElement = pointIsOnScreen ? document.elementFromPoint(x, y) : null
  const topElementBelongsToButton = Boolean(topElement && (topElement === button || button.contains(topElement)))
  const form = button.form
  const type = (button.getAttribute('type') || 'submit').toLowerCase()
  const clickHandler = typeof button.onclick === 'function' || hasReactHandler(button, 'onClick')
  const submitHandler = Boolean(form && (typeof form.onsubmit === 'function' || hasReactHandler(form, 'onSubmit')))
  const reasons = []
  const debugReason = button.dataset.debugReason || ''

  if (button.disabled) reasons.push(debugReason || 'Button has the disabled attribute.')
  if (button.getAttribute('aria-disabled') === 'true') reasons.push('Button has aria-disabled="true".')
  if (style.pointerEvents === 'none') reasons.push('CSS pointer-events is none.')
  if (style.display === 'none') reasons.push('CSS display is none.')
  if (style.visibility === 'hidden') reasons.push('CSS visibility is hidden.')
  if (Number(style.opacity) === 0) reasons.push('CSS opacity is 0.')
  if (rect.width === 0 || rect.height === 0) reasons.push('Button has a zero-size clickable area.')
  if (pointIsOnScreen && topElement && !topElementBelongsToButton) {
    reasons.push(`Another element is above the button at the inspected point: ${describeElement(topElement)}.`)
  }
  if (!clickHandler && type !== 'submit') reasons.push('No React/DOM onClick handler was detected.')
  if (type === 'submit' && !form) reasons.push('Button defaults to submit but is not inside a form.')
  if (type === 'submit' && form && !clickHandler && !submitHandler) reasons.push('Submit button has no detected onClick or form onSubmit handler.')

  return {
    label: buttonLabel(button),
    type,
    disabled: button.disabled,
    ariaDisabled: button.getAttribute('aria-disabled') === 'true',
    pointerEvents: style.pointerEvents,
    display: style.display,
    visibility: style.visibility,
    opacity: style.opacity,
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    reactOrDomOnClick: clickHandler,
    formOnSubmit: submitHandler,
    topElement: describeElement(topElement),
    debugReason,
    reasons,
  }
}

function describeElement(element) {
  if (!element) return 'none'
  const tag = element.tagName?.toLowerCase() || 'element'
  const id = element.id ? `#${element.id}` : ''
  const classes = typeof element.className === 'string' && element.className.trim()
    ? `.${element.className.trim().split(/\s+/).slice(0, 3).join('.')}`
    : ''
  return `${tag}${id}${classes}`
}

function logInspection(button, inspection, stage) {
  const hasProblems = inspection.reasons.length > 0
  const method = hasProblems ? 'warn' : 'log'
  console.groupCollapsed(`${PREFIX} ${stage}: ${inspection.label}`)
  console[method](hasProblems ? 'Possible cause(s):' : 'Button is reachable and has a handler.', inspection.reasons.length ? inspection.reasons : 'No structural issue detected.')
  console.table({
    type: inspection.type,
    disabled: inspection.disabled,
    ariaDisabled: inspection.ariaDisabled,
    pointerEvents: inspection.pointerEvents,
    display: inspection.display,
    visibility: inspection.visibility,
    opacity: inspection.opacity,
    size: `${inspection.width}×${inspection.height}`,
    clickHandler: inspection.reactOrDomOnClick,
    formSubmitHandler: inspection.formOnSubmit,
    topElement: inspection.topElement,
  })
  console.log('Element:', button)
  console.groupEnd()
}

function scanButtons() {
  const rows = [...document.querySelectorAll('button')].map((button) => {
    const inspection = inspectButton(button)
    return {
      label: inspection.label,
      type: inspection.type,
      handler: inspection.reactOrDomOnClick || inspection.formOnSubmit,
      disabled: inspection.disabled || inspection.ariaDisabled,
      pointerEvents: inspection.pointerEvents,
      size: `${inspection.width}×${inspection.height}`,
      issue: inspection.reasons.join(' '),
    }
  })
  console.table(rows)
  return rows
}

function inspectTarget(target) {
  const button = typeof target === 'string' ? document.querySelector(target) : target
  if (!(button instanceof HTMLButtonElement)) {
    console.warn(`${PREFIX} inspect() needs a button element or selector that resolves to a button.`)
    return null
  }
  const inspection = inspectButton(button)
  logInspection(button, inspection, 'manual inspect')
  return inspection
}

function onPointerDown(event) {
  const directButton = event.target instanceof Element ? event.target.closest('button') : null
  const point = { x: event.clientX, y: event.clientY }

  if (!directButton) {
    const coveredButton = buttonAtPoint(point.x, point.y)
    if (coveredButton) {
      const topElement = document.elementFromPoint(point.x, point.y)
      console.warn(`${PREFIX} Pointer landed on ${describeElement(topElement)} while a button (${buttonLabel(coveredButton)}) occupies the same spot. This usually means an overlay or z-index issue is blocking it.`, coveredButton)
    }
    return
  }

  const inspection = inspectButton(directButton, point)
  const interaction = {
    button: directButton,
    label: inspection.label,
    startedAt: performance.now(),
    clickSeen: false,
    mutationBefore: mutationVersion,
    hrefBefore: location.href,
    storageBefore: storageFingerprint(),
  }
  lastInteraction = interaction
  if (inspection.reasons.length) logInspection(directButton, inspection, 'pointer down')

  if (inspection.disabled || inspection.ariaDisabled) {
    console.info(`${PREFIX} "${interaction.label}" is intentionally disabled${inspection.debugReason ? `: ${inspection.debugReason}` : '.'}`, directButton)
    return
  }

  window.setTimeout(() => {
    if (lastInteraction !== interaction || interaction.clickSeen) return
    console.warn(`${PREFIX} Pointer reached "${interaction.label}" but no click event followed. Check drag/scroll gestures, preventDefault(), disabled state changes, or an overlay that appears after pointer-down.`, directButton)
  }, 650)
}

function onClickCapture(event) {
  const button = event.target instanceof Element ? event.target.closest('button') : null
  if (!button) return

  const point = event.detail === 0 ? null : { x: event.clientX, y: event.clientY }

  if (!lastInteraction || lastInteraction.button !== button) {
    const inspection = inspectButton(button, point)
    lastInteraction = {
      button,
      label: inspection.label,
      startedAt: performance.now(),
      clickSeen: true,
      mutationBefore: mutationVersion,
      hrefBefore: location.href,
      storageBefore: storageFingerprint(),
    }
  } else {
    lastInteraction.clickSeen = true
  }

  const interaction = lastInteraction
  const inspection = inspectButton(button, point)
  logInspection(button, inspection, 'click reached button')

  window.setTimeout(() => {
    if (lastInteraction !== interaction) return
    const changed = mutationVersion > interaction.mutationBefore || location.href !== interaction.hrefBefore || storageFingerprint() !== interaction.storageBefore
    if (!changed && !inspection.reasons.length) {
      console.info(`${PREFIX} "${interaction.label}" received a click and a handler was detected, but no DOM, navigation, or localStorage change was observed after 1.2s. The handler may have returned early, updated state to the same value, or be waiting on an async request. Check nearby console errors/warnings.`, button)
    }
  }, 1200)
}

function onWindowError(event) {
  if (!lastInteraction || performance.now() - lastInteraction.startedAt > 2500) return
  console.error(`${PREFIX} Error after clicking "${lastInteraction.label}":`, event.error || event.message)
}

function onUnhandledRejection(event) {
  if (!lastInteraction || performance.now() - lastInteraction.startedAt > 2500) return
  console.error(`${PREFIX} Rejected promise after clicking "${lastInteraction.label}":`, event.reason)
}

export function installButtonDebugger() {
  if (!import.meta.env.DEV || installed) return () => {}
  installed = true

  const observer = new MutationObserver(() => { mutationVersion += 1 })
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true })

  document.addEventListener('pointerdown', onPointerDown, true)
  document.addEventListener('click', onClickCapture, true)
  window.addEventListener('error', onWindowError)
  window.addEventListener('unhandledrejection', onUnhandledRejection)

  window.ButtonDebug = {
    scan: scanButtons,
    inspect: inspectTarget,
    last: () => lastInteraction,
    help: () => console.info(`${PREFIX} Commands: ButtonDebug.scan(), ButtonDebug.inspect('selector'), ButtonDebug.last()`),
  }

  console.info(`${PREFIX} active in development. Click any button for diagnostics. Run ButtonDebug.scan() to audit all rendered buttons.`)

  cleanupFns = [
    () => observer.disconnect(),
    () => document.removeEventListener('pointerdown', onPointerDown, true),
    () => document.removeEventListener('click', onClickCapture, true),
    () => window.removeEventListener('error', onWindowError),
    () => window.removeEventListener('unhandledrejection', onUnhandledRejection),
    () => { if (window.ButtonDebug) delete window.ButtonDebug },
  ]

  return () => {
    cleanupFns.forEach((cleanup) => cleanup())
    cleanupFns = []
    installed = false
  }
}
