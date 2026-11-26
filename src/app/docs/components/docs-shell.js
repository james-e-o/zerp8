"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import {
  ArrowLeft,
  BookOpen,
  Boxes,
  Building2,
  Calculator,
  ClipboardList,
  HelpCircle,
  PackageCheck,
  Search,
  Settings,
  ShoppingCart,
  Store,
} from "lucide-react"
import { docsModules, getDocsModule, getModuleTopics } from "@/lib/docs/registry"

const moduleIcons = {
  clipboard: ClipboardList,
  building: Building2,
  boxes: Boxes,
  cart: ShoppingCart,
  package: PackageCheck,
  store: Store,
  calculator: Calculator,
  settings: Settings,
  book: BookOpen,
  help: HelpCircle,
}

function getOnPageHeadings(pathname) {
  const [, , moduleSlug] = pathname.split("/")

  if (!moduleSlug) {
    return [
      { heading: "Start here", id: "start-here" },
      { heading: "Browse modules", id: "browse-modules" },
    ]
  }

  const module = getDocsModule(moduleSlug)
  if (module?.status === "planned") return [{ heading: "Coming soon", id: "coming-soon" }]

  return [
    { heading: moduleSlug === "faq" ? "Browse answers" : "Topics", id: "topics" },
    ...getModuleTopics(moduleSlug).map((topic) => ({ heading: topic.title, id: topic.slug })),
  ]
}

function SidebarLink({ href, active, planned, children }) {
  const classes = [
    "block rounded px-2.5 py-2 text-xs transition-colors",
    active ? "bg-[#e7e6e7] text-[#17192a]" : "text-[#666b7d] hover:bg-white hover:text-[#17192a]",
    planned ? "opacity-55" : "",
  ].filter(Boolean).join(" ")

  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={classes}>
      {children}
    </Link>
  )
}

function DocsSidebar({ pathname }) {
  const [query, setQuery] = useState("")
  const [activeTopic, setActiveTopic] = useState("")
  const search = query.trim().toLowerCase()
  const [, , currentModule] = pathname.split("/")

  useEffect(() => {
    if (!currentModule) {
      setActiveTopic("")
      return
    }

    const updateHash = () => setActiveTopic(window.location.hash.slice(1))
    updateHash()
    window.addEventListener("hashchange", updateHash)

    const sections = document.querySelectorAll("[data-doc-topic]")
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActiveTopic(visible[0].target.id)
      },
      { rootMargin: "-18% 0px -68% 0px" }
    )

    sections.forEach((section) => observer.observe(section))
    return () => {
      window.removeEventListener("hashchange", updateHash)
      observer.disconnect()
    }
  }, [currentModule, pathname])

  const filteredModules = docsModules.filter((module) => {
    const topics = getModuleTopics(module.slug)
    return !search
      || `${module.title} ${module.summary}`.toLowerCase().includes(search)
      || topics.some((topic) => `${topic.title} ${topic.summary}`.toLowerCase().includes(search))
  })

  return (
    <nav aria-label="Documentation navigation" className="h-fit rounded-md border border-[#e7e6e7] bg-white p-3 md:sticky md:top-24">
      <label className="relative mb-3 block">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#898c99]" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search docs"
          aria-label="Search documentation titles and summaries"
          className="h-9 w-full rounded border border-[#e7e6e7] bg-[#f7f7f4] pl-8 pr-2 text-xs text-[#17192a] outline-none placeholder:text-[#898c99] focus:border-[#5148e5]/50 focus:ring-2 focus:ring-[#5148e5]/10"
        />
      </label>

      <SidebarLink href="/docs" active={pathname === "/docs"}>Documentation home</SidebarLink>
      <div className="mt-2 space-y-1">
        {filteredModules.map((module) => {
          const Icon = moduleIcons[module.icon] || BookOpen
          const moduleTopics = getModuleTopics(module.slug)
          const moduleMatches = search && `${module.title} ${module.summary}`.toLowerCase().includes(search)
          const topics = search && !moduleMatches
            ? moduleTopics.filter((topic) => `${topic.title} ${topic.summary}`.toLowerCase().includes(search))
            : moduleTopics

          return (
            <details key={module.slug} open={search ? true : currentModule === module.slug} className="group">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded px-2.5 py-2 text-xs font-semibold text-[#343648] hover:bg-[#f7f7f4] [&::-webkit-details-marker]:hidden">
                <Icon size={14} className="shrink-0 text-[#5148e5]" />
                <span className="min-w-0 flex-1 truncate">{module.title}</span>
                {module.status === "planned" && <span className="text-[9px] font-medium text-[#898c99]">PLANNED</span>}
                <span aria-hidden="true" className="text-[10px] text-[#898c99] transition-transform group-open:rotate-90">›</span>
              </summary>
              <div className="ml-3 border-l border-[#e7e6e7] pl-2">
                <SidebarLink
                  href={`/docs/${module.slug}`}
                  active={currentModule === module.slug && !activeTopic}
                  planned={module.status === "planned"}
                >
                  Overview
                </SidebarLink>
                {topics.map((topic) => (
                  <SidebarLink
                    key={topic.slug}
                    href={`/docs/${module.slug}#${topic.slug}`}
                    active={currentModule === module.slug && activeTopic === topic.slug}
                    planned={topic.status === "planned"}
                  >
                    {topic.title}
                  </SidebarLink>
                ))}
              </div>
            </details>
          )
        })}
        {filteredModules.length === 0 && (
          <p className="px-2.5 py-3 text-xs text-[#898c99]">No matching guides.</p>
        )}
      </div>
    </nav>
  )
}

function OnThisPage({ headings }) {
  if (headings.length === 0) return null

  return (
    <nav aria-label="On this page" className="hidden h-fit xl:sticky xl:top-24 xl:block">
      <p className="mb-3 text-[9px] font-bold tracking-[0.1em] text-[#898c99]">ON THIS PAGE</p>
      <ul className="space-y-2 border-l border-[#e7e6e7] pl-3">
        {headings.map(({ heading, id }) => (
          <li key={id}>
            <Link href={`#${id}`} className="text-[11px] text-[#666b7d] hover:text-[#5148e5]">
              {heading}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export default function DocsShell({ children }) {
  const pathname = usePathname()
  const headings = getOnPageHeadings(pathname)

  return (
    <div className="h-svh scroll-smooth overflow-y-auto bg-[#f7f7f4] text-[#17192a]">
      <header className="sticky top-0 z-20 border-b border-[#17192a]/[0.08] bg-[#f7f7f4]/95 backdrop-blur-md">
        <div className="mx-auto flex h-[68px] w-[calc(100%-36px)] max-w-[1400px] items-center justify-between sm:w-[calc(100%-64px)]">
          <Link href="/docs" aria-label="ZERP-8 documentation home" className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Image src="/zerp8-logo.png" alt="" width={38} height={38} className="h-8 w-8 object-contain" />
            <span>ZERP-8</span>
            <span className="text-xs font-medium text-[#898c99]">Docs</span>
          </Link>
          <Link href="/" className="inline-flex items-center gap-2 text-xs font-medium text-[#565a6b] hover:text-[#5148e5]">
            <ArrowLeft size={15} /> Back to home
          </Link>
        </div>
      </header>

      <div className="mx-auto grid w-[calc(100%-36px)] max-w-[1400px] gap-6 py-7 sm:w-[calc(100%-64px)] sm:py-10 md:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_170px]">
        <DocsSidebar pathname={pathname} />
        <main className="min-w-0">{children}</main>
        <OnThisPage headings={headings} />
      </div>
    </div>
  )
}
