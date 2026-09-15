import { useEffect } from 'react'
import { Sparkles, X } from 'lucide-react'
import '../styles/dialog.css'

export default function AppDialog({
  open,
  title,
  message,
  detail = '',
  tone = 'default',
  confirmLabel = 'Continue',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  icon: Icon = Sparkles,
  hideCancel = false,
}) {
  useEffect(() => {
    if (!open) return undefined

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onCancel?.()
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', closeOnEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      className="app-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel?.()
      }}
    >
      <section
        className={`app-dialog ${tone}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-dialog-title"
      >
        <div className="app-dialog-heading">
          <div className="app-dialog-icon"><Icon size={20} /></div>
          <div>
            <span className="eyebrow">DIY TRAVEL</span>
            <h3 id="app-dialog-title">{title}</h3>
          </div>
          <button
            type="button"
            className="icon-button app-dialog-close"
            onClick={onCancel}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {message && <p className="app-dialog-message">{message}</p>}
        {detail && <div className="app-dialog-detail">{detail}</div>}

        <div className="app-dialog-actions">
          {!hideCancel && (
            <button type="button" className="ghost-button" onClick={onCancel}>
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            className={tone === 'danger' ? 'danger-button' : 'primary-button'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}
