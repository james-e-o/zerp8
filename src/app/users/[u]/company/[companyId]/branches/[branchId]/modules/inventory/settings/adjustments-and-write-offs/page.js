import ApprovalSettingsSection from '@/components/modules/inventory/approval-settings-section'

// Inventory > Settings > Adjustments & Write-offs.
// Approval for stock counts and adjustments. Reasons and other rules are added
// here once the Adjustments page is built.

export default function AdjustmentsAndWriteOffsSettingsPage() {
  return (
    <ApprovalSettingsSection
      action="post_adjustment"
      settingKey="require_adjustment_approval"
      noun="adjustments and counts"
      description="Whether a stock count or adjustment needs approval before it changes stock, and who may approve it."
    />
  )
}
