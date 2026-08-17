'use client'

import { createContext, useContext, useState } from 'react'

// --- define context in same file ---
const DataContext = createContext()

export const useData = () => useContext(DataContext)

// --- client layout component ---
export default function ClientLayout({ session, profile, children }) {
  const [user, setUser] = useState({
    id: session.user.id,
    email: session.user.email,
    handle: profile.handle,
  })

  return (
    <DataContext.Provider value={{ user, setUser }}>
      {children}
    </DataContext.Provider>
  )
}

