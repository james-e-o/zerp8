'use client'

import { useState, useEffect, useRef, useContext } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { X, Trash2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import supabase from "@/config/supabaseClient"
import { BranchContext } from "@/app/users/[u]/company/[companyId]/branches/[branchId]/branchContext"

// ----------------------------------------------------------------------
// Expected schema (adjust names if yours differ):
//
// create table attributes (
//   id uuid primary key default gen_random_uuid(),
//   branch uuid not null references branches(id) on delete cascade,
//   name text not null,
//   created_at timestamptz not null default now()
// );
//
// create table attribute_values (
//   id uuid primary key default gen_random_uuid(),
//   attribute_id uuid not null references attributes(id) on delete cascade,
//   value text not null,
//   created_at timestamptz not null default now()
// );
// ----------------------------------------------------------------------

function convertToSlug(input) {
  return input.toString().toLowerCase().trim()
}

export default function AttributesPage() {
  const { currentBranch } = useContext(BranchContext)
  const branchId = currentBranch?.id

  const [attributes, setAttributes] = useState([]) // [{ id, name, isNew?, values: [{id, value, isNew?}], valueInput }]
  const [isLoading, setIsLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [justAdded, setJustAdded] = useState(false)
  const lastAttrRef = useRef(null)
  const valueInputRefs = useRef({})

  useEffect(() => {
    if (branchId) fetchAttributes()
  }, [branchId])

  useEffect(() => {
    if (justAdded && lastAttrRef.current) {
      lastAttrRef.current.scrollIntoView({ behavior: "smooth", block: "center" })
      setJustAdded(false)
    }
  }, [justAdded])

  const fetchAttributes = async () => {
    try {
      setIsLoading(true)
      const { data: attrData, error: attrError } = await supabase
        .from("attributes")
        .select("id, name")
        .eq("branch", branchId)
        .order("created_at", { ascending: true })

      if (attrError) throw attrError

      const attrIds = (attrData || []).map((a) => a.id)
      let valuesData = []
      if (attrIds.length > 0) {
        const { data, error } = await supabase
          .from("attribute_values")
          .select("id, attribute_id, value")
          .in("attribute_id", attrIds)
          .order("created_at", { ascending: true })
        if (error) throw error
        valuesData = data || []
      }

      const merged = (attrData || []).map((a) => ({
        id: a.id,
        name: a.name,
        valueInput: "",
        values: valuesData
          .filter((v) => v.attribute_id === a.id)
          .map((v) => ({ id: v.id, value: v.value })),
      }))

      setAttributes(merged)
    } catch (err) {
      console.error(err)
      toast.error("Failed to load attributes")
    } finally {
      setIsLoading(false)
    }
  }

  // Add a new, unsaved attribute row locally — persisted on first value add / blur-save.
  const addAttribute = () => {
    setAttributes((prev) => [
      ...prev,
      { id: `temp-${Date.now()}`, name: "", isNew: true, values: [], valueInput: "" },
    ])
    setJustAdded(true)
  }

  useEffect(() => {
    const handleAddAttribute = () => addAttribute()
    window.addEventListener("attributes:add", handleAddAttribute)
    return () => window.removeEventListener("attributes:add", handleAddAttribute)
  }, [])

  const updateAttributeName = (index, name) => {
    setAttributes((prev) => prev.map((a, i) => (i === index ? { ...a, name } : a)))
  }

  const updateValueInput = (index, valueInput) => {
    setAttributes((prev) => prev.map((a, i) => (i === index ? { ...a, valueInput } : a)))
  }

  // Persists the attribute row itself (insert if new) — called before adding
  // its first value, since values need a real attribute_id to attach to.
  const ensureAttributeSaved = async (index) => {
    const attr = attributes[index]
    if (!attr.isNew) return attr.id
    if (!attr.name.trim()) {
      toast.error("Give the attribute a name first")
      return null
    }

    try {
      const { data, error } = await supabase
        .from("attributes")
        .insert({ name: attr.name.trim(), branch: branchId })
        .select()
        .single()

      if (error) throw error

      setAttributes((prev) =>
        prev.map((a, i) => (i === index ? { ...a, id: data.id, isNew: false } : a))
      )
      return data.id
    } catch (err) {
      console.error(err)
      toast.error("Failed to create attribute")
      return null
    }
  }

  const addValue = async (index) => {
    const attr = attributes[index]
    const trimmed = attr.valueInput.trim()
    if (!trimmed || !attr.name.trim()) return

    const attributeId = await ensureAttributeSaved(index)
    if (!attributeId) return

    try {
      const { data, error } = await supabase
        .from("attribute_values")
        .insert({ attribute_id: attributeId, value: trimmed })
        .select()
        .single()

      if (error) throw error

      setAttributes((prev) =>
        prev.map((a, i) =>
          i === index
            ? { ...a, values: [...a.values, { id: data.id, value: data.value }], valueInput: "" }
            : a
        )
      )
    } catch (err) {
      console.error(err)
      toast.error("Failed to add value")
    }
  }

  const handleKeyDown = (e, index) => {
    if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
      e.preventDefault()
      addValue(index)
      valueInputRefs.current[index]?.focus()
    }
  }

  const removeValue = async (index, valueId) => {
    try {
      const { error } = await supabase.from("attribute_values").delete().eq("id", valueId)
      if (error) throw error
      setAttributes((prev) =>
        prev.map((a, i) =>
          i === index ? { ...a, values: a.values.filter((v) => v.id !== valueId) } : a
        )
      )
    } catch (err) {
      console.error(err)
      toast.error("Failed to remove value")
    }
  }

  const removeAttribute = async (index) => {
    const attr = attributes[index]
    if (attr.isNew) {
      setAttributes((prev) => prev.filter((_, i) => i !== index))
      return
    }
    setSavingId(attr.id)
    try {
      const { error } = await supabase.from("attributes").delete().eq("id", attr.id)
      if (error) throw error
      setAttributes((prev) => prev.filter((_, i) => i !== index))
      toast.success("Attribute deleted")
    } catch (err) {
      console.error(err)
      toast.error("Failed to delete attribute")
    } finally {
      setSavingId(null)
    }
  }

  // Renames an existing (already-saved) attribute on blur.
  const saveAttributeName = async (index) => {
    const attr = attributes[index]
    if (attr.isNew || !attr.name.trim()) return
    try {
      const { error } = await supabase
        .from("attributes")
        .update({ name: attr.name.trim() })
        .eq("id", attr.id)
      if (error) throw error
    } catch (err) {
      console.error(err)
      toast.error("Failed to save attribute name")
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center text-neutral-500 text-xs">
        <Loader2 className="animate-spin h-4 w-4 mr-2" /> Loading attributes...
      </div>
    )
  }

  return (
    <div className="w-full p-0 text-xs text-neutral-900">
      <div className="space-y-3">
        {attributes.length === 0 ? (
          <div className="border border-dashed border-neutral-300 p-12 text-center text-neutral-500">
            No attributes available.
          </div>
        ) : attributes.map((attr, index) => (
          <div
            key={attr.id}
            ref={index === attributes.length - 1 ? lastAttrRef : null}
            className="border border-neutral-300 rounded-sm"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-300">
              <Input
                type="text"
                autoFocus={attr.isNew && justAdded}
                value={attr.name}
                onChange={(e) => updateAttributeName(index, e.target.value)}
                onBlur={() => saveAttributeName(index)}
                className="font-medium text-xs border-0 outline-0 flex-1 px-0"
                placeholder="Attribute name (e.g. Color, Size)"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeAttribute(index)}
                disabled={savingId === attr.id}
                className="h-6 w-6 p-0"
              >
                <Trash2 className="h-3.5 w-3.5 text-neutral-500" />
              </Button>
            </div>
            <div className="px-4 py-3 space-y-2">
              <label className="text-[10px] italic ml-1 font-medium text-neutral-500">
                Values
              </label>
              <Input
                ref={(el) => (valueInputRefs.current[index] = el)}
                type="text"
                value={attr.valueInput}
                onChange={(e) => updateValueInput(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                className="w-full border-0 outline-0 mt-1 text-xs placeholder-neutral-400 px-0"
                placeholder="Type a value and press Enter (e.g. Black, White, Red)"
              />
              <div className="flex flex-wrap gap-2">
                {attr.values.map((v) => (
                  <span
                    key={v.id}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-neutral-100 rounded-sm text-xs"
                  >
                    {v.value}
                    <button
                      onClick={() => removeValue(index, v.id)}
                      className="text-neutral-500 hover:text-neutral-700"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {attr.values.length === 0 && (
                  <span className="text-[10px] text-neutral-400 italic">No values yet</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

    </div>
  )
}