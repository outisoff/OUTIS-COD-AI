import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface InvitationData {
  email: string;
  name?: string;
  role?: string;
}

interface InvitationResponse {
  message: string;
  email: string;
  emailSent: boolean;
  requiresPasswordReset?: boolean;
  error?: string;
}

export function useSendInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: InvitationData): Promise<InvitationResponse> => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Non authentifié');
      }

      const response = await supabase.functions.invoke('send-invitation', {
        body: data,
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erreur lors de l\'envoi de l\'invitation');
      }

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      
      if (data.emailSent) {
        toast.success('Invitation envoyée', {
          description: `Un email a été envoyé à ${data.email}`,
        });
      } else if (data.requiresPasswordReset) {
        toast.success('Utilisateur créé', {
          description: `L'utilisateur ${data.email} devra utiliser "Mot de passe oublié" pour se connecter.`,
          duration: 10000,
        });
      }
    },
    onError: (error: Error) => {
      toast.error('Erreur', {
        description: error.message,
      });
    },
  });
}
