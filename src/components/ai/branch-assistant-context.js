"use client"

import { createContext, useCallback, useContext, useState } from "react"
import BranchAssistant from "@/components/ai/branch-assistant"

const BranchAssistantContext = createContext(null)

export function BranchAssistantProvider({ children, branchName }) {
  const [isOpen, setIsOpen] = useState(false)
  const onToggle = useCallback(() => setIsOpen((open) => !open), [])
  const onClose = useCallback(() => setIsOpen(false), [])

  return (
    <BranchAssistantContext.Provider value={{ isOpen, onToggle, onClose, branchName }}>
      {children}
    </BranchAssistantContext.Provider>
  )
}

export function useBranchAssistant() {
  return useContext(BranchAssistantContext)
}

export function BranchAssistantOverlay() {
  const assistant = useBranchAssistant()
  if (!assistant) return null

  return (
    <BranchAssistant
      isOpen={assistant.isOpen}
      branchName={assistant.branchName}
      onClose={assistant.onClose}
    />
  )
}