import DocsShell from "./components/docs-shell"

export const metadata = {
  title: "Docs | ZERP-8",
  description: "Guides to setting up and using ZERP-8.",
}

export default function DocsLayout({ children }) {
  return <DocsShell>{children}</DocsShell>
}
