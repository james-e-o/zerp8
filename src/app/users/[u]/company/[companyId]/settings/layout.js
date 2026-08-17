import { ReusableCompanySidebar } from "../companyLayoutClient"

export default function CompanySettingsLayout ({children}){
    
    return(
        <ReusableCompanySidebar>
            {children}
        </ReusableCompanySidebar>
    )
}