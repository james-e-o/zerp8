'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Trash2 } from 'lucide-react'

// ASSUMPTION: adjust to your actual Supabase client path.
import supabase from '@/config/supabaseClient'
// ASSUMPTION: path where company-files.js lives.
import { COMPANY_FILES_BUCKET } from '@/components/company-files'

// Draft bills live in purchase_bill_drafts (not purchase_bills), so the
// normal bills list never shows them. This lists the drafts for this
// branch that you created (company owners see everyone's, via RLS).
// Open a draft at .../bills/new?draft=<id>. Deleting calls
// delete_purchase_bill_draft(), which returns the file paths; they are
// then removed from the bucket.

export default function BillDraftsListPage({ title, description }) {
  const { u, companyId, branchId } = useParams()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases/bills`

  const [drafts, setDrafts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error: loadError } = await supabase
      .from('purchase_bill_drafts')
      .select('id, title, updated_at, payload')
      .eq('branch', branchId)
      .order('updated_at', { ascending: false })

    if (loadError) setError(loadError.message)
    else setError('')
    setDrafts(data || [])
    setLoading(false)
  }, [branchId])

  useEffect(() => {
    load()
  }, [load])

  async function handleDelete(draft) {
    if (!window.confirm('Delete this draft and its attached files? This cannot be undone.')) return
    setBusyId(draft.id)
    setError('')

    const { data: paths, error: rpcError } = await supabase.rpc('delete_purchase_bill_draft', {
      p_draft: draft.id,
    })
    if (rpcError) {
      setError(rpcError.message)
      setBusyId(null)
      return
    }

    if (Array.isArray(paths) && paths.length > 0) {
      const { error: removeError } = await supabase.storage.from(COMPANY_FILES_BUCKET).remove(paths)
      // A failure here only leaves orphan files; the scheduled cleanup removes them.
      if (removeError) console.error('Draft files not removed from storage:', removeError)
    }

    setBusyId(null)
    load()
  }

  return (
    <div className="flex flex-col gap-4">
      {(title || description) && (
        <div>
          {title && <h2 className="text-lg font-semibold text-gray-800">{title}</h2>}
          {description && <p className="text-xs text-gray-500">{description}</p>}
        </div>
      )}

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-xs text-gray-500">Loading drafts...</p>
      ) : drafts.length === 0 ? (
        <div className="flex min-h-40 items-center justify-center rounded-md border border-dashed border-border px-6 text-center text-sm text-muted-foreground">
          No draft bills yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs font-medium text-gray-600">
              <tr>
                <th className="px-3 py-2 text-left">Draft</th>
                <th className="px-3 py-2 text-left">Items</th>
                <th className="px-3 py-2 text-left">Last saved</th>
                <th className="w-10 px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {drafts.map((draft) => {
                const itemCount = Array.isArray(draft.payload?.selectedLines)
                  ? draft.payload.selectedLines.length
                  : Object.values(draft.payload?.selectedLines || {}).filter(Boolean).length
                return (
                  <tr key={draft.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <Link
                        href={`${base}/new?draft=${draft.id}`}
                        className="font-medium text-core hover:underline"
                      >
                        {draft.title || 'Untitled draft'}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-gray-700">{itemCount}</td>
                    <td className="px-3 py-2 text-gray-700">
                      {new Date(draft.updated_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        disabled={busyId === draft.id}
                        onClick={() => handleDelete(draft)}
                        className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                        aria-label="Delete draft"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}