import React, { useEffect } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  fullScreen?: boolean
}

export default function BottomSheet({ open, onClose, title, children, fullScreen }: Props) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 430, height: '100%', zIndex: 200,
    }}>
      {/* Blurred backdrop */}
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }} />
      {/* Sheet */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: '#fff', borderRadius: fullScreen ? 0 : '20px 20px 0 0',
        maxHeight: fullScreen ? '100%' : '90vh',
        display: 'flex', flexDirection: 'column',
        animation: 'slideUp 0.25s ease',
      }}>
        {/* Handle */}
        {!fullScreen && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
            <div style={{ width: 40, height: 4, background: '#E0E0E0', borderRadius: 2 }} />
          </div>
        )}
        {/* Header */}
        {title && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px 8px' }}>
            <span style={{ fontSize: 18, fontWeight: 700 }}>{title}</span>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9E9E9E', fontSize: 20, lineHeight: 1 }}>✕</button>
          </div>
        )}
        <div style={{ overflowY: 'auto', flex: 1, WebkitOverflowScrolling: 'touch' }}>
          {children}
        </div>
      </div>
      <style>{`@keyframes slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }`}</style>
    </div>
  )
}
