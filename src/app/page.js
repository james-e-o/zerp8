import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Boxes,
  Check,
  ChevronRight,
  ClipboardCheck,
  PackageCheck,
  PackagePlus,
  ShoppingCart,
  Store,
  Waypoints,
} from 'lucide-react'
import ThemeToggle from '@/components/theme-toggle'

const workflow = [
  { number: '01', label: 'Products', detail: 'A shared catalogue', icon: Boxes },
  { number: '02', label: 'Purchasing', detail: 'Requests and orders', icon: ShoppingCart },
  { number: '03', label: 'Receiving', detail: 'Inspect what arrives', icon: PackageCheck },
  { number: '04', label: 'Inventory', detail: 'Know what is on hand', icon: Waypoints },
  { number: '05', label: 'Sales', detail: 'Fulfil with confidence', icon: Store },
]

const products = [
  { name: 'Field notebook', code: 'ST-204 · 3 variants', color: 'bg-indigo-50 text-indigo-700' },
  { name: 'Canvas tote', code: 'BG-118 · 2 variants', color: 'bg-orange-50 text-orange-800' },
  { name: 'Desk lamp', code: 'HM-042 · 4 variants', color: 'bg-emerald-50 text-emerald-800' },
]

function Brand({ inverse = false }) {
  return (
    <Link href="/" aria-label="ZERP-8 home" className={`inline-flex shrink-0 items-center gap-2 font-semibold tracking-tight ${inverse ? 'text-white' : 'text-[#17192a]'} text-lg`}>
      <Image src="/zerp8-logo.png" alt="" width={38} height={38} priority className="h-8 w-8 object-contain" />
      <span>ZERP-8</span>
    </Link>
  )
}

function ProductPreview() {
  return (
    <div aria-label="Illustrative inventory overview" className="overflow-hidden rounded-xl border border-[#e6e5e8] bg-white shadow-[0_25px_65px_rgba(34,33,67,0.11)]">
      <div className="flex h-10 items-center justify-between border-b border-[#efeff1] px-4 text-[9px] text-[#777b89]">
        <div className="flex gap-1" aria-hidden="true"><i className="size-1.5 rounded-full bg-[#eead9d]" /><i className="size-1.5 rounded-full bg-[#eacb7e]" /><i className="size-1.5 rounded-full bg-[#9ac7a3]" /></div>
        <span>Branch operations</span>
        <span className="flex items-center gap-1"><i className="size-1.5 rounded-full bg-emerald-600" /> Illustrative data</span>
      </div>
      <div className="p-4 sm:p-6">
        <div className="mb-5 flex items-end justify-between">
          <div><p className="text-[8px] font-bold tracking-widest text-[#898c99]">INVENTORY / OVERVIEW</p><h2 className="mt-1 text-lg font-semibold tracking-tight text-[#17192a]">Stock at a glance</h2></div>
          <span className="flex items-center gap-1 rounded border border-[#e9e9ee] px-2 py-1.5 text-[9px] text-[#5f6270]">This branch <ChevronRight size={13} /></span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="flex min-h-[78px] flex-col justify-center rounded border border-[#eeedf2] p-2.5"><span className="text-[8px] text-[#858895]">Active products</span><strong className="my-1 text-xl font-semibold tracking-tight">248</strong><small className="text-[8px] text-[#858895]">Across 3 categories</small></div>
          <div className="flex min-h-[78px] flex-col justify-center rounded border border-[#eeedf2] p-2.5"><span className="text-[8px] text-[#858895]">Units on hand</span><strong className="my-1 text-xl font-semibold tracking-tight">1,846</strong><small className="text-[8px] text-[#858895]">Current branch total</small></div>
          <div className="flex min-h-[78px] flex-col justify-center rounded border border-[#eeedf2] p-2.5"><span className="text-[8px] text-[#858895]">To receive</span><strong className="my-1 text-xl font-semibold tracking-tight">12 <em className="text-[9px] not-italic">items</em></strong><small className="text-[8px] text-[#858895]">Across open receipts</small></div>
        </div>
        <div className="mt-3.5 rounded border border-[#eeedf2]">
          <div className="flex justify-between border-b border-[#f0eff3] px-3 py-2.5 text-[9px]"><strong>Recent stock activity</strong><span className="text-[8px] text-[#858895]">Branch record</span></div>
          <div className="px-3">
            <div className="grid min-h-[50px] grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2 border-b border-[#f1f0f3] sm:grid-cols-[28px_minmax(0,1fr)_auto_48px]">
              <span className="grid size-7 place-items-center rounded bg-indigo-50 text-indigo-700"><PackagePlus size={16} /></span><span className="flex min-w-0 flex-col gap-0.5 text-[9px]"><b className="truncate">Goods received</b><small className="text-[8px] text-[#8b8d99]">PO-1048 · North branch</small></span><span className="rounded bg-emerald-50 px-1.5 py-1 text-[7px] text-emerald-800">Received</span><span className="hidden text-right text-[8px] text-[#8b8d99] sm:block">Today</span>
            </div>
            <div className="grid min-h-[50px] grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2 border-b border-[#f1f0f3] sm:grid-cols-[28px_minmax(0,1fr)_auto_48px]">
              <span className="grid size-7 place-items-center rounded bg-violet-50 text-violet-700"><ClipboardCheck size={16} /></span><span className="flex min-w-0 flex-col gap-0.5 text-[9px]"><b className="truncate">Stock adjusted</b><small className="text-[8px] text-[#8b8d99]">ADJ-0082 · Central branch</small></span><span className="rounded bg-violet-50 px-1.5 py-1 text-[7px] text-violet-800">Recorded</span><span className="hidden text-right text-[8px] text-[#8b8d99] sm:block">Yesterday</span>
            </div>
            <div className="grid min-h-[50px] grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[28px_minmax(0,1fr)_auto_48px]">
              <span className="grid size-7 place-items-center rounded bg-emerald-50 text-emerald-800"><ShoppingCart size={16} /></span><span className="flex min-w-0 flex-col gap-0.5 text-[9px]"><b className="truncate">Order fulfilled</b><small className="text-[8px] text-[#8b8d99]">SO-2381 · North branch</small></span><span className="rounded bg-blue-50 px-1.5 py-1 text-[7px] text-blue-800">Complete</span><span className="hidden text-right text-[8px] text-[#8b8d99] sm:block">Yesterday</span>
            </div>
          </div>
        </div>
        <div className="mt-3 flex justify-between text-[8px] text-[#989aa5]"><span>Illustrative interface</span><span>Products · Purchasing · Inventory · Sales</span></div>
      </div>
    </div>
  )
}

function FeatureVisual({ type }) {
  if (type === 'catalogue') {
    return (
      <div aria-label="Illustrative shared product catalogue" className="min-w-0 rounded-md border border-[#e9e9ed] bg-[#fbfbfd] p-4">
        <div className="flex justify-between text-[8px] font-bold tracking-widest text-[#898c99]"><span>PRODUCT CATALOGUE</span><span className="font-normal tracking-normal">Company-wide</span></div>
        {products.map((product) => (
          <div className="grid min-h-[54px] grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-2 border-b border-[#edecf0]" key={product.code}>
            <span className={`grid size-[30px] place-items-center rounded ${product.color}`}><Boxes size={16} /></span>
            <span className="flex min-w-0 flex-col gap-1"><b className="truncate text-[9px] font-semibold">{product.name}</b><small className="text-[8px] text-[#8b8d98]">{product.code}</small></span>
            <span className="flex max-w-24 items-center gap-1 text-[7px] text-emerald-800 sm:text-[8px]"><Check size={13} /> Shared catalogue</span>
          </div>
        ))}
        <p className="mt-3 text-[9px] text-[#737684]">One product definition, ready to use across branches.</p>
      </div>
    )
  }
  if (type === 'purchasing') {
    return (
      <div aria-label="Illustrative goods receiving workflow" className="min-w-0 rounded-md border border-[#e9e9ed] bg-[#fbfbfd] p-4 sm:p-5">
        <div className="flex justify-between text-[8px] font-bold tracking-widest text-[#898c99]"><span>RECEIVING</span><span className="font-normal tracking-normal text-indigo-700">PO-1048</span></div>
        <div className="mx-2 mt-5 flex items-center"><span className="grid size-6 place-items-center rounded-full bg-violet-100 text-violet-700"><Check size={13} /></span><i className="h-px flex-1 bg-[#dcdbe5]" /><span className="grid size-6 place-items-center rounded-full bg-violet-100 text-violet-700"><Check size={13} /></span><i className="h-px flex-1 bg-[#dcdbe5]" /><span className="grid size-6 place-items-center rounded-full border border-violet-200 bg-white text-[9px] text-violet-700">3</span></div>
        <div className="mb-5 mt-2 flex justify-between text-[8px] text-[#858895]"><span>Order placed</span><span>Goods arrived</span><b className="text-[#4e4b85]">Inspect and record</b></div>
        <div className="flex min-h-[58px] items-center gap-2.5 rounded border border-[#e9e8ef] bg-white px-2.5"><PackageCheck size={19} className="text-indigo-700" /><span className="flex min-w-0 flex-1 flex-col gap-1"><b className="text-[9px]">Canvas tote · Navy</b><small className="text-[8px] text-[#8b8d98]">Expected 24 units</small></span><span className="flex flex-col text-right text-[10px] font-semibold">24<small className="text-[8px] font-normal text-[#8b8d98]">counted</small></span></div>
        <div className="mt-3 flex items-center gap-2 text-[8px] text-emerald-800"><Check size={14} /> Inspection keeps the stock record clear.</div>
      </div>
    )
  }
  if (type === 'inventory') {
    const branches = [
      ['North branch', '740', 'w-[78%]'],
      ['Central branch', '612', 'w-[62%]'],
      ['West branch', '494', 'w-[49%]'],
    ]
    return (
      <div aria-label="Illustrative branch stock comparison" className="min-w-0 rounded-md border border-white/10 bg-[#24263b] p-4 sm:p-5">
        <div className="flex justify-between text-[8px] font-bold tracking-widest text-[#c7c7d4]"><span>STOCK BY BRANCH</span><span className="font-normal tracking-normal text-[#a4a5b6]">Sample view</span></div>
        {branches.map(([name, count, width]) => (
          <div className="mt-5" key={name}>
            <div className="flex justify-between text-[10px] text-[#e5e5ee]"><span>{name}</span><b className="font-semibold">{count} <small className="font-normal text-[#aeb0bf]">units</small></b></div>
            <div className="mt-2 h-1 overflow-hidden rounded bg-[#383a50]"><i className={`block h-full rounded bg-[#aaa4ff] ${width}`} /></div>
          </div>
        ))}
        <p className="mt-4 text-[8px] text-[#a9aabd]">Branch-level records, with a clear view of what is on hand.</p>
      </div>
    )
  }
  return (
    <div aria-label="Illustrative order fulfilment status" className="min-w-0 rounded-md border border-[#e9e9ed] bg-[#fbfbfd] p-4">
      <div className="flex justify-between text-[8px] font-bold tracking-widest text-[#898c99]"><span>ORDER FULFILMENT</span><span className="font-normal tracking-normal">Illustrative workflow</span></div>
      <div className="mt-5 flex min-h-[58px] items-center gap-2.5 rounded border border-[#e9e8ef] bg-white px-2.5">
        <span className="grid size-[30px] place-items-center rounded bg-violet-100 text-violet-700"><ShoppingCart size={17} /></span><span className="flex min-w-0 flex-1 flex-col gap-1"><b className="text-[9px]">Order SO-2381</b><small className="text-[8px] text-[#8b8d98]">North branch · 3 line items</small></span><span className="rounded bg-violet-50 px-1.5 py-1 text-[8px] text-violet-800">Ready to fulfil</span>
      </div>
      <div className="my-3 flex items-center gap-2 text-[8px] text-[#777b88]"><i className="ml-4 h-4 w-px bg-violet-200" />Product availability connects to branch stock.</div>
      <div className="flex min-h-10 items-center justify-between rounded border border-[#e9e8ef] bg-white px-2.5 text-[9px] text-[#646775]"><span>Available at North branch</span><b className="flex items-center gap-1 text-[8px] text-emerald-800">In stock <Check size={14} /></b></div>
    </div>
  )
}

export default function Home() {
  return (
    <div id="top" className="h-svh w-full overflow-x-hidden overflow-y-auto bg-[#f7f7f4] font-Inter text-[#17192a] antialiased">
      <header className="sticky top-0 z-20 border-b border-[#17192a]/[0.08] bg-[#f7f7f4]/95 backdrop-blur-md">
        <div className="mx-auto flex h-[68px] w-[calc(100%-36px)] max-w-[1240px] items-center justify-between sm:h-[72px] sm:w-[calc(100%-64px)]">
          <Brand />
          <nav aria-label="Main navigation" className="hidden items-center gap-8 text-[13px] font-medium text-[#565a6b] md:flex">
            <a className="transition-colors hover:text-[#5148e5]" href="#product">Product</a><a className="transition-colors hover:text-[#5148e5]" href="#solutions">Solutions</a><a className="transition-colors hover:text-[#5148e5]" href="#features">Features</a><Link className="transition-colors hover:text-[#5148e5]" href="/faqs">Resources</Link>
          </nav>
          <div className="hidden items-center gap-4 md:flex"><ThemeToggle /><Link className="text-[13px] font-medium text-[#565a6b] hover:text-[#5148e5]" href="/accounts/login">Log in</Link><Link className="inline-flex min-h-10 items-center gap-2 rounded-md bg-[#17192a] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#5148e5]" href="/accounts/signup">Get started <ArrowRight size={15} /></Link></div>
          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle />
            <details className="group relative">
              <summary aria-label="Toggle navigation menu" className="flex size-10 cursor-pointer list-none flex-col items-center justify-center gap-[5px] rounded border border-[#e0dfe5] [&::-webkit-details-marker]:hidden"><span className="h-0.5 w-4 bg-[#17192a]" /><span className="h-0.5 w-4 bg-[#17192a]" /></summary>
            <nav aria-label="Mobile navigation" className="absolute right-0 top-12 hidden w-[min(280px,calc(100vw-36px))] flex-col rounded-md border border-[#e4e3e8] bg-white p-2 shadow-xl group-open:flex">
              <a className="rounded px-3 py-3 text-xs hover:bg-[#f6f5fb]" href="#product">Product</a><a className="rounded px-3 py-3 text-xs hover:bg-[#f6f5fb]" href="#solutions">Solutions</a><a className="rounded px-3 py-3 text-xs hover:bg-[#f6f5fb]" href="#features">Features</a><Link className="rounded px-3 py-3 text-xs hover:bg-[#f6f5fb]" href="/faqs">Resources</Link><Link className="rounded px-3 py-3 text-xs hover:bg-[#f6f5fb]" href="/accounts/login">Log in</Link><Link className="mt-1 flex items-center justify-between rounded bg-[#17192a] px-3 py-3 text-xs font-semibold text-white" href="/accounts/signup">Get started <ArrowRight size={15} /></Link>
            </nav>
            </details>
          </div>
        </div>
      </header>

      <main>
        <section id="product" className="bg-[radial-gradient(ellipse_at_87%_14%,rgba(81,72,229,0.08),transparent_29%)] px-[18px] pt-12 sm:px-8 sm:pt-[72px]">
          <div className="mx-auto grid max-w-[1240px] items-center gap-9 pb-9 md:grid-cols-[0.88fr_1.12fr] md:gap-12 md:pb-16">
            <div className="max-w-[520px]">
              <p className="flex items-center gap-2 text-[10px] font-bold tracking-[0.13em] text-[#5148e5]"><span className="size-1.5 rounded-full bg-[#5148e5]" /> BUSINESS OPERATIONS, CONNECTED</p>
              <h1 className="my-5 text-[clamp(46px,8vw,75px)] font-medium leading-[0.99] tracking-[-0.075em]">Run your business from <span className="text-[#5148e5]">one connected system.</span></h1>
              <p className="max-w-[470px] text-sm leading-7 text-[#666b7d] sm:text-[15px]">Bring products, purchasing, inventory, and sales together in one platform designed to help your business stay organized as it grows across branches.</p>
              <div className="mt-7 flex flex-wrap items-center gap-5">
                <Link className="inline-flex min-h-12 items-center gap-2.5 rounded-md bg-[#5148e5] px-5 text-[13px] font-semibold text-white transition hover:-translate-y-px hover:bg-[#4038cc]" href="/accounts/signup">Get started <ArrowRight size={16} /></Link>
                <a className="inline-flex items-center gap-2.5 text-[13px] font-semibold hover:text-[#5148e5]" href="#solutions">Explore the platform <ArrowDownRight size={16} /></a>
              </div>
              <p className="mt-4 text-[11px] text-[#8b8e9b]">For the day-to-day work behind every sale.</p>
            </div>
            <ProductPreview />
          </div>
          <div className="mx-auto flex h-[51px] max-w-[1240px] items-center gap-2 border-t border-[#e7e7e2] text-[7px] font-semibold tracking-wide text-[#7d8090] sm:gap-4 sm:text-[9px]">
            <span className="text-[#5148e5]">01</span><span>PRODUCTS</span><i className="size-1 rounded-full bg-[#c8c8d0]" /><span>PURCHASING</span><i className="size-1 rounded-full bg-[#c8c8d0]" /><span>INVENTORY</span><i className="size-1 rounded-full bg-[#c8c8d0]" /><span>SALES</span><ArrowDownRight className="ml-auto text-[#5148e5]" size={15} />
          </div>
        </section>

        <section aria-label="Platform capabilities" className="grid gap-3 border-b border-[#e7e7e2] bg-white px-[18px] py-5 sm:px-8 md:grid-cols-[0.65fr_1.5fr] md:items-center md:gap-6 md:px-[max(32px,calc((100%-1240px)/2))]">
          <p className="m-0 text-[9px] font-bold tracking-[0.1em] text-[#878b98]">MADE FOR THE WAY BUSINESS MOVES</p>
          <div className="flex flex-wrap justify-between gap-x-5 gap-y-3 text-[10px] font-medium text-[#464a5a] sm:text-[11px]"><span>One connected commerce workflow</span><span>Multi-branch operations</span><span>Clear stock records</span><span>Purchasing through fulfilment</span></div>
        </section>

        <section id="solutions" className="mx-auto w-[calc(100%-36px)] max-w-[1120px] py-[76px] sm:w-[calc(100%-64px)] sm:py-[105px]">
          <p className="text-[9px] font-bold tracking-[0.11em] text-[#8a8d98]">01 / THE CHALLENGE</p>
          <div className="mt-6 grid gap-6 md:grid-cols-[1fr_0.88fr] md:gap-20">
            <h2 className="m-0 text-[clamp(37px,7vw,58px)] font-medium leading-[1.04] tracking-[-0.07em]">When the records are scattered, <span className="text-[#5148e5]">the work gets harder.</span></h2>
            <div>
              <p className="m-0 text-[13px] leading-7 text-[#666b7d] sm:text-sm">Purchasing, receiving, and stock often live in different places. As operations grow, it becomes harder to see what arrived, where it went, and what is available to sell.</p>
              <div className="mt-6 border-t border-[#dedfe3]">
                {['Purchase plans that don’t line up with stock records', 'Branch stock that is difficult to compare', 'Goods received without a clear inspection trail'].map((text, index) => <div className="grid min-h-[51px] grid-cols-[30px_1fr_18px] items-center gap-2 border-b border-[#dedfe3]" key={text}><span className="text-[9px] font-bold text-[#5148e5]">0{index + 1}</span><p className="m-0 text-[11px] text-[#4e5261]">{text}</p><ArrowUpRight size={16} className="text-[#999ba6]" /></div>)}
              </div>
            </div>
          </div>
        </section>

        <section id="workflow" className="mx-auto w-[calc(100%-36px)] max-w-[1120px] pb-[76px] sm:w-[calc(100%-64px)] sm:pb-[112px]">
          <div className="grid gap-5 md:grid-cols-[0.7fr_1fr] md:gap-10">
            <p className="text-[9px] font-bold tracking-[0.11em] text-[#8a8d98]">02 / THE CONNECTED WORKFLOW</p>
            <div><h2 className="m-0 text-[clamp(37px,7vw,58px)] font-medium leading-[1.04] tracking-[-0.07em]">One flow. <span className="text-[#5148e5]">Fewer gaps.</span></h2><p className="mt-4 max-w-[460px] text-[13px] leading-7 text-[#666b7d]">Each step connects to the next, giving your team a consistent view of products as they move through the business.</p></div>
          </div>
          <div aria-label="Products to purchasing to receiving to inventory to sales" className="mt-7 grid grid-cols-1 border-y border-[#dfe0e4] sm:mt-12 sm:grid-cols-5">
            {workflow.map(({ number, label, detail, icon: Icon }, index) => <div className={`relative grid min-h-[78px] grid-cols-[38px_25px_minmax(0,0.8fr)_minmax(0,1fr)] items-center gap-2 border-b border-[#dfe0e4] py-3 sm:flex sm:min-h-[170px] sm:flex-col sm:items-start sm:justify-center sm:border-b-0 sm:border-r sm:px-3 sm:py-5 md:px-5 ${index === 0 ? 'sm:pl-0' : ''} ${index === workflow.length - 1 ? 'border-b-0 sm:border-r-0' : ''}`} key={label}>
              <span className="grid size-9 place-items-center rounded-lg border border-[#e4e3ed] bg-white text-[#5148e5]"><Icon size={20} strokeWidth={1.7} /></span><span className="text-[9px] text-[#9a9ca7] sm:absolute sm:right-4 sm:top-5">{number}</span><strong className="text-xs font-semibold sm:mt-4 sm:text-[13px]">{label}</strong><small className="text-right text-[9px] text-[#777b88] sm:text-left sm:text-[10px]">{detail}</small>
              {index < workflow.length - 1 && <ArrowRight className="hidden text-[#5148e5] sm:absolute sm:right-[-9px] sm:top-1/2 sm:block sm:bg-[#f7f7f4]" size={17} />}
            </div>)}
          </div>
        </section>

        <section id="features" className="mx-auto w-[calc(100%-36px)] max-w-[1120px] pb-[76px] sm:w-[calc(100%-64px)] sm:pb-[107px]">
          <div className="mb-7 grid gap-5 md:mb-10 md:grid-cols-[0.7fr_1fr] md:gap-10">
            <p className="text-[9px] font-bold tracking-[0.11em] text-[#8a8d98]">03 / THE PLATFORM</p>
            <div><h2 className="m-0 text-[clamp(37px,7vw,58px)] font-medium leading-[1.04] tracking-[-0.07em]">Built around the work <span className="text-[#5148e5]">that keeps business moving.</span></h2><p className="mt-4 max-w-[460px] text-[13px] leading-7 text-[#666b7d]">Practical tools for the connected commerce operations your team runs every day.</p></div>
          </div>
          <article className="mb-3 grid items-center gap-6 rounded-lg border border-[#e7e6e7] bg-white p-5 sm:p-8 md:grid-cols-[0.82fr_1fr] md:gap-12 md:p-12">
            <div><span className="text-[9px] font-bold tracking-[0.1em] text-[#5148e5]">01 — PRODUCTS</span><h3 className="mt-4 text-[27px] font-medium leading-tight tracking-[-0.055em] sm:text-[34px]">A catalogue your whole company can work from.</h3><p className="mt-3 text-xs leading-6 text-[#666b7d]">Keep product information and variants organized, with shared definitions that support work across branches.</p><a className="mt-5 inline-flex items-center gap-2 text-[11px] font-semibold hover:text-[#5148e5]" href="#multi-branch">Explore shared products <ArrowRight size={15} /></a></div>
            <FeatureVisual type="catalogue" />
          </article>
          <article className="mb-3 grid items-center gap-6 rounded-lg border border-[#22243a] bg-[#1b1d30] p-5 text-white sm:p-8 md:grid-cols-[0.82fr_1fr] md:gap-12 md:p-12">
            <div><span className="text-[9px] font-bold tracking-[0.1em] text-[#aaa4ff]">02 — INVENTORY</span><h3 className="mt-4 text-[27px] font-medium leading-tight tracking-[-0.055em] sm:text-[34px]">See stock as it moves.</h3><p className="mt-3 text-xs leading-6 text-[#c0c1ce]">Keep branch and warehouse stock visible, with traceable records of receipts, adjustments, and movements.</p><a className="mt-5 inline-flex items-center gap-2 text-[11px] font-semibold text-[#d3d0ff] hover:text-white" href="#control">A clearer stock record <ArrowRight size={15} /></a></div>
            <FeatureVisual type="inventory" />
          </article>
          <article className="mb-3 grid items-center gap-6 rounded-lg border border-[#e7e6e7] bg-white p-5 sm:p-8 md:grid-cols-[0.82fr_1fr] md:gap-12 md:p-12">
            <div><span className="text-[9px] font-bold tracking-[0.1em] text-[#5148e5]">03 — PURCHASING</span><h3 className="mt-4 text-[27px] font-medium leading-tight tracking-[-0.055em] sm:text-[34px]">Follow an order from request to receipt.</h3><p className="mt-3 text-xs leading-6 text-[#666b7d]">Coordinate purchase requests, orders, supplier deliveries, and goods inspection in a connected workflow.</p><a className="mt-5 inline-flex items-center gap-2 text-[11px] font-semibold hover:text-[#5148e5]" href="#workflow">See how the workflow connects <ArrowRight size={15} /></a></div>
            <FeatureVisual type="purchasing" />
          </article>
          <article className="grid items-center gap-6 rounded-lg border border-[#e7e6e7] bg-white p-5 sm:p-8 md:grid-cols-[0.82fr_1fr] md:gap-12 md:p-12">
            <div><span className="text-[9px] font-bold tracking-[0.1em] text-[#5148e5]">04 — SALES</span><h3 className="mt-4 text-[27px] font-medium leading-tight tracking-[-0.055em] sm:text-[34px]">Make availability part of the conversation.</h3><p className="mt-3 text-xs leading-6 text-[#666b7d]">Connect sales activity with product and inventory information to support fulfilment across your operation.</p><a className="mt-5 inline-flex items-center gap-2 text-[11px] font-semibold hover:text-[#5148e5]" href="#control">Bring operations into view <ArrowRight size={15} /></a></div>
            <FeatureVisual type="sales" />
          </article>
        </section>

        <section id="multi-branch" className="mx-auto w-[calc(100%-36px)] max-w-[1120px] pb-[78px] sm:w-[calc(100%-64px)] sm:pb-[110px]">
          <p className="text-[9px] font-bold tracking-[0.11em] text-[#8a8d98]">04 / BUILT TO GROW WITH YOU</p>
          <div className="mt-6 grid items-center gap-8 md:grid-cols-[0.9fr_1fr] md:gap-20">
            <div><p className="flex items-center gap-2 text-[10px] font-bold tracking-[0.13em] text-[#5148e5]"><span className="size-1.5 rounded-full bg-[#5148e5]" /> MULTI-BRANCH OPERATIONS</p><h2 className="mt-5 text-[clamp(37px,7vw,58px)] font-medium leading-[1.04] tracking-[-0.07em]">One company view. <span className="text-[#5148e5]">Every branch in context.</span></h2><p className="mt-5 text-[13px] leading-7 text-[#666b7d]">Keep shared product information consistent while managing stock and operational activity branch by branch. See the structure of your business without losing the detail each location needs.</p><Link className="mt-6 inline-flex items-center gap-2 text-[12px] font-semibold hover:text-[#5148e5]" href="/accounts/signup">See what connected operations can look like <ArrowRight size={16} /></Link></div>
            <div aria-label="Illustration of shared company products across three branches" className="rounded-md border border-[#e3e3e6] bg-white p-4 sm:p-6">
              <div className="flex min-h-[61px] items-center gap-2.5 rounded border border-[#e5e4ef] bg-[#fbfaff] px-3"><span className="grid size-8 place-items-center rounded bg-violet-100 text-violet-700"><Store size={17} /></span><span className="flex flex-col gap-1"><b className="text-[9px] font-semibold">Company workspace</b><small className="text-[8px] text-[#858895]">Shared product catalogue</small></span><span className="ml-auto text-[7px] font-bold tracking-widest text-[#777a8b]">COMPANY</span></div>
              <div className="grid h-9 grid-cols-3 justify-items-center"><i className="h-full w-px bg-[#d7d5e8]" /><i className="h-full w-px bg-[#d7d5e8]" /><i className="h-full w-px bg-[#d7d5e8]" /></div>
              <div className="grid grid-cols-3 gap-2">{[['North', 'bg-[#7069d3]'], ['Central', 'bg-[#5c9d77]'], ['West', 'bg-[#d29968]']].map(([name, color]) => <div className="flex min-h-[82px] flex-col justify-center gap-1.5 rounded border border-[#e9e9ed] px-2.5" key={name}><span className={`size-1.5 rounded-full ${color}`} /><b className="text-[9px] font-semibold">{name}</b><small className="text-[8px] text-[#858895]">Branch operations</small></div>)}</div>
              <p className="mt-3 text-center text-[8px] text-[#92949e]">Illustration · shared catalogue, branch-level operations</p>
            </div>
          </div>
        </section>

        <section id="control" className="mx-auto w-[calc(100%-36px)] max-w-[1120px] border-t border-[#e7e7e2] py-[33px] sm:w-[calc(100%-64px)] sm:py-11">
          <p className="text-[9px] font-bold tracking-[0.11em] text-[#8a8d98]">05 / OPERATIONAL CONTROL</p>
          <div className="mt-6 grid gap-6 md:grid-cols-[1fr_0.85fr] md:gap-20">
            <div><h2 className="text-[clamp(37px,7vw,58px)] font-medium leading-[1.04] tracking-[-0.07em]">Know what happened. <span className="text-[#5148e5]">Know where to look next.</span></h2><p className="mt-4 max-w-[440px] text-[13px] leading-7 text-[#666b7d]">Clear operational records help teams stay aligned as goods are ordered, received, moved, and fulfilled.</p></div>
            <div className="border-t border-[#dedfe3]">{[['Traceable stock activity', 'Keep a record of inventory changes and movements.'], ['Structured receiving', 'Record what arrived and inspect goods before acceptance.'], ['Role-based access', 'Give teams access to the operational tools they need.']].map(([title, detail]) => <div className="flex min-h-[72px] items-center gap-3 border-b border-[#dedfe3]" key={title}><span className="grid size-6 shrink-0 place-items-center rounded-full bg-violet-100 text-violet-700"><Check size={16} /></span><p className="flex flex-col gap-1"><b className="text-[11px] font-semibold">{title}</b><small className="text-[9px] text-[#777b88]">{detail}</small></p></div>)}</div>
          </div>
        </section>

        <section className="bg-[#1b1d30] px-[18px] py-12 text-white sm:px-8 sm:py-16">
          <div className="mx-auto flex max-w-[1120px] flex-col items-start justify-between gap-7 md:flex-row md:items-center">
            <div><p className="flex items-center gap-2 text-[10px] font-bold tracking-[0.13em] text-[#b6b1ff]"><span className="size-1.5 rounded-full bg-[#b6b1ff]" /> A MORE CONNECTED WAY TO WORK</p><h2 className="mt-5 max-w-[620px] text-[clamp(37px,7vw,55px)] font-medium leading-[1.05] tracking-[-0.07em]">Bring your business operations together.</h2><p className="mt-3 max-w-[520px] text-[13px] leading-6 text-[#c4c5d0]">Manage the flow of products, purchasing, inventory, and sales through one connected platform.</p></div>
            <div className="flex min-w-[215px] flex-col items-start gap-4"><Link className="inline-flex min-h-12 items-center gap-2.5 rounded bg-white px-4 text-xs font-semibold text-[#1b1d30] transition hover:-translate-y-px hover:bg-violet-100" href="/accounts/signup">Get started <ArrowRight size={16} /></Link><Link className="inline-flex items-center gap-2 text-[10px] text-[#d6d5e2] hover:text-white" href="/accounts/login">Already have an account? Log in <ArrowUpRight size={15} /></Link></div>
          </div>
        </section>
      </main>

      <footer className="bg-[#151728] px-[18px] pt-8 text-white sm:px-8">
        <div className="mx-auto flex max-w-[1120px] flex-col justify-between gap-8 pb-8 md:flex-row md:gap-14">
          <div className="max-w-[225px]"><Brand inverse /><p className="mt-3 text-[10px] leading-5 text-[#a8a9b5]">Connected tools for the day-to-day work of growing businesses.</p></div>
          <div className="flex justify-between gap-5 sm:gap-12 md:gap-20">
            <div className="flex flex-col gap-2.5 text-[9px]"><strong className="mb-1 text-[10px]">Explore</strong><a className="text-[#a8a9b5] hover:text-white" href="#product">Product</a><a className="text-[#a8a9b5] hover:text-white" href="#solutions">Solutions</a><a className="text-[#a8a9b5] hover:text-white" href="#features">Features</a></div>
            <div className="flex flex-col gap-2.5 text-[9px]"><strong className="mb-1 text-[10px]">Resources</strong><Link className="text-[#a8a9b5] hover:text-white" href="/about">About ZERP-8</Link><Link className="text-[#a8a9b5] hover:text-white" href="/faqs">FAQs</Link><Link className="text-[#a8a9b5] hover:text-white" href="/pricing">Pricing</Link></div>
            <div className="flex flex-col gap-2.5 text-[9px]"><strong className="mb-1 text-[10px]">Account</strong><Link className="text-[#a8a9b5] hover:text-white" href="/accounts/login">Log in</Link><Link className="text-[#a8a9b5] hover:text-white" href="/accounts/signup">Get started</Link></div>
          </div>
        </div>
        <div className="mx-auto flex min-h-[43px] max-w-[1120px] items-center justify-between border-t border-white/10 text-[9px] text-[#9698a7]"><span>© {new Date().getFullYear()} ZERP-8. All rights reserved.</span><a className="inline-flex items-center gap-1.5 text-[#c9c9d3] hover:text-white" href="#top">Back to top <ArrowUpRight size={14} /></a></div>
      </footer>
    </div>
  )
}
