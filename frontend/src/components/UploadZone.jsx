import { useRef, useState } from 'react'
import { RULES, formatSize } from '../lib/fileValidation'

export default function UploadZone({ type, file, previewUrl, onPick, onClear, disabled }) {
  const input = useRef(null)
  const [over, setOver] = useState(false)

  function onDrop(e) {
    e.preventDefault()
    setOver(false)
    if (!disabled && e.dataTransfer.files[0]) onPick(e.dataTransfer.files[0])
  }

  if (file) {
    return (
      <div className="card preview-card">
        <div className="preview-header">
          <div className="preview-file-info">
            <div className="file-badge-icon" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
              </svg>
            </div>
            <div>
              <div className="file-name-row">
                <strong className="file-name">{file.name}</strong>
                <span className="file-size-tag">{formatSize(file.size)}</span>
              </div>
              <div className="preview-status-line">
                <span className="status-indicator-dot" />
                <span>Ready for forensic screening</span>
              </div>
            </div>
          </div>
          <button className="btn ghost btn-sm" onClick={onClear} disabled={disabled}>
            Change file
          </button>
        </div>

        <div className="preview-stage">
          {type === 'video' && <video className="preview" src={previewUrl} controls />}
          {type === 'image' && <img className="preview" src={previewUrl} alt="Selected file preview" />}
          {type === 'audio' && <audio className="audio" src={previewUrl} controls />}
        </div>
      </div>
    )
  }

  return (
    <div
      className={'drop' + (over ? ' over' : '')}
      onDragOver={(e) => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      onClick={() => input.current.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current.click()}
      aria-label={`Upload ${type} file for analysis`}
    >
      <div className="drop-icon-badge" aria-hidden="true">
        <svg className="drop-magnifier-icon" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Forensic Magnifying Glass with cyber reticle & reflections */}
          <circle cx="20" cy="20" r="13" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
          <path d="M30 30L42 42" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
          <circle cx="20" cy="20" r="8" stroke="var(--cyan)" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.85" />
          <path d="M20 15V25M15 20H25" stroke="var(--cyan)" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
          <path d="M13 13C15 10.5 18 9 21 9" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" opacity="0.9" />
        </svg>
      </div>

      <div className="drop-text-group">
        <h3 className="drop-title">
          Drop your {type} file here, or <span className="highlight-text">browse</span>
        </h3>
        <p className="drop-subtitle">
          Screen for synthetic generation, anomalies, and manipulations
        </p>
      </div>

      <div className="drop-meta-tags">
        <span className="drop-tag-pill formats">{RULES[type].label.split(',')[0]}</span>
        <span className="drop-tag-pill max-size">{RULES[type].label.split(',')[1] || 'Up to 100 MB'}</span>
      </div>

      <button
        type="button"
        className="btn ghost btn-browse"
        onClick={(e) => { e.stopPropagation(); input.current.click() }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }} aria-hidden="true">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        Select {type} file
      </button>

      <input
        ref={input}
        type="file"
        hidden
        accept={RULES[type].types.join(',')}
        onChange={(e) => e.target.files[0] && onPick(e.target.files[0])}
      />
    </div>
  )
}
