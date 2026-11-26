import Link from "next/link"
import {
  BookOpen,
  Boxes,
  Building2,
  Calculator,
  ClipboardList,
  HelpCircle,
  PackageCheck,
  ShoppingCart,
  Store,
  Settings,
  ArrowRight,
  ArrowLeft,
} from "lucide-react"
import { docsModules, getAdjacentTopics, getDocsModule, getDocsTopic, getModuleTopics } from "@/lib/docs/registry"

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

function headingId(heading) {
  return heading.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

function StatusLabel({ status }) {
  if (!status || status === "live") return null

  const label = status === "beta" ? "Beta" : "Planned"
  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${status === "beta" ? "bg-violet-50 text-[#5148e5]" : "bg-[#f0f0ef] text-[#777b88]"}`}>
      {label}
    </span>
  )
}

function TopicCard({ topic }) {
  const planned = topic.status === "planned"

  return (
    <Link
      href={`/docs/${topic.module}#${topic.slug}`}
      className={`group rounded-md border border-[#e7e6e7] bg-white p-4 transition-colors hover:border-[#5148e5]/30 ${planned ? "opacity-65" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-[#17192a] group-hover:text-[#5148e5]">{topic.title}</h3>
        <StatusLabel status={topic.status} />
      </div>
      <p className="mt-2 text-xs leading-5 text-[#666b7d]">{topic.summary}</p>
    </Link>
  )
}

export function DocsLandingPage() {
  return (
    <div>
      <div className="mb-7 max-w-2xl">
        <p className="text-[10px] font-bold tracking-[0.13em] text-[#5148e5]">ZERP-8 / DOCUMENTATION</p>
        <h1 className="mt-2 text-4xl font-medium tracking-[-0.06em]">Docs</h1>
        <p className="mt-3 text-sm leading-7 text-[#666b7d]">
          Find your way around ZERP-8, from the first setup to everyday operations.
        </p>
      </div>

      <section id="start-here" className="mb-7 rounded-md border border-[#e7e6e7] bg-white p-5 sm:p-6">
        <p className="text-[9px] font-bold tracking-[0.1em] text-[#898c99]">START HERE</p>
        <div className="mt-2 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Set up your workspace</h2>
            <p className="mt-1 text-xs leading-5 text-[#666b7d]">Create an account, set up a company, and invite your team.</p>
          </div>
          <Link href="/docs/getting-started" className="inline-flex shrink-0 items-center gap-2 text-xs font-semibold text-[#5148e5] hover:underline">
            Open Getting started <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      <section id="browse-modules">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">Browse modules</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {docsModules.map((module) => {
            const Icon = moduleIcons[module.icon] || BookOpen
            const planned = module.status === "planned"
            return (
              <Link
                key={module.slug}
                href={`/docs/${module.slug}`}
                className={`group rounded-md border border-[#e7e6e7] bg-white p-4 transition-colors hover:border-[#5148e5]/30 ${planned ? "opacity-65" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded bg-violet-50 text-[#5148e5]">
                    <Icon size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold group-hover:text-[#5148e5]">{module.title}</h3>
                      {planned && <StatusLabel status="planned" />}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-[#666b7d]">{module.summary}</p>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}

export function DocsModuleOverview({ moduleSlug }) {
  const module = getDocsModule(moduleSlug)
  const topics = getModuleTopics(moduleSlug)

  if (module.status === "planned") {
    return (
      <div>
        <PageIntro eyebrow={`ZERP-8 / ${module.title.toUpperCase()}`} title={module.title} summary={module.summary} />
        <section id="coming-soon" className="rounded-md border border-[#e7e6e7] bg-white p-5 sm:p-7">
          <StatusLabel status="planned" />
          <h2 className="mt-3 text-lg font-semibold">Coming soon</h2>
          <p className="mt-2 text-sm leading-6 text-[#666b7d]">{module.summary}</p>
        </section>
      </div>
    )
  }

  return (
    <div>
      <PageIntro eyebrow={`ZERP-8 / ${module.title.toUpperCase()}`} title={module.title} summary={module.summary} />
      <section id="topics">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">{moduleSlug === "faq" ? "Browse answers" : "Topics"}</h2>
        {moduleSlug === "faq" && (
          <p className="mb-4 text-xs leading-5 text-[#666b7d]">
            Short answers are grouped by module. Guides still being prepared are marked Planned.
          </p>
        )}
        {topics.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {topics.map((topic) => <TopicCard key={topic.slug} topic={topic} />)}
          </div>
        ) : (
          <p className="rounded-md border border-[#e7e6e7] bg-white p-5 text-sm text-[#666b7d]">
            Guides for this module are being prepared.
          </p>
        )}
      </section>
      {topics.length > 0 && (
        <section className="mt-8 space-y-5" aria-label={`${module.title} guides`}>
          {topics.map((topic, index) => {
            const { previous, next } = getAdjacentTopics(moduleSlug, topic.slug)
            return (
              <DocsTopicSection
                key={topic.slug}
                topic={topic}
                index={index}
                previous={previous}
                next={next}
              />
            )
          })}
        </section>
      )}
    </div>
  )
}

function PageIntro({ eyebrow, title, summary }) {
  return (
    <div className="mb-7 max-w-2xl">
      <p className="text-[10px] font-bold tracking-[0.13em] text-[#5148e5]">{eyebrow}</p>
      <h1 className="mt-2 text-3xl font-medium tracking-[-0.06em]">{title}</h1>
      <p className="mt-3 text-sm leading-7 text-[#666b7d]">{summary}</p>
    </div>
  )
}

function DocsTopicSection({ topic, index, previous, next }) {
  const module = getDocsModule(topic.module)

  return (
    <article id={topic.slug} data-doc-topic className="scroll-mt-24">
      <div className={`rounded-md border border-[#e7e6e7] bg-white p-5 sm:p-7 ${topic.status === "planned" ? "opacity-75" : ""}`}>
        <div className="flex items-start justify-between gap-4 border-b border-[#eeedf0] pb-4">
          <div>
            <p className="text-[9px] font-bold tracking-[0.1em] text-[#898c99]">
              {String(index + 1).padStart(2, "0")} / {module.title.toUpperCase()}
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">{topic.title}</h2>
            <p className="mt-1 text-xs leading-5 text-[#666b7d]">{topic.summary}</p>
          </div>
          <StatusLabel status={topic.status} />
        </div>

        {topic.status === "planned" ? (
          <section className="pt-4">
            <h3 className="text-sm font-semibold">Coming soon</h3>
            <p className="mt-1 text-xs leading-6 text-[#666b7d]">
              This guide is being prepared. Instructions will be added when the feature is ready to document.
            </p>
          </section>
        ) : (
          <div className="divide-y divide-[#eeedf0]">
            {topic.sections.map((section) => (
              <section id={`${topic.slug}-${headingId(section.heading)}`} key={section.heading} className="py-4 last:pb-0">
                <h3 className="text-sm font-semibold tracking-tight">{section.heading}</h3>
                {section.body && <p className="mt-2 text-xs leading-6 text-[#666b7d]">{section.body}</p>}
                {section.steps && (
                  <ol className="mt-3 list-decimal space-y-2 pl-5 text-xs leading-6 text-[#666b7d]">
                    {section.steps.map((step) => <li key={step}>{step}</li>)}
                  </ol>
                )}
                {section.items && (
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-xs leading-6 text-[#666b7d]">
                    {section.items.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                )}
                {section.faqs && (
                  <div className="mt-3 space-y-2">
                    {section.faqs.map(({ question, answer }) => (
                      <details key={question} className="rounded border border-[#eeedf0] px-3 py-2">
                        <summary className="cursor-pointer text-xs font-medium">{question}</summary>
                        <p className="mt-2 text-xs leading-6 text-[#666b7d]">{answer}</p>
                      </details>
                    ))}
                  </div>
                )}
                {section.table && (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#e7e6e7]">
                          {section.table.columns.map((column) => (
                            <th key={column} scope="col" className="px-3 py-2 font-semibold">{column}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {section.table.rows.map((row) => (
                          <tr key={row[0]} className="border-b border-[#eeedf0] last:border-0">
                            {row.map((cell, cellIndex) => (
                              <td key={`${row[0]}-${cellIndex}`} className="px-3 py-2.5 text-[#666b7d]">{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {section.related && (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {section.related.map((path) => {
                      const [relatedModule, relatedSlug] = path.split("/")
                      const related = getDocsTopic(relatedModule, relatedSlug)
                      return (
                        <li key={path}>
                          <Link href={`/docs/${relatedModule}#${relatedSlug}`} className="inline-flex rounded-full border border-[#e7e6e7] px-3 py-1.5 text-xs text-[#5148e5] hover:bg-[#f7f7f4]">
                            {related?.title || path.replace("/", " / ")}
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            ))}
          </div>
        )}
      </div>

      <nav aria-label={`${topic.title} previous and next topics`} className="mt-3 grid gap-3 sm:grid-cols-2">
        {previous ? <TopicDirection topic={previous} direction="previous" /> : <span />}
        {next && <TopicDirection topic={next} direction="next" />}
      </nav>
    </article>
  )
}

function TopicDirection({ topic, direction }) {
  const isPrevious = direction === "previous"

  return (
    <Link
      href={`/docs/${topic.module}#${topic.slug}`}
      className={`flex min-h-16 items-center gap-3 rounded-md border border-[#e7e6e7] bg-white p-3 text-sm transition-colors hover:border-[#5148e5]/30 ${topic.status === "planned" ? "opacity-65" : ""} ${isPrevious ? "" : "sm:justify-end sm:text-right"}`}
    >
      {isPrevious && <ArrowLeft size={15} className="shrink-0 text-[#5148e5]" />}
      <span className="min-w-0">
        <span className="block text-[9px] font-bold uppercase tracking-[0.1em] text-[#898c99]">{direction}</span>
        <span className="mt-1 block truncate font-semibold">{topic.title}</span>
      </span>
      {!isPrevious && <ArrowRight size={15} className="shrink-0 text-[#5148e5]" />}
    </Link>
  )
}

