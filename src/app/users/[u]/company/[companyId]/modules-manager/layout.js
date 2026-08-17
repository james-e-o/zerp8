import { ReusableCompanySidebar } from "../companyLayoutClient"

export default function ModulesManagerLayout ({children}){
    
    return(
        <ReusableCompanySidebar>
            {children}
        </ReusableCompanySidebar>
    )
}