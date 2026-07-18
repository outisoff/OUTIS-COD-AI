import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ProfileData {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface RoleData {
  user_id: string;
  role: string;
}

/**
 * Shared hook that fetches all profiles and user_roles once,
 * cached globally to avoid redundant API calls across components.
 */
export function useProfilesAndRoles() {
  const { data, isLoading } = useQuery({
    queryKey: ['all-profiles-and-roles'],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email'),
        supabase.from('user_roles').select('user_id, role'),
      ]);

      const profileMap: Record<string, string> = {};
      const roleMap: Record<string, string> = {};

      profiles?.forEach((p: ProfileData) => {
        profileMap[p.id] = (p.full_name && !p.full_name.includes('@') ? p.full_name : p.email?.split('@')[0]) || 'Utilisateur';
      });
      roles?.forEach((r: RoleData) => {
        roleMap[r.user_id] = r.role;
      });

      return { profileMap, roleMap };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
  });

  return {
    profileMap: data?.profileMap || {},
    roleMap: data?.roleMap || {},
    isLoading,
  };
}
