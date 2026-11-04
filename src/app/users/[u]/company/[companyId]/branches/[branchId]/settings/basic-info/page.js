"use client"

import { useContext, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Building2, Pencil, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { BranchContext } from "../../branchContext"
import { CompanyInfoContext } from "../../../../companyInfoProvider"
import supabase from "@/config/supabaseClient"
import { toast } from "sonner"

function ProfileDetail({ label, value }) {
  return (
    <div className="min-w-0 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-foreground">{value || "—"}</dd>
    </div>
  )
}

export default function BranchBasicInfo() {
  const { companyId } = useParams()
  const router = useRouter()
  const { currentBranch } = useContext(BranchContext)
  const { accessLevelScope } = useContext(CompanyInfoContext)
  const [savedProfile, setSavedProfile] = useState(null)
  const [profileForm, setProfileForm] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const branch = currentBranch
    ? {
        ...currentBranch,
        ...(savedProfile?.id === currentBranch.id ? savedProfile : {}),
      }
    : null

  const startEditing = () => {
    setProfileForm({
      name: branch.name || "",
      address: branch.address || "",
      city: branch.city || "",
      country: branch.country || "",
      email: branch.email || "",
      phone: branch.phone || "",
    })
    setIsEditing(true)
  }

  const updateForm = (event) => {
    const { name, value } = event.target
    setProfileForm((current) => ({ ...current, [name]: value }))
  }

  const saveProfile = async (event) => {
    event.preventDefault()
    if (!profileForm.name.trim()) {
      toast.error("Branch name is required")
      return
    }

    setIsSaving(true)
    try {
      const updates = {
        name: profileForm.name.trim(),
        address: profileForm.address.trim() || null,
        city: profileForm.city.trim() || null,
        country: profileForm.country.trim() || null,
        email: profileForm.email.trim() || null,
        phone: profileForm.phone.trim() || null,
      }
      const { error } = await supabase
        .from("branches")
        .update(updates)
        .eq("id", branch.id)
        .eq("company", companyId)

      if (error) {
        console.error("Failed to update branch profile:", error)
        toast.error("Failed to update branch profile")
        return
      }

      setSavedProfile({ id: branch.id, ...updates })
      setIsEditing(false)
      toast.success("Branch profile updated")
      router.refresh()
    } catch (error) {
      console.error("Failed to update branch profile:", error)
      toast.error("An unexpected error occurred")
    } finally {
      setIsSaving(false)
    }
  }

  if (!branch) {
    return <p className="p-2 text-xs text-muted-foreground">Branch profile is unavailable.</p>
  }

  const fields = [
    { name: "name", label: "Branch name", required: true },
    { name: "address", label: "Street address" },
    { name: "city", label: "City" },
    { name: "country", label: "Country" },
    { name: "email", label: "Contact email", type: "email" },
    { name: "phone", label: "Phone" },
  ]

  return (
    <main className="space-y-4 p-2">
      <header>
        <h1 className="text-base font-semibold tracking-tight text-core">Branch profile</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          View and update this branch&apos;s identity, location, and contact details.
        </p>
      </header>

      <section className="max-w-3xl rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Building2 className="size-4 text-core" />
            <h2 className="text-sm font-semibold text-foreground">Profile details</h2>
          </div>
          {accessLevelScope === "company" && (
            <Button
              type="button"
              variant={isEditing ? "ghost" : "outline"}
              size="icon-sm"
              aria-label={isEditing ? "Cancel profile editing" : "Edit branch profile"}
              title={isEditing ? "Cancel editing" : "Edit branch profile"}
              onClick={() => (isEditing ? setIsEditing(false) : startEditing())}
            >
              {isEditing ? <X className="size-4" /> : <Pencil className="size-4" />}
            </Button>
          )}
        </div>

        {isEditing ? (
          <form onSubmit={saveProfile} className="space-y-3">
            <label className="block space-y-1.5 text-xs font-medium text-foreground">
              Branch ID
              <Input value={branch.id} readOnly />
            </label>
            <label className="block space-y-1.5 text-xs font-medium text-foreground">
              Office type
              <Input value={branch.isheadoffice ? "Head office" : "Branch"} readOnly />
            </label>
            {fields.map((field) => (
              <label key={field.name} className="block space-y-1.5 text-xs font-medium text-foreground">
                {field.label}
                <Input
                  name={field.name}
                  type={field.type || "text"}
                  required={field.required}
                  value={profileForm[field.name]}
                  onChange={updateForm}
                />
              </label>
            ))}
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button type="button" variant="outline" onClick={() => setIsEditing(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" className="bg-core text-white hover:bg-core/85" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </form>
        ) : (
          <dl className="divide-y divide-border">
            <ProfileDetail label="Branch ID" value={branch.id} />
            <ProfileDetail label="Office type" value={branch.isheadoffice ? "Head office" : "Branch"} />
            <ProfileDetail label="Branch name" value={branch.name} />
            <ProfileDetail label="Street address" value={branch.address} />
            <ProfileDetail label="City" value={branch.city} />
            <ProfileDetail label="Country" value={branch.country} />
            <ProfileDetail label="Contact email" value={branch.email} />
            <ProfileDetail label="Phone" value={branch.phone} />
          </dl>
        )}
      </section>
    </main>
  )
}
