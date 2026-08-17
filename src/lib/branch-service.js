import { createClient } from '@/config/supabaseServer';

/**
 * Get company ID by branch slug
 * @param {string} branchSlug - The branch slug from params
 * @returns {Promise<string|null>} - The company ID or null if not found
 */
export async function getCompanyIdFromBranch(branchSlug) {
  if (!branchSlug) return null;

  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('branches')
      .select('company')
      .eq('slug', branchSlug)
      .single();

    if (error || !data) {
      console.error(`Error fetching branch ${branchSlug}:`, error);
      return null;
    }

    return data.company;
  } catch (err) {
    console.error(`Error getting company from branch:`, err);
    return null;
  }
}
