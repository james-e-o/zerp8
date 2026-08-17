// app/users/[u]/PageLayoutProvider.jsx
'use client'
import { useState, createContext } from "react"

export const DataContext = createContext()
export const RefreshContext = createContext()

const PageLayoutProvider = ({ children, data }) => {
  const [refreshKey, setRefreshKey] = useState(0)
  const [contextData, setContextData] = useState(data)

  return (
    <RefreshContext.Provider value={{ refreshKey, setRefreshKey }}>
      <DataContext.Provider value={{ data: contextData, setData: setContextData }}>
        {children}
      </DataContext.Provider>
    </RefreshContext.Provider>
  )
}

export default PageLayoutProvider