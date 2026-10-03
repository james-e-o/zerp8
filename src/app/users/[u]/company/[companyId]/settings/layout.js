import { ReusableCompanySidebar } from "../companyLayoutClient"

export default function CompanySettingsLayout ({children}){
    
    return(
        <ReusableCompanySidebar>
            <div className="flex flex-col overflow-hidden md:px-4 px-2 py-2">
                {children}
            </div>
        </ReusableCompanySidebar>
    )
}