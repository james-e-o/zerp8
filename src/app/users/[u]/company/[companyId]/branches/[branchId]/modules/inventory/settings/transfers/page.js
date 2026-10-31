import ApprovalSettingsSection from '@/components/modules/inventory/approval-settings-section'

// Inventory > Settings > Transfers.
// Approval for moving stock between warehouses and branches.

export default function TransfersSettingsPage() {
  return (
    <ApprovalSettingsSection
      action="post_transfer"
      settingKey="require_transfer_approval"
      noun="transfers"
      description="Whether a transfer needs approval before stock leaves, and who may approve it."
    />
  )
}
