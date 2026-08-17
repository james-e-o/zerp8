'use client'

import { useState, useEffect, useContext } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {  Select,  SelectContent,  SelectItem,  SelectTrigger,  SelectValue,} from '@/components/ui/select'
import supabase from '@/config/supabaseClient'
import { CompanyInfoContext } from '../../../../companyInfoProvider'
import { StaffContext } from '@/components/contexts/staff-context'
import { Check, X, Edit2 } from 'lucide-react'

export default function EditStaffTab({ staffData, setStaffData, onSaveSuccess }) {
  const { accessLevels } = useContext(CompanyInfoContext)
  const { refetchStaffData } = useContext(StaffContext)
  const [isEditMode, setIsEditMode] = useState(false)
  const [editableData, setEditableData] = useState({
    access_level: staffData.access_level,
    branch: staffData.branch,
    status: staffData.status,
    role: staffData.role,
  })
  const [isUpdating, setIsUpdating] = useState(false)
  const [branches, setBranches] = useState([])
  const [isLoadingBranches, setIsLoadingBranches] = useState(true)
  const [roles, setRoles] = useState([])
  const [isLoadingRoles, setIsLoadingRoles] = useState(true)
  
  // Pending changes section
  const [pendingChanges, setPendingChanges] = useState([])
  const [isLoadingChanges, setIsLoadingChanges] = useState(true)

  // console.log('Access levels from context:', accessLevels)
  // console.log('Staff data access_level:', staffData.access_level)

  // Fetch branches from the company
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        setIsLoadingBranches(true)
        const { data, error } = await supabase
          .from('branches_lite')
          .select('id, name')
          .eq('company', staffData.company)
          .order('name', { ascending: true })

        if (error) throw error
        setBranches(data || [])
      } catch (err) {
        console.error('Error fetching branches:', err)
      } finally {
        setIsLoadingBranches(false)
      }
    }

    if (staffData.company) {
      fetchBranches()
    }
  }, [staffData.company])

  // Fetch roles from the company
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        setIsLoadingRoles(true)
        const { data, error } = await supabase
          .from('company_roles')
          .select('id, role')
          .eq('company_id', staffData.company)
          .eq('is_active', true)
          .order('created_at', { ascending: true })

        if (error) throw error
        setRoles(data || [])
      } catch (err) {
        console.error('Error fetching roles:', err)
      } finally {
        setIsLoadingRoles(false)
      }
    }

    if (staffData.company) {
      fetchRoles()
    }
  }, [staffData.company])

  // Fetch pending changes
  useEffect(() => {
    const fetchPendingChanges = async () => {
      try {
        setIsLoadingChanges(true)
        const { data, error } = await supabase
          .from('staff_change_requests')
          .select('*')
          .eq('staff_id', staffData.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })

        if (error) throw error
        setPendingChanges(data || [])
      } catch (err) {
        console.error('Error fetching pending changes:', err)
      } finally {
        setIsLoadingChanges(false)
      }
    }

    if (staffData.id) {
      fetchPendingChanges()
    }
  }, [staffData.id])

  const handleAccessLevelChange = (newLevel) => {
    setEditableData(prev => ({ ...prev, access_level: newLevel }))
  }

  const handleBranchChange = (newBranch) => {
    setEditableData(prev => ({ ...prev, branch: newBranch === 'none' ? null : newBranch }))
  }

  const handleSaveChanges = async () => {
    setIsUpdating(true)
    try {
      const { error } = await supabase
        .from('staff')
        .update({
          access_level: editableData.access_level,
          branch: editableData.branch,
          status: editableData.status,
          role: editableData.role,
        })
        .eq('id', staffData.id)

      if (error) throw error

      // Refetch the updated staff data
      const { data: updatedStaffData, error: fetchError } = await supabase
        .from('staff')
        .select('*')
        .eq('id', staffData.id)
        .single()

      if (fetchError) throw fetchError

      // Update parent state with fresh data
      setStaffData(updatedStaffData)
      setIsEditMode(false)
      console.log('Changes saved successfully')

      // Refresh the staff directory table via context
      await refetchStaffData()

      // Switch to overview tab
      if (onSaveSuccess) {
        onSaveSuccess()
      }
    } catch (err) {
      console.error('Error saving changes:', err)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleApproveChange = async (changeId, changeData) => {
    try {
      // Update staff record
      const { error: updateError } = await supabase
        .from('staff')
        .update(changeData)
        .eq('id', staffData.id)

      if (updateError) throw updateError

      // Mark change as approved
      const { error: approveError } = await supabase
        .from('staff_change_requests')
        .update({ status: 'approved', approved_at: new Date().toISOString() })
        .eq('id', changeId)

      if (approveError) throw approveError

      setPendingChanges(prev => prev.filter(c => c.id !== changeId))
      setStaffData(prev => ({ ...prev, ...changeData }))
      console.log('Change approved')
    } catch (err) {
      console.error('Error approving change:', err)
    }
  }

  const handleRejectChange = async (changeId) => {
    try {
      const { error } = await supabase
        .from('staff_change_requests')
        .update({ status: 'rejected' })
        .eq('id', changeId)

      if (error) throw error
      setPendingChanges(prev => prev.filter(c => c.id !== changeId))
      console.log('Change rejected')
    } catch (err) {
      console.error('Error rejecting change:', err)
    }
  }

  const InfoSection = ({ title, children }) => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      {children}
    </div>
  )

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Column - Staff Settings */}
      <Card className="border-gray-200 shadow-sm p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Staff Settings</h3>
            <Button
              onClick={() => {
                if (isEditMode) {
                  setEditableData({
                    access_level: staffData.access_level,
                    branch: staffData.branch,
                    status: staffData.status,
                    role: staffData.role,
                  })
                }
                setIsEditMode(!isEditMode)
              }}
              variant="outline"
              className="gap-2"
            >
              <Edit2 className="size-4" />
              {isEditMode ? 'Cancel' : 'Edit'}
            </Button>
          </div>

          {isEditMode ? (
            <div className="space-y-6">
              {/* Access Level Selection */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Access Level</label>
                <Select 
                  value={editableData.access_level} 
                  onValueChange={handleAccessLevelChange}
                >
                  <SelectTrigger className="border-gray-300 w-full">
                    <SelectValue placeholder="Select access level">
                      {accessLevels?.find(al => al.key === editableData.access_level)?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {accessLevels?.map((level) => (
                      <SelectItem key={level.id} value={level.key}>
                        {level.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Branch Selection */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Branch</label>
                <Select 
                  value={editableData.branch || 'none'} 
                  onValueChange={handleBranchChange}
                  disabled={isLoadingBranches}
                >
                  <SelectTrigger className="border-gray-300 w-full">
                    <SelectValue placeholder={isLoadingBranches ? "Loading..." : "Select branch"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status Selection */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Status</label>
                <Select 
                  value={editableData.status || 'pending'} 
                  onValueChange={(newStatus) => setEditableData(prev => ({ ...prev, status: newStatus }))}
                >
                  <SelectTrigger className="border-gray-300 w-full">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="terminated">Terminated</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Role Selection */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Role</label>
                <Select 
                  value={editableData.role || 'none'} 
                  onValueChange={(newRole) => setEditableData(prev => ({ ...prev, role: newRole === 'none' ? null : newRole }))}
                  disabled={isLoadingRoles}
                >
                  <SelectTrigger className="border-gray-300 w-full">
                    <SelectValue placeholder={isLoadingRoles ? "Loading..." : "Select role"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Save Button */}
              <Button 
                onClick={handleSaveChanges} 
                disabled={isUpdating}
                className="bg-core hover:bg-core/90 text-white w-full mt-4"
              >
                {isUpdating ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Access Level Display */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Access Level</label>
                <div className="px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm">
                  {accessLevels?.find(al => al.key === staffData.access_level)?.name || staffData.access_level || 'N/A'}
                </div>
              </div>

              {/* Branch Display */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Branch</label>
                <div className="px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm">
                  {branches.find(b => b.id === staffData.branch)?.name || 'N/A'}
                </div>
              </div>

              {/* Status Display */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Status</label>
                <div className="px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm capitalize">
                  {staffData.status || 'N/A'}
                </div>
              </div>

              {/* Role Display */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Role</label>
                <div className="px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm">
                  {roles.find(r => r.id === staffData.role)?.role || 'N/A'}
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Right Column - Pending Staff Update Approvals */}
      <Card className="border-gray-200 shadow-sm p-6">
        <InfoSection title="Pending Staff Update Approvals">
          {isLoadingChanges ? (
            <p className="text-sm text-gray-600">Loading pending changes...</p>
          ) : pendingChanges.length === 0 ? (
            <p className="text-sm text-gray-600">No pending changes to approve</p>
          ) : (
            <div className="space-y-4">
              {pendingChanges.map((change) => (
                <div key={change.id} className="border border-amber-200 bg-amber-50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">Change Request</p>
                      <p className="text-sm text-gray-600">
                        Requested: {new Date(change.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {/* Change Details */}
                  <div className="bg-white rounded p-3 space-y-2 border border-amber-100">
                    {Object.entries(change.requested_changes || {}).map(([key, value]) => (
                      <div key={key} className="flex justify-between items-center text-sm">
                        <span className="text-gray-600 capitalize">{key}:</span>
                        <span className="font-medium text-gray-900">{String(value)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleApproveChange(change.id, change.requested_changes)}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-2"
                    >
                      <Check className="size-4" />
                      Approve
                    </Button>
                    <Button
                      onClick={() => handleRejectChange(change.id)}
                      variant="outline"
                      className="flex-1 border-red-200 text-red-600 hover:bg-red-50 gap-2"
                    >
                      <X className="size-4" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </InfoSection>
      </Card>
    </div>
  )
}
