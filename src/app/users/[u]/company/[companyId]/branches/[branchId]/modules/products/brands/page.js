"use client";

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Plus, Trash2, Pencil, Rocket } from "lucide-react"
import PageHeader from "@/components/PageHeader"
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import supabase from "@/config/supabaseClient"

export default function BrandsPage() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-hidden">
        <BrandTable />
      </div>
    </div>
  )
}






// ======================================================================
//  Brand Table Component
//
//  Mirrors CategoryTable's conventions (inline add form, selectable list,
//  detail panel with inline edit + confirm dialog, delete confirm dialog)
//  but simpler: brands have no parent/tree structure, so this is a flat
//  list rather than a CheckboxTree. Company-wide from the start, same as
//  categories now are - a brand name is a label, not something that
//  should vary or duplicate per branch.
// ======================================================================

function slugify(input) {
  return input.toString().toLowerCase().replace(/['"]/g, '').trim().replace(/\band\b/g, '&').replace(/[^a-z0-9\&-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').replace(/&/g, 'and')
}
function capitalize(input) {
  return input.toString().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ').replace(/\bAnd\b/g, '&')
}

function BrandTable() {
  const { branchId, companyId } = useParams()

  const [brands, setBrands] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedBrandId, setSelectedBrandId] = useState('')

  // Inline "add brand" form
  const [showTopInline, setShowTopInline] = useState(false)
  const [brandName, setBrandName] = useState('')
  const [brandSlug, setBrandSlug] = useState('')
  const [brandUploading, setBrandUploading] = useState(false)

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const fetchBrands = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('brands')
        .select('*')
        .eq('company', companyId)
        .order('name', { ascending: true })

      if (error) {
        console.error(error)
        toast.error('Failed to load brands')
      } else {
        setBrands(data || [])
      }
    } catch (e) {
      console.error(e)
      toast.error('Unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  async function refreshBrands() {
    const r = toast.loading('Refreshing brands...')
    await fetchBrands()
    toast.dismiss(r)
    toast.success('Brands refreshed', { id: r })
  }

  async function createBrand() {
    if (!brandName) return
    setBrandUploading(true)
    const slug = brandSlug || slugify(brandName)
    const t = toast.loading('Checking for existing brand...')

    try {
      const { data: existing, error: existingErr } = await supabase
        .from('brands')
        .select('id')
        .eq('slug', slug)
        .eq('company', companyId)
        .limit(1)

      if (existingErr) {
        console.error(existingErr)
        toast.error('Failed to check existing brand', { id: t })
        return
      }
      if (existing && existing.length > 0) {
        toast.error('Brand already exists', { id: t })
        return
      }

      toast.dismiss(t)
      const l = toast.loading('Creating brand...')

      const { data: { user } } = await supabase.auth.getUser()

      const { error } = await supabase.from('brands').insert({
        name: brandName,
        slug,
        description: '',
        is_active: true,
        company: companyId,
        created_by: user?.id || null,
      }).select().single()

      if (error) throw error

      refreshBrands()
      setBrandName('')
      setBrandSlug('')
      setShowTopInline(false)
      toast.dismiss(l)
      toast.success('Brand created')
    } catch (err) {
      console.error(err)
      toast.error('Failed to create brand')
    } finally {
      setBrandUploading(false)
    }
  }

  async function deleteBrand(id) {
    try {
      setDeleting(true)
      const { error } = await supabase.from('brands').delete().eq('id', id)
      if (error) throw error
      toast.success('Brand deleted')
      if (String(selectedBrandId) === String(id)) setSelectedBrandId('')
      refreshBrands()
    } catch (err) {
      console.error(err)
      toast.error('Failed to delete brand')
    } finally {
      setDeleting(false)
    }
  }

  useEffect(() => {
    fetchBrands()
  }, [companyId])

  const selected = brands.find((b) => String(b.id) === String(selectedBrandId))

  return (
    <div className="w-full font-WixMade h-full overflow-hidden">
      <div className="border rounded-md bg-white flex flex-col h-full overflow-hidden dark:bg-neutral-900">
        <div>
          <div className="flex items-center p-4 justify-end">
            <Button size="sm" className="h-7 inline-flex items-center bg-core hover:bg-core/85 gap-2" onClick={() => { setShowTopInline(v => !v); setBrandName(''); setBrandSlug('') }}>
              <Plus size={14} />
              <span className="text-xs">Add Brand</span>
            </Button>
          </div>

          <div className="p-4 border-b">
            <div className="flex items-center gap-2">
              {showTopInline && (
                <div className="flex items-center gap-2">
                  <Label>Brand name:</Label>
                  <Input
                    autoFocus
                    value={brandName}
                    onChange={(e) => { setBrandName(capitalize(e.target.value)); setBrandSlug(slugify(e.target.value)) }}
                    placeholder="Brand name"
                    className="h-7 px-2 w-44 text-sm rounded-sm border"
                  />
                  <Button size="icon" onClick={createBrand} className="h-7 w-7 p-0 bg-army" disabled={brandUploading || !brandName}>
                    <Rocket size={14} />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grow overflow-hidden">
          {brands.length ? (
            <div className="flex justify-between gap-6 h-full pb-8 overflow-hidden">
              <div className="flex-1 h-full overflow-y-scroll px-6 ml-6">
                <div className="-ml-4 pb-20 pt-4">
                  {brands.map((brand) => (
                    <div key={brand.id} className="flex items-center gap-3 text-sm" style={{ marginTop: '13px', marginBottom: '13px' }}>
                      <span
                        onClick={() => setSelectedBrandId(brand.id)}
                        className={`mx-2 cursor-pointer ${String(selectedBrandId) === String(brand.id) ? 'font-semibold text-core' : ''} ${!brand.is_active ? 'text-neutral-400 italic' : ''}`}
                      >
                        {brand.name}
                        {!brand.is_active && <span className="ml-1 text-[10px]">(inactive)</span>}
                      </span>
                      <div className="relative inline-flex items-center gap-2 bg-armylight dark:bg-red-800/10 p-[3px] rounded-sm h-5 border border-core/20">
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Delete brand"
                          aria-label="Delete brand"
                          onClick={() => { setDeleteTarget({ id: brand.id, name: brand.name }); setDeleteDialogOpen(true) }}
                          className="h-5 w-5 p-0"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="w-72 border-l p-4">
                <p className="text-xs font-semibold text-army">
                  Brands are the manufacturers or labels your products belong to. Products pick from this
                  list instead of typing a brand name freehand - this keeps "Nike" from also showing up as
                  "nike" or "NIKE" elsewhere.
                </p>
                {selected ? (
                  <BrandDetails selected={selected} refresh={refreshBrands} />
                ) : (
                  <div className="text-sm text-gray-500 mt-3">Select a brand to see details</div>
                )}
              </div>
            </div>
          ) : (
            <p className="h-12 flex justify-center items-center text-center">{isLoading ? "Loading..." : "No brands yet."}</p>
          )}
        </div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete brand</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.name}"? Products already using this brand will
              keep referencing it unless you update them separately. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-7">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="h-7 bg-red-600 text-white"
              disabled={deleting}
              onClick={async () => { if (!deleteTarget) return; await deleteBrand(deleteTarget.id); setDeleteDialogOpen(false); setDeleteTarget(null) }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function BrandDetails({ selected, refresh }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(selected.name)
  const [slug, setSlug] = useState(selected.slug || '')
  const [description, setDescription] = useState(selected.description || '')
  const [logoUrl, setLogoUrl] = useState(selected.logo_url || '')
  const [isActive, setIsActive] = useState(selected.is_active)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setName(selected.name)
    setSlug(selected.slug || '')
    setDescription(selected.description || '')
    setLogoUrl(selected.logo_url || '')
    setIsActive(selected.is_active)
    setEditing(false)
  }, [selected])

  const toggleActive = async (checked) => {
    setIsActive(checked)
    try {
      const { error } = await supabase.from('brands').update({ is_active: checked }).eq('id', selected.id)
      if (error) throw error
      refresh()
      toast.success(checked ? 'Brand activated' : 'Brand deactivated')
    } catch (err) {
      console.error(err)
      toast.error('Failed to update brand')
      setIsActive(!checked)
    }
  }

  const save = async () => {
    const updates = {}
    if (name !== selected.name) updates.name = name
    if (slug !== (selected.slug || '')) updates.slug = slug
    if (description !== (selected.description || '')) updates.description = description
    if (logoUrl !== (selected.logo_url || '')) updates.logo_url = logoUrl

    if (Object.keys(updates).length === 0) {
      setEditing(false)
      toast('No changes')
      return
    }

    try {
      setSaving(true)
      const { error } = await supabase.from('brands').update(updates).eq('id', selected.id)
      if (error) throw error
      refresh()
      setEditing(false)
      toast.success('Saved')
    } catch (err) {
      console.error(err)
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex my-1.5 items-center justify-between">
        <h4 className="text-sm font-semibold">Details</h4>
        <Button size="icon" variant="ghost" onClick={() => setEditing((v) => !v)} className="h-6 w-6 p-0">
          <Pencil size={14} />
        </Button>
      </div>

      {!editing ? (
        <div className="space-y-2 mt-3">
          <div className="text-sm font-medium">{selected.name}</div>
          <div className="text-[13px] text-muted-foreground">Slug: {selected.slug || '-'}</div>
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <span>Active:</span>
            <Switch checked={isActive} onCheckedChange={toggleActive} />
          </div>
          <div className="pt-2 italic text-xs">description: {selected.description || 'No description provided.'}</div>
          {selected.logo_url && (
            <img src={selected.logo_url} alt={selected.name} className="h-10 mt-2 object-contain" />
          )}
        </div>
      ) : (
        <div className="space-y-2 mt-3">
          <div className="flex gap-2">
            <Label>Name:</Label>
            <Input
              value={name}
              onChange={(e) => { setName(capitalize(e.target.value)); setSlug(slugify(e.target.value)) }}
              className="w-full mt-1 px-2 py-1 border h-7 rounded-sm text-sm"
            />
          </div>
          <div className="flex gap-2">
            <Label>Slug:</Label>
            <Input readOnly value={slug} onChange={(e) => setSlug(slugify(e.target.value))} className="w-full mt-1 px-2 py-1 border h-7 rounded-sm text-sm" />
          </div>
          <div className="flex gap-2">
            <Label>Logo URL:</Label>
            <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." className="w-full mt-1 px-2 py-1 border h-7 rounded-sm text-sm" />
          </div>
          <div className="flex gap-2">
            <Label>Description:</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full mt-1 px-2 py-1 border rounded-sm text-sm" rows={3} />
          </div>
          <div className="flex mt-3 gap-2">
            <Button className="bg-army h-6 text-xs font-medium hover:bg-army/85" disabled={saving} onClick={save}>Save</Button>
            <Button
              variant="secondary"
              className="h-6 font-medium text-xs"
              onClick={() => { setName(selected.name); setSlug(selected.slug || ''); setDescription(selected.description || ''); setLogoUrl(selected.logo_url || ''); setEditing(false) }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}