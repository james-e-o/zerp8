'use client'

import { useEffect, useRef, useState } from 'react'
import { FileText, Image as ImageIcon, Trash2, Upload, X, ExternalLink } from 'lucide-react'

import { Button } from '@/components/ui/button'

import {
  ACCEPTED_FILE_TYPES,
  MAX_FILE_SIZE_BYTES,
  deleteFileAttachment,
  formatFileSize,
  getAttachmentUrl,
  isImage,
  isReasonRequiredError,
  uploadAndRegisterFile,
  useFileAttachments,
  useRemovedFiles,
  validatePickedFile,
} from './company-files'

// Two ready-made components over the shared company-files helpers, so no
// page has to rebuild upload UI. Suggested location:
//   components/shared/company-files/company-file-uploader.jsx
//
// <FileUploader staging={...} />
//   For a form whose record isn't saved yet. Pair with useStagedFiles():
//     const staging = useStagedFiles()
//     <FileUploader staging={staging} />
//     ...after the record is created:
//     await staging.uploadAll({ companyId, branchId, moduleKey, entityType, entityId })
//   (A page with its own custom upload layout, like the New Bill form,
//   can skip this component and use useStagedFiles() on its own.)
//
// <AttachmentList ... />
//   For a saved record: lists its files, opens them through short-lived
//   signed links, and (when allowed) adds or deletes files immediately.
//   canAdd / canDelete only decide whether the buttons are SHOWN - the
//   real permission check is in the database, and its message is
//   displayed if someone without access tries anyway.

const statusOf = (entry) => {
  if (entry.uploading) return { label: 'Uploading...', dot: 'bg-amber-400', text: 'text-amber-600' }
  if (entry.error) return { label: entry.error, dot: 'bg-red-500', text: 'text-red-600' }
  if (entry.url) return { label: 'Uploaded', dot: 'bg-emerald-500', text: 'text-emerald-600' }
  return { label: 'Ready to upload', dot: 'bg-gray-300', text: 'text-gray-500' }
}

export function FileUploader({ staging, disabled = false, label = 'Click to upload files (images, PDF or Word)' }) {
  const [rejected, setRejected] = useState([])
  const { files, addFiles, removeFile } = staging

  const handleSelected = (event) => {
    const result = addFiles(event.target.files)
    setRejected(result.rejected)
    event.target.value = ''
  }

  return (
    <div className="space-y-2">
      <label
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50/60 px-4 py-6 text-center hover:bg-gray-50 ${
          disabled ? 'pointer-events-none opacity-60' : ''
        }`}
      >
        <Upload className="h-5 w-5 text-gray-400" />
        <span className="text-xs text-gray-600">{label}</span>
        <span className="text-[11px] text-gray-400">
          Images are shrunk automatically; PDF/Word up to {formatFileSize(MAX_FILE_SIZE_BYTES)}
        </span>
        <input
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          multiple
          disabled={disabled}
          onChange={handleSelected}
          className="hidden"
        />
      </label>

      {rejected.length > 0 && (
        <ul className="space-y-0.5 text-[11px] text-red-600">
          {rejected.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}

      {files.length > 0 && (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
          {files.map((entry) => {
            const status = statusOf(entry)
            return (
              <li key={entry.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                {isImage(entry.file) ? (
                  <ImageIcon className="h-4 w-4 shrink-0 text-gray-400" />
                ) : (
                  <FileText className="h-4 w-4 shrink-0 text-gray-400" />
                )}
                <span className="min-w-0 flex-1 truncate text-gray-800" title={entry.file.name}>
                  {entry.file.name}
                </span>
                <span className="shrink-0 text-gray-400">{formatFileSize(entry.file.size)}</span>
                <span className={`flex shrink-0 items-center gap-1 ${status.text}`} title={status.label}>
                  <span className={`h-2 w-2 rounded-full ${status.dot}`} />
                  <span className="max-w-32 truncate">{status.label}</span>
                </span>
                {!entry.uploading && !entry.url && (
                  <button
                    type="button"
                    onClick={() => removeFile(entry.file)}
                    className="shrink-0 text-gray-400 hover:text-red-600"
                    aria-label={`Remove ${entry.file.name}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export function AttachmentList({
  entityType,
  entityId,
  companyId,
  branchId,
  moduleKey,
  canAdd = false,
  canDelete = false,
  reloadKey = 0, // change this number to make the list reload (e.g. after the page uploads files itself)
  onChange, // called after files are added or deleted here, so a page showing its own preview can reload
}) {
  const { attachments, loading, error: loadError, reload } = useFileAttachments(entityType, entityId)

  useEffect(() => {
    if (reloadKey) reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey])
  const { removed, reload: reloadRemoved } = useRemovedFiles(entityType, entityId)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  const handleAdd = async (event) => {
    const picked = Array.from(event.target.files || [])
    event.target.value = ''
    if (!picked.length) return

    setError('')
    setBusy(true)
    const problems = []

    for (const file of picked) {
      const problem = validatePickedFile(file)
      if (problem) {
        problems.push(problem)
      } else {
        try {
          await uploadAndRegisterFile({ file, companyId, branchId, moduleKey, entityType, entityId })
        } catch (err) {
          problems.push(`${file.name}: ${err?.message || 'upload failed'}`)
        }
      }
    }

    setBusy(false)
    setError(problems.join('\n'))
    reload()
    if (onChange) onChange()
  }

  const handleView = async (attachment) => {
    setError('')
    // Open the tab straight away (inside the click) so the browser's popup
    // blocker allows it, then point it at the signed link once we have it.
    const tab = window.open('', '_blank')
    try {
      const url = await getAttachmentUrl(attachment.storage_path)
      if (tab) {
        tab.opener = null
        tab.location.href = url
      } else {
        window.location.href = url
      }
    } catch (err) {
      if (tab) tab.close()
      setError(err?.message || 'Could not open this file.')
    }
  }

  const handleDelete = async (attachment) => {
    if (!confirm(`Delete "${attachment.file_name}"? This cannot be undone.`)) return

    setError('')
    setBusy(true)
    try {
      try {
        await deleteFileAttachment(attachment.id)
      } catch (err) {
        // Files on a closed record (e.g. a paid bill) need a reason, which
        // is kept in the permanent deletion log.
        if (!isReasonRequiredError(err)) throw err
        const reason = window.prompt(
          'This record is closed. Why is this file being deleted? (kept in the deletion log)'
        )
        if (!reason || reason.trim().length < 3) {
          setBusy(false)
          return
        }
        await deleteFileAttachment(attachment.id, reason.trim())
      }
    } catch (err) {
      setError(err?.message || 'Could not delete this file.')
    }
    setBusy(false)
    reload()
    reloadRemoved()
    if (onChange) onChange()
  }

  return (
    <div className="space-y-2">
      {canAdd && (
        <div>
          <Button
            type="button"
            variant="outline"
            className="h-7 text-xs"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            {busy ? 'Working...' : 'Add files'}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            multiple
            onChange={handleAdd}
            className="hidden"
          />
        </div>
      )}

      {(error || loadError) && (
        <p className="whitespace-pre-line text-xs text-red-600">{error || loadError}</p>
      )}

      {loading ? (
        <p className="text-xs text-gray-400">Loading files...</p>
      ) : attachments.length === 0 ? (
        <p className="rounded-md border border-dashed border-gray-200 px-3 py-4 text-center text-xs text-gray-400">
          No files attached.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
          {attachments.map((attachment) => (
            <li key={attachment.id} className="flex items-center gap-2 px-3 py-2 text-xs">
              {(attachment.mime_type || '').startsWith('image/') ? (
                <ImageIcon className="h-4 w-4 shrink-0 text-gray-400" />
              ) : (
                <FileText className="h-4 w-4 shrink-0 text-gray-400" />
              )}
              <span className="min-w-0 flex-1 truncate text-gray-800" title={attachment.file_name}>
                {attachment.file_name}
              </span>
              <span className="shrink-0 text-gray-400">{formatFileSize(attachment.size_bytes)}</span>
              <span className="shrink-0 text-gray-400">
                {attachment.uploaded_at ? new Date(attachment.uploaded_at).toLocaleDateString() : ''}
              </span>
              <button
                type="button"
                onClick={() => handleView(attachment)}
                className="shrink-0 text-gray-500 hover:text-core"
                aria-label={`Open ${attachment.file_name}`}
                title="Open"
              >
                <ExternalLink className="h-4 w-4" />
              </button>
              {canDelete && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleDelete(attachment)}
                  className="shrink-0 text-gray-400 hover:text-red-600 disabled:opacity-50"
                  aria-label={`Delete ${attachment.file_name}`}
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {removed.length > 0 && (
        <ul className="space-y-0.5 pt-1 text-[11px] text-gray-400">
          {removed.map((item) => (
            <li key={item.id} title={item.reason || ''}>
              Removed: {item.file_name} · {new Date(item.deleted_at).toLocaleDateString()}
              {item.reason ? ` · ${item.reason}` : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}