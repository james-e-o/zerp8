// app/users/[u]/PageLayout.jsx
import { redirect } from 'next/navigation'
import PageLayoutProvider from './pageLayoutProvider'
import { createSupabaseServerClient } from '@/config/supabaseServer'

const PageLayout = async ({ children, params }) => {
  const { u } = await params
  const supabase = await createSupabaseServerClient()

  // Get authenticated user (server-side session check replaces the old
  // localStorage login_timestamp check, which can't run on the server anyway)
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (!user || authError) {
    redirect('/accounts/login')
  }

  // Fetch user profile — sourced from `users`, see note above re: `profile` table
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || profileError) {
    redirect('/accounts/login')
  }

  // Validate route param matches the user's handle
  if (u !== profile.handle) {
    redirect(`/users/${profile.handle}`)
  }

  // --- Single source of truth for companies: owned + staff, fetched once, here. ---

  // Companies the user owns
  const { data: owned, error: ownedError } = await supabase
    .from('companies')
    .select('id, name, slug, logo, created_at')
    .eq('owner', user.id)

  if (ownedError) console.error('PageLayout: owned companies fetch failed', ownedError)

  // Companies where the user is staff (role/access_level carried through for the sidebar badge)
  const { data: staffRows, error: staffError } = await supabase
    .from('staff')
    .select('company, status, role, access_level')
    .eq('user', user.id)

  if (staffError) console.error('PageLayout: staff rows fetch failed', staffError)

  const activeStaffRows = (staffRows || []).filter(r => r.status !== 'suspended')
  const staffCompanyIds = activeStaffRows.map(r => r.company)

  let staffCompanies = []
  if (staffCompanyIds.length > 0) {
    const { data: staffCompaniesData, error: staffCompaniesError } = await supabase
      .from('companies')
      .select('id, name, slug, logo, created_at')
      .in('id', staffCompanyIds)

    if (staffCompaniesError) {
      console.error('PageLayout: staff companies fetch failed', staffCompaniesError)
    } else {
      const rowByCompanyId = Object.fromEntries(
        activeStaffRows.map(r => [r.company, r])
      )
      staffCompanies = (staffCompaniesData || []).map(c => ({
        ...c,
        badge: 'staff',
        role: rowByCompanyId[c.id]?.role ?? null,
        accessLevel: rowByCompanyId[c.id]?.access_level ?? null,
      }))
    }
  }

  const ownedCompanies = (owned || []).map(c => ({ ...c, badge: 'owner' }))

  const data = {
    profile,
    companies: [...ownedCompanies, ...staffCompanies],
  }

  return (
    <PageLayoutProvider data={data}>
      {children}
    </PageLayoutProvider>
  )
}

export default PageLayout