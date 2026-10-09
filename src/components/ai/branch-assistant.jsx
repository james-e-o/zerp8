"use client"

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { ArrowUp, Building2, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

const SUGGESTIONS = [
  "Summarize this branch's activity this week",
  "Which products are below their reorder level?",
  "What purchase requests are waiting for approval?",
  "Show overdue supplier bills",
]

export default function BranchAssistant({ isOpen, branchName, onClose }) {
  const [prompt, setPrompt] = useState("")
  const [notice, setNotice] = useState("")
  const inputRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return
    inputRef.current?.focus()

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose()
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!prompt.trim()) return
    setNotice("Branch AI isn't connected yet. Your message hasn't been sent.")
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.section
          aria-label="Branch AI assistant"
          aria-modal="true"
          className="absolute inset-0 z-50 flex flex-col bg-background shadow-[0_16px_48px_rgba(15,23,42,0.16)]"
          initial={{ opacity: 0, clipPath: "inset(0 0 100% 0)", y: -10 }}
          animate={{ opacity: 1, clipPath: "inset(0 0 0% 0)", y: 0 }}
          exit={{ opacity: 0, clipPath: "inset(0 0 100% 0)", y: -8 }}
          transition={{
            opacity: { duration: 0.2 },
            clipPath: { duration: 0.42, ease: [0.22, 1, 0.36, 1] },
            y: { duration: 0.42, ease: [0.22, 1, 0.36, 1] },
          }}
          role="dialog"
        >
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-core_light text-core">
            <Sparkles className="size-4" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-foreground">Branch AI</h1>
            <p className="truncate text-[10px] text-muted-foreground">{branchName || "Current branch"} · Entire branch</p>
          </div>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close Branch AI">
          <X className="size-4" />
        </Button>
      </header>

      <div className="shrink-0 border-b border-border bg-card px-4 py-3 sm:px-8">
        <form onSubmit={handleSubmit} className="mx-auto max-w-3xl">
          <div className="flex items-end gap-2 rounded-sm border border-border bg-background p-2 focus-within:border-core/50">
            <Textarea
              ref={inputRef}
              value={prompt}
              onChange={(event) => {
                setPrompt(event.target.value)
                setNotice("")
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault()
                  event.currentTarget.form?.requestSubmit()
                }
              }}
              aria-label="Ask Branch AI"
              placeholder="Ask about this branch..."
              className="max-h-32 min-h-10 resize-y border-0 bg-transparent px-2 py-2 text-xs shadow-none focus-visible:ring-0"
              rows={1}
            />
            <Button
              type="submit"
              size="icon-sm"
              disabled={!prompt.trim()}
              aria-label="Send message"
              className="shrink-0 rounded-sm bg-core text-white hover:bg-core/90"
            >
              <ArrowUp className="size-4" />
            </Button>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p aria-live="polite" className="text-[10px] text-muted-foreground">
              {notice || "AI responses are not connected yet."}
            </p>
            <span className="shrink-0 text-[10px] text-muted-foreground">Branch-wide context</span>
          </div>
        </form>
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_260px]">
        <main className="flex min-h-0 flex-col">
          <div className="flex-1 overflow-y-auto px-4 py-8 sm:px-8">
            <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center">
              <div className="mb-7">
                <div className="mb-3 flex items-center gap-2 text-core">
                  <Building2 className="size-4" />
                  <span className="text-[11px] font-medium">Branch workspace</span>
                </div>
                <h2 className="text-xl font-semibold text-foreground">What would you like to know?</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ask across this branch's operations, products, purchases, and sales.
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => {
                      setPrompt(suggestion)
                      setNotice("")
                      inputRef.current?.focus()
                    }}
                    className="rounded-sm border border-border bg-card px-3 py-2.5 text-left text-xs text-foreground transition-colors hover:bg-muted"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>

        </main>

        <aside className="hidden border-l border-border bg-muted/30 p-4 lg:block">
          <h2 className="text-xs font-semibold text-foreground">Context</h2>
          <dl className="mt-4 space-y-4 text-xs">
            <div>
              <dt className="text-[10px] text-muted-foreground">Scope</dt>
              <dd className="mt-1 font-medium text-foreground">Entire branch</dd>
            </div>
            <div>
              <dt className="text-[10px] text-muted-foreground">Branch</dt>
              <dd className="mt-1 font-medium text-foreground">{branchName || "Current branch"}</dd>
            </div>
            <div>
              <dt className="text-[10px] text-muted-foreground">Coverage</dt>
              <dd className="mt-1 leading-5 text-muted-foreground">
                Branch pages and enabled modules, including Inventory, Products, Purchases, Sales, Orders, and Invoices.
              </dd>
            </div>
          </dl>
        </aside>
      </div>
        </motion.section>
      )}
    </AnimatePresence>
  )
}