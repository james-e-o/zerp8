"use client"

import React, { useState, useContext, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CompanyInfoContext } from '../../../../companyInfoProvider'
import supabase from '@/config/supabaseClient'
import { toast } from 'sonner'
import { Plus, Trash2, Loader2, Edit2, X } from 'lucide-react'

export default function ShippingProfiles() {
  const params = useParams()
  const { u, companySlug, branch } = params
  const { branches } = useContext(CompanyInfoContext)

  const currentBranch = (branches || []).find(b => String(b.id) === String(branch))

  // State management
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({ name: '', description: '', baseRate: '', estimatedDays: '' })
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(null)

  // Fetch shipping profiles
  const fetchProfiles = async () => {
    if (!currentBranch?.id) return

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('shipping_profiles')
        .select('*')
        .eq('branch_id', currentBranch.id)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Error fetching shipping profiles:', error)
        toast.error('Failed to load shipping profiles')
        return
      }

      // Ensure default profile exists
      const hasDefault = data?.some(p => p.is_default)
      if (!hasDefault && (!data || data.length === 0)) {
        // Create default profile
        createDefaultProfile()
        return
      }

      setProfiles(data || [])
    } catch (error) {
      console.error('Error:', error)
      toast.error('Unexpected error loading profiles')
    } finally {
      setLoading(false)
    }
  }

  // Create default shipping profile
  const createDefaultProfile = async () => {
    if (!currentBranch?.id) return

    try {
      const { data, error } = await supabase
        .from('shipping_profiles')
        .insert([
          {
            name: 'Standard Shipping',
            description: 'Default shipping profile',
            branch_id: currentBranch.id,
            is_default: true,
            base_rate: 0,
            estimated_days: 5
          }
        ])
        .select('*')

      if (error) {
        console.error('Error creating default profile:', error)
        return
      }

      setProfiles(data || [])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  // Save profile (create or update)
  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Profile name is required')
      return
    }

    try {
      setIsSaving(true)

      if (editingId) {
        // Update existing
        const { error } = await supabase
          .from('shipping_profiles')
          .update({
            name: formData.name,
            description: formData.description,
            base_rate: parseFloat(formData.baseRate) || 0,
            estimated_days: parseInt(formData.estimatedDays) || 0
          })
          .eq('id', editingId)
          .eq('branch_id', currentBranch.id)

        if (error) {
          toast.error('Failed to update profile')
          return
        }

        toast.success('Profile updated successfully')
      } else {
        // Create new
        const { data, error } = await supabase
          .from('shipping_profiles')
          .insert([
            {
              name: formData.name,
              description: formData.description,
              base_rate: parseFloat(formData.baseRate) || 0,
              estimated_days: parseInt(formData.estimatedDays) || 0,
              branch_id: currentBranch.id,
              is_default: false
            }
          ])
          .select('*')

        if (error) {
          toast.error('Failed to create profile')
          return
        }

        setProfiles([...profiles, data[0]])
        toast.success('Profile created successfully')
      }

      setShowForm(false)
      setEditingId(null)
      setFormData({ name: '', description: '', baseRate: '', estimatedDays: '' })
      fetchProfiles()
    } catch (error) {
      console.error('Error:', error)
      toast.error('Unexpected error')
    } finally {
      setIsSaving(false)
    }
  }

  // Delete profile
  const handleDelete = async (profileId, profileName) => {
    if (profileName === 'Standard Shipping') {
      toast.error('Cannot delete default shipping profile')
      return
    }

    if (!confirm(`Delete "${profileName}"?`)) return

    try {
      setIsDeleting(profileId)
      const { error } = await supabase
        .from('shipping_profiles')
        .delete()
        .eq('id', profileId)
        .eq('branch_id', currentBranch.id)

      if (error) {
        toast.error('Failed to delete profile')
        return
      }

      setProfiles(profiles.filter(p => p.id !== profileId))
      toast.success('Profile deleted successfully')
    } catch (error) {
      console.error('Error:', error)
      toast.error('Unexpected error')
    } finally {
      setIsDeleting(null)
    }
  }

  // Open form for new profile
  const openNewForm = () => {
    setEditingId(null)
    setFormData({ name: '', description: '', baseRate: '', estimatedDays: '' })
    setShowForm(true)
  }

  // Open form for editing
  const openEditForm = (profile) => {
    setEditingId(profile.id)
    setFormData({
      name: profile.name,
      description: profile.description || '',
      baseRate: profile.base_rate || '',
      estimatedDays: profile.estimated_days || ''
    })
    setShowForm(true)
  }

  // Close form
  // Close form
  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    setFormData({ name: '', description: '', baseRate: '', estimatedDays: '' })
  }

  useEffect(() => {
    fetchProfiles()
  }, [currentBranch?.id])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <motion.div 
      className="space-y-6 p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header */}
      <motion.div 
        className="flex items-center justify-between"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Shipping Profiles</h1>
          <p className="text-sm text-gray-500 mt-1">Manage shipping options for your branch</p>
        </div>
        {!showForm && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <Button
              className="bg-core hover:bg-blue-700 text-white"
              onClick={openNewForm}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Shipping Profile
            </Button>
          </motion.div>
        )}
      </motion.div>

      {/* Form Section */}
      <AnimatePresence>
        {showForm && (
          <motion.div 
            className="border border-gray-200 rounded-lg p-6 bg-white"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">
              {editingId ? 'Edit Shipping Profile' : 'Create New Shipping Profile'}
            </h2>
            <button
              onClick={closeForm}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-xs font-medium mb-1 block">Profile Name</Label>
              <Input
                placeholder="e.g., Express, Standard, Economy"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-medium mb-1 block">Description</Label>
              <Textarea
                placeholder="Describe this shipping option..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="text-xs min-h-20"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-medium mb-1 block">Base Rate ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.baseRate}
                  onChange={(e) => setFormData({ ...formData, baseRate: e.target.value })}
                  className="text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-medium mb-1 block">Est. Days</Label>
                <Input
                  type="number"
                  placeholder="Days"
                  value={formData.estimatedDays}
                  onChange={(e) => setFormData({ ...formData, estimatedDays: e.target.value })}
                  className="text-xs"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={closeForm}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-core hover:bg-blue-700"
                disabled={isSaving}
                onClick={handleSave}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  editingId ? 'Update' : 'Create'
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Profiles Grid */}
      <motion.div 
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <AnimatePresence>
          {profiles.map((profile, index) => (
            <motion.div
              key={profile.id}
              className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-md transition-shadow"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-gray-900">{profile.name}</h3>
                  {profile.is_default && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                      Default
                    </span>
                  )}
                </div>
              </div>
            </div>

            {profile.description && (
              <p className="text-sm text-gray-600 mb-3 line-clamp-2">{profile.description}</p>
            )}

            <div className="space-y-2 mb-4 text-sm text-gray-600">
              <div>
                <span className="text-gray-500">Base Rate:</span>
                <span className="ml-2 font-medium">${profile.base_rate || 0}</span>
              </div>
              <div>
                <span className="text-gray-500">Est. Days:</span>
                <span className="ml-2 font-medium">{profile.estimated_days || 0} days</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => openEditForm(profile)}
              >
                <Edit2 className="h-3 w-3 mr-1" />
                Edit
              </Button>
              {!profile.is_default && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="flex-1"
                  disabled={isDeleting === profile.id}
                  onClick={() => handleDelete(profile.id, profile.name)}
                >
                  {isDeleting === profile.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="h-3 w-3 mr-1" />
                      Delete
                    </>
                  )}
                </Button>
              )}
            </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}
