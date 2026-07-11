import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type AppRole = 'admin' | 'confirmateur' | 'stock_manager';

interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

interface UserWithRole {
  id: string;
  email: string | null;
  full_name: string | null;
  is_approved: boolean | null;
  created_at: string;
  role: AppRole | null;
}

export function useCurrentUserRole() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-role', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // Read the caller's own row directly; user_roles RLS allows users to read their own role.
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user role:', error);
        return null;
      }

      return (data?.role as AppRole | null) ?? null;
    },
    enabled: !!user?.id,
  });
}

export function useIsAdmin() {
  const { data: role, isLoading } = useCurrentUserRole();
  return { isAdmin: role === 'admin', isLoading };
}

export function useUsersWithRoles() {
  return useQuery({
    queryKey: ['users-with-roles'],
    queryFn: async () => {
      // Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch all roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (rolesError) throw rolesError;

      // Combine profiles with roles
      const usersWithRoles: UserWithRole[] = (profiles || []).map(profile => {
        const userRole = roles?.find(r => r.user_id === profile.id);
        return {
          ...profile,
          role: userRole?.role as AppRole | null,
        };
      });

      return usersWithRoles;
    },
  });
}

export function useAssignRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      // First, delete any existing role for this user
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      // Then insert the new role
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      queryClient.invalidateQueries({ queryKey: ['user-role'] });
      toast.success('Rôle assigné avec succès');
    },
    onError: (error) => {
      console.error('Error assigning role:', error);
      toast.error('Erreur lors de l\'assignation du rôle');
    },
  });
}

export function useRemoveRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      queryClient.invalidateQueries({ queryKey: ['user-role'] });
      toast.success('Rôle supprimé avec succès');
    },
    onError: (error) => {
      console.error('Error removing role:', error);
      toast.error('Erreur lors de la suppression du rôle');
    },
  });
}

export function useUpdateApproval() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, isApproved }: { userId: string; isApproved: boolean }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ is_approved: isApproved })
        .eq('id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      toast.success('Statut d\'approbation mis à jour');
    },
    onError: (error) => {
      console.error('Error updating approval:', error);
      toast.error('Erreur lors de la mise à jour du statut');
    },
  });
}
