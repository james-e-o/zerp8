"use client"

import { createContext } from "react"

// Separated from layout.js on purpose — layout.js is a Server Component
// (it imports supabaseServer, which depends on next/headers). Any client
// component that needs CompanyInfoContext must import it from HERE, never
// from layout.js directly, or the bundler pulls next/headers into the
// client bundle and the build fails.
export const CompanyInfoContext = createContext()