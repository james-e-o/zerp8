

import { ReusableBranchSidebar } from "../branchLayoutClient"

export default function BranchSettingsLayout({ children }) {
  return (
    <ReusableBranchSidebar>
      {children}
    </ReusableBranchSidebar>
  )
}