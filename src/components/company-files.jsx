'use client'

import { useCallback, useEffect, useState } from 'react'

import supabase from '@/config/supabaseClient'

// Shared helpers + hooks for the one private 'company-documents' bucket.
// Any page, in any module, that needs file uploads uses these (or the
// ready-made components in company-file-uploader.jsx) instead of talking
// to Storage directly. Suggested location:
//   components/shared/company-files/company-files.js
//
// Adding a new module: add its entity_type to file_attachment_targets
// (see company-file-attachments-migration.sql) - nothing here changes.

export const COMPANY_FILES_BUCKET = 'company-documents'

// Hard cap on what is STORED, per file - kept in step with the bucket's
// file_size_limit and the file_attachments check in the migration.
export const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024
// Images are shrunk in the browser to roughly this size before upload...
export const TARGET_IMAGE_BYTES = 1 * 1024 * 1024
// ...so a big phone photo may be picked, as long as it's under this.
export const MAX_IMAGE_INPUT_BYTES = 25 * 1024 * 1024
export const MAX_FILES_PER_UPLOAD = 10

// Kept in step with the bucket's allowed_mime_types in the migration.
export const ACCEPTED_FILE_TYPES = 'image/jpeg,image/png,image/webp,image/gif,application/pdf,.doc,.docx'

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif']
const WORD_EXTENSIONS = ['.doc', '.docx']

const hasExtension = (name, extensions) =>
  extensions.some((extension) => name.toLowerCase().endsWith(extension))

export const isPdf = (file) =>
  file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')

export const isImage = (file) =>
  ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) ||
  hasExtension(file.name, IMAGE_EXTENSIONS)

export const isWord = (file) =>
  file.type === 'application/msword' ||
  file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
  hasExtension(file.name, WORD_EXTENSIONS)

// Browsers can render images and PDFs inline; Word files can't be previewed.
export const isPreviewable = (file) => isPdf(file) || isImage(file)

export const isAllowedFile = (file) => isPdf(file) || isImage(file) || isWord(file)

export const fileKindLabel = (file) => {
  if (isPdf(file)) return 'PDF'
  if (isWord(file)) return 'Word document'
  if (isImage(file)) return 'Image'
  return file.type || 'File'
}

export const formatFileSize = (bytes) => {
  if (!bytes && bytes !== 0) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Why a picked file can't be used, or null if it can. Images may be large
 * (they get compressed); PDFs and Word files can't be compressed here, so
 * they must already be within the stored limit.
 */
export const validatePickedFile = (file) => {
  if (!isAllowedFile(file)) return `${file.name}: only images, PDF and Word documents are allowed`
  if (isImage(file)) {
    if (file.size > MAX_IMAGE_INPUT_BYTES) {
      return `${file.name}: image is larger than ${formatFileSize(MAX_IMAGE_INPUT_BYTES)}`
    }
    return null
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `${file.name}: larger than ${formatFileSize(MAX_FILE_SIZE_BYTES)} - compress it, or upload a photo/scan of it instead`
  }
  return null
}

// ---------------------------------------------------------------
// Image preparation: every image is shrunk to about 1 MB (never above
// 2 MB) and, by default, has its contrast stretched so text stays easy
// to read even when the picture is made small and low-quality.
// ---------------------------------------------------------------

async function loadImageSource(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      // fall through to the <img> route
    }
  }

  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.decoding = 'async'
    image.src = url
    await image.decode()
    return image
  } finally {
    URL.revokeObjectURL(url)
  }
}

// Auto-levels: ignore the darkest/lightest 1% of pixels, then stretch the
// rest to the full range. Faded or greyish paper turns white and the ink
// darker; colours are kept (the same stretch is applied to every channel).
function stretchContrast(imageData) {
  const data = imageData.data
  const histogram = new Uint32Array(256)
  for (let i = 0; i < data.length; i += 4) {
    histogram[((data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000) | 0] += 1
  }

  const clip = (data.length / 4) * 0.01
  let low = 0
  let seen = 0
  for (; low < 255; low += 1) {
    seen += histogram[low]
    if (seen > clip) break
  }
  let high = 255
  seen = 0
  for (; high > 0; high -= 1) {
    seen += histogram[high]
    if (seen > clip) break
  }

  if (high - low < 40) return // already flat - nothing sensible to stretch

  const lookup = new Uint8ClampedArray(256)
  const scale = 255 / (high - low)
  for (let v = 0; v < 256; v += 1) lookup[v] = (v - low) * scale

  for (let i = 0; i < data.length; i += 4) {
    data[i] = lookup[data[i]]
    data[i + 1] = lookup[data[i + 1]]
    data[i + 2] = lookup[data[i + 2]]
  }
}

const canvasToBlob = (canvas, quality) =>
  new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))

/**
 * Returns a JPEG File no larger than TARGET_IMAGE_BYTES where possible
 * (and always under MAX_FILE_SIZE_BYTES, or it throws). Steps the quality
 * down first, then the dimensions, until it fits.
 */
export async function compressImage(file, { enhance = true } = {}) {
  const source = await loadImageSource(file)
  const naturalWidth = source.width || source.naturalWidth
  const naturalHeight = source.height || source.naturalHeight

  let maxDimension = 1800
  let quality = 0.82
  let blob = null

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const ratio = Math.min(1, maxDimension / Math.max(naturalWidth, naturalHeight))
    const width = Math.max(1, Math.round(naturalWidth * ratio))
    const height = Math.max(1, Math.round(naturalHeight * ratio))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    context.fillStyle = '#ffffff' // transparent PNGs become white, not black
    context.fillRect(0, 0, width, height)
    context.drawImage(source, 0, 0, width, height)

    if (enhance) {
      const pixels = context.getImageData(0, 0, width, height)
      stretchContrast(pixels)
      context.putImageData(pixels, 0, 0)
    }

    blob = await canvasToBlob(canvas, quality)
    if (blob && blob.size <= TARGET_IMAGE_BYTES) break

    if (quality > 0.55) {
      quality -= 0.1
    } else {
      maxDimension = Math.round(maxDimension * 0.8)
      quality = 0.7
    }
  }

  if (typeof source.close === 'function') source.close()

  if (!blob || blob.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`${file.name}: could not be reduced below ${formatFileSize(MAX_FILE_SIZE_BYTES)}`)
  }

  const baseName = file.name.replace(/\.[^.]+$/, '') || 'image'
  return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
}

/** Images are compressed; PDFs and Word files go as they are (size-checked). */
export async function prepareFileForUpload(file, options) {
  if (isImage(file)) return compressImage(file, options)

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`${file.name}: larger than ${formatFileSize(MAX_FILE_SIZE_BYTES)}`)
  }
  return file
}

const newId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

const safeFileName = (name) => name.replace(/[^a-zA-Z0-9._-]+/g, '_')

// {company}/{branch or _company}/{module}/{record}/{uuid}-{filename}
// The company id MUST be the first segment - the bucket's policies and
// register_file_attachment() both rely on it.
export const buildStoragePath = ({ companyId, branchId, moduleKey, entityId, fileName }) =>
  `${companyId}/${branchId || '_company'}/${moduleKey}/${entityId}/${newId()}-${safeFileName(fileName)}`

/**
 * Uploads one file and records it against a record. If recording fails
 * (e.g. the user isn't allowed to attach files to that record) the
 * uploaded file is removed again so nothing is left behind.
 * Returns the new file_attachments row; throws on any failure.
 */
export async function uploadAndRegisterFile({
  file: pickedFile,
  companyId,
  branchId,
  moduleKey,
  entityType,
  entityId,
  enhance = true, // images: stretch contrast so small/low-quality scans stay readable
}) {
  const file = await prepareFileForUpload(pickedFile, { enhance })
  const path = buildStoragePath({ companyId, branchId, moduleKey, entityId, fileName: file.name })

  const { error: uploadError } = await supabase.storage
    .from(COMPANY_FILES_BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: false })
  if (uploadError) throw uploadError

  const { data, error } = await supabase.rpc('register_file_attachment', {
    p_entity_type: entityType,
    p_entity_id: entityId,
    p_branch: branchId || null,
    p_company: companyId,
    p_storage_path: path,
    p_file_name: file.name,
    p_mime_type: file.type || null,
    p_size_bytes: file.size,
  })

  if (error) {
    await supabase.storage.from(COMPANY_FILES_BUCKET).remove([path])
    throw error
  }

  return data
}

/**
 * Deletes a file everywhere: permission check + row first (through the
 * delete_file_attachment function), then the real file from the bucket.
 * Throws if the user isn't authorized. `reason` is required by the
 * database for files on closed records (e.g. a paid bill) - see
 * isReasonRequiredError() to know when to ask for one.
 * storageCleaned is false if the row was removed but the bucket file
 * couldn't be - harmless (nothing can reach it any more, and the
 * scheduled cleanup removes it), just reported.
 */
export async function deleteFileAttachment(attachmentId, reason = null) {
  const { data: storagePath, error } = await supabase.rpc('delete_file_attachment', {
    p_id: attachmentId,
    p_reason: reason,
  })
  if (error) throw error

  const { data, error: removeError } = await supabase.storage
    .from(COMPANY_FILES_BUCKET)
    .remove([storagePath])

  return { storageCleaned: !removeError && (data?.length ?? 0) > 0 }
}

/** True when a delete failed only because a reason must be given. */
export const isReasonRequiredError = (error) =>
  /reason is required/i.test(error?.message || '')

/** Short-lived link for viewing/downloading a private file. */
export async function getAttachmentUrl(storagePath, expiresInSeconds = 300) {
  const { data, error } = await supabase.storage
    .from(COMPANY_FILES_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds)
  if (error) throw error
  return data.signedUrl
}

/** Saved attachments for one record (RLS already limits what's returned). */
export function useFileAttachments(entityType, entityId) {
  const [attachments, setAttachments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    if (!entityType || !entityId) {
      setAttachments([])
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error: queryError } = await supabase
      .from('file_attachments')
      .select('id, file_name, mime_type, size_bytes, storage_path, uploaded_at, uploaded_by')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('uploaded_at', { ascending: false })

    if (queryError) {
      setError(queryError.message)
    } else {
      setError('')
      setAttachments(data || [])
    }
    setLoading(false)
  }, [entityType, entityId])

  useEffect(() => {
    reload()
  }, [reload])

  return { attachments, loading, error, reload }
}

/**
 * Files that were deleted from a record (who/when/why is kept forever),
 * so a record can show "1 file removed on 12 Oct - reason". Read-only.
 */
export function useRemovedFiles(entityType, entityId) {
  const [removed, setRemoved] = useState([])

  const reload = useCallback(async () => {
    if (!entityType || !entityId) {
      setRemoved([])
      return
    }
    const { data } = await supabase
      .from('file_attachment_deletions')
      .select('id, file_name, size_bytes, deleted_at, reason, record_was_closed')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('deleted_at', { ascending: false })
    setRemoved(data || [])
  }, [entityType, entityId])

  useEffect(() => {
    reload()
  }, [reload])

  return { removed, reload }
}

/**
 * For forms where the record doesn't exist yet: files are picked and
 * previewed locally, then uploaded together AFTER the record is saved
 * (uploadAll), once there's a record id to attach them to.
 *
 * files: [{ id, file, uploading, url, error }]  - `url` is set to the
 * storage path once that file has uploaded and been recorded.
 * addFiles(fileList) -> { accepted: File[], rejected: string[] }
 * removeFile(file), clear()
 * uploadAll({ companyId, branchId, moduleKey, entityType, entityId })
 *   -> [{ file, ok, error? }]   (never throws; check each result)
 */
export function useStagedFiles({ maxFiles = MAX_FILES_PER_UPLOAD } = {}) {
  const [files, setFiles] = useState([])

  const addFiles = useCallback(
    (fileList) => {
      const incoming = Array.from(fileList || [])
      const accepted = []
      const rejected = []
      let room = maxFiles - files.length

      for (const file of incoming) {
        const problem = validatePickedFile(file)
        if (problem) {
          rejected.push(problem)
        } else if (room <= 0) {
          rejected.push(`${file.name}: the limit of ${maxFiles} files was reached`)
        } else {
          accepted.push(file)
          room -= 1
        }
      }

      if (accepted.length) {
        setFiles((prev) => [
          ...prev,
          ...accepted.map((file) => ({ id: newId(), file, uploading: false, url: null, error: null })),
        ])
      }

      return { accepted, rejected }
    },
    [files.length, maxFiles]
  )

  const removeFile = useCallback((file) => {
    setFiles((prev) => prev.filter((entry) => entry.file !== file))
  }, [])

  const clear = useCallback(() => setFiles([]), [])

  const updateEntry = (id, patch) =>
    setFiles((prev) => prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)))

  const uploadAll = useCallback(
    async (context) => {
      const results = []

      for (const entry of files) {
        if (entry.url) {
          results.push({ file: entry.file, ok: true })
          continue
        }

        updateEntry(entry.id, { uploading: true, error: null })
        try {
          const row = await uploadAndRegisterFile({ file: entry.file, ...context })
          updateEntry(entry.id, { uploading: false, url: row.storage_path })
          results.push({ file: entry.file, ok: true })
        } catch (err) {
          const message = err?.message || 'Upload failed'
          updateEntry(entry.id, { uploading: false, error: message })
          results.push({ file: entry.file, ok: false, error: message })
        }
      }

      return results
    },
    [files]
  )

  return { files, addFiles, removeFile, clear, uploadAll }
}