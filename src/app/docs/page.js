import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowLeft,
  Boxes,
  Building2,
  ClipboardList,
  PackageCheck,
  ShoppingCart,
  Store,
} from 'lucide-react'

const sections = [
  {
    id: 'getting-started',
    title: 'Getting started',
    description: 'Learn the basic structure of ZERP-8 and how to get your workspace ready.',
    icon: ClipboardList,
    topics: [
      { id: 'workspace', title: 'Your workspace', description: 'A company workspace brings your branches, shared catalogue, and day-to-day operations together.' },
      { id: 'first-steps', title: 'First steps', description: 'Set up your company and branch, invite your team, and add the products you work with.' },
    ],
  },
  {
    id: 'products',
    title: 'Products',
    description: 'Organize the items your business buys, stores, and sells.',
    icon: Boxes,
    topics: [
      { id: 'product-catalogue', title: 'Product catalogue', description: 'Keep product details and variants in a shared catalogue for consistent use across branches.' },
      { id: 'product-pricing', title: 'Product pricing', description: 'Maintain product pricing information and use it throughout your purchasing and sales workflows.' },
    ],
  },
  {
    id: 'purchasing',
    title: 'Purchasing',
    description: 'Follow purchasing activity from supplier planning through delivery.',
    icon: ShoppingCart,
    topics: [
      { id: 'suppliers', title: 'Suppliers and orders', description: 'Keep supplier records and purchase orders organized so teams can track what they expect to receive.' },
      { id: 'receiving', title: 'Receiving goods', description: 'Record delivered items, inspect quantities, and keep the stock record aligned with what arrived.' },
    ],
  },
  {
    id: 'inventory',
    title: 'Inventory',
    description: 'Understand what is on hand and how stock changes over time.',
    icon: PackageCheck,
    topics: [
      { id: 'stock-levels', title: 'Stock levels', description: 'Review stock by branch and use inventory records to understand product availability.' },
      { id: 'stock-activity', title: 'Stock activity', description: 'Trace receipts, adjustments, and movements through their operational records.' },
    ],
  },
  {
    id: 'sales',
    title: 'Sales',
    description: 'Connect customer orders with product availability and fulfilment.',
    icon: Store,
    topics: [
      { id: 'sales-orders', title: 'Sales orders', description: 'Record customer orders and follow their progress through your sales workflow.' },
      { id: 'fulfilment', title: 'Order fulfilment', description: 'Use branch stock information to guide picking and fulfilment.' },
    ],
  },
  {
    id: 'branches-and-team',
    title: 'Branches and team',
    description: 'Manage branch-level operations while keeping company information connected.',
    icon: Building2,
    topics: [
      { id: 'branches', title: 'Working across branches', description: 'Share company product information while keeping operational activity associated with each branch.' },
      { id: 'team-access', title: 'Team access', description: 'Give team members access to the operational tools and information they need.' },
    ],
  },
]

export const metadata = {
  title: 'Docs | ZERP-8',
  description: 'Guides to products, purchasing, inventory, sales, and branch operations in ZERP-8.',
}

export default function DocsPage() {
  return (
    <div className="h-svh overflow-y-auto bg-[#f7f7f4] text-[#17192a]">
      <header className="sticky top-0 z-10 border-b border-[#17192a]/[0.08] bg-[#f7f7f4]/95 backdrop-blur-md">
        <div className="mx-auto flex h-[68px] w-[calc(100%-36px)] max-w-[1120px] items-center justify-between sm:w-[calc(100%-64px)]">
          <Link href="/" aria-label="ZERP-8 home" className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Image src="/zerp8-logo.png" alt="" width={38} height={38} className="h-8 w-8 object-contain" />
            <span>ZERP-8</span>
          </Link>
          <Link href="/" className="inline-flex items-center gap-2 text-xs font-medium text-[#565a6b] hover:text-[#5148e5]">
            <ArrowLeft size={15} /> Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto w-[calc(100%-36px)] max-w-[1120px] py-10 sm:w-[calc(100%-64px)] sm:py-14">
        <div className="mb-9 max-w-2xl">
          <p className="text-[10px] font-bold tracking-[0.13em] text-[#5148e5]">ZERP-8 / DOCUMENTATION</p>
          <h1 className="mt-3 text-5xl font-medium tracking-[-0.07em]">Docs</h1>
          <p className="mt-4 text-sm leading-7 text-[#666b7d]">
            Explore how the parts of ZERP-8 fit together, from setting up your workspace to managing products, stock, and sales.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-[250px_minmax(0,1fr)] md:gap-12">
          <nav aria-label="Documentation sections" className="h-fit rounded-md border border-[#e7e6e7] bg-white p-4 md:sticky md:top-24">
            <p className="mb-3 text-[9px] font-bold tracking-[0.1em] text-[#898c99]">ON THIS PAGE</p>
            <ul className="space-y-4">
              {sections.map(({ id, title, topics }) => (
                <li key={id}>
                  <a href={`#${id}`} className="text-xs font-semibold hover:text-[#5148e5]">{title}</a>
                  <ul className="mt-2 space-y-2 border-l border-[#e7e6e7] pl-3">
                    {topics.map((topic) => (
                      <li key={topic.id}>
                        <a href={`#${topic.id}`} className="text-[11px] text-[#666b7d] hover:text-[#5148e5]">{topic.title}</a>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </nav>

          <div className="space-y-5">
            {sections.map(({ id, title, description, icon: Icon, topics }, index) => (
              <section id={id} key={id} className="scroll-mt-24 rounded-md border border-[#e7e6e7] bg-white p-5 sm:p-7">
                <div className="flex items-start gap-3 border-b border-[#eeedf0] pb-4">
                  <span className="grid size-9 shrink-0 place-items-center rounded bg-violet-50 text-[#5148e5]"><Icon size={18} /></span>
                  <div>
                    <p className="text-[9px] font-bold tracking-[0.1em] text-[#898c99]">0{index + 1} / GUIDE</p>
                    <h2 className="mt-1 text-xl font-semibold tracking-tight">{title}</h2>
                    <p className="mt-1 text-xs leading-5 text-[#666b7d]">{description}</p>
                  </div>
                </div>
                <div className="divide-y divide-[#eeedf0]">
                  {topics.map((topic) => (
                    <article id={topic.id} key={topic.id} className="scroll-mt-24 py-4 last:pb-0">
                      <h3 className="text-sm font-semibold">{topic.title}</h3>
                      <p className="mt-1 text-xs leading-6 text-[#666b7d]">{topic.description}</p>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
