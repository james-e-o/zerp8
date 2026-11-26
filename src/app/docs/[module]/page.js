import { notFound } from "next/navigation"
import { DocsModuleOverview } from "../components/docs-content"
import { docsModules, getDocsModule } from "@/lib/docs/registry"

export function generateStaticParams() {
  return docsModules.map(({ slug }) => ({ module: slug }))
}

export async function generateMetadata({ params }) {
  const { module: moduleSlug } = await params
  const module = getDocsModule(moduleSlug)

  return module
    ? { title: `${module.title} Docs | ZERP-8`, description: module.summary }
    : { title: "Docs | ZERP-8" }
}

export default async function DocsModulePage({ params }) {
  const { module: moduleSlug } = await params

  if (!getDocsModule(moduleSlug)) notFound()

  return <DocsModuleOverview moduleSlug={moduleSlug} />
}
