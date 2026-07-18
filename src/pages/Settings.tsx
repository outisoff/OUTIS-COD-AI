import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { useIsAdmin, useUsersWithRoles, useAssignRole, useRemoveRole, useUpdateApproval, useCurrentUserRole } from '@/hooks/useUserRoles';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Moon, Sun, User, Users, Shield, Check, X, Loader2, UserPlus, Link, Trash2, Share2, Pencil, Store } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { IntegrationsTab } from '@/components/settings/IntegrationsTab';
import { SocialConnectionTab } from '@/components/settings/SocialConnectionTab';


export default function Settings() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const { data: userRole } = useCurrentUserRole();
  const { data: usersWithRoles, isLoading: usersLoading } = useUsersWithRoles();
  const assignRole = useAssignRole();
  const removeRole = useRemoveRole();
  const updateApproval = useUpdateApproval();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  // Only admin can see integrations and users tabs
  const canSeeAdminTabs = isAdmin;

  const getInitialTab = () => {
    const tab = searchParams.get('tab');
    if (tab === 'appearance') return 'appearance';
    if (tab === 'integrations' && canSeeAdminTabs) return 'integrations';
    if (tab === 'social' && canSeeAdminTabs) return 'social';
    if (tab === 'users' && canSeeAdminTabs) return 'users';
    
    return 'profile';
  };

  const [activeTab, setActiveTab] = useState(getInitialTab());
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isAdminLoading && !canSeeAdminTabs && ['integrations', 'users', 'social'].includes(activeTab)) {
      setActiveTab('profile');
    }
  }, [activeTab, canSeeAdminTabs, isAdminLoading]);

  // Invitation form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteRole, setInviteRole] = useState('none');
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<{ id: string; name: string; email: string } | null>(null);
  const [editName, setEditName] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [isSavingUser, setIsSavingUser] = useState(false);

  const handleEditUser = (userItem: any) => {
    setEditingUser({ id: userItem.id, name: userItem.full_name || '', email: userItem.email || '' });
    setEditName(userItem.full_name || '');
    setEditPassword('');
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;
    if (editPassword && editPassword.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    setIsSavingUser(true);
    try {
      // Update name
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: editName })
        .eq('id', editingUser.id);
      if (error) throw error;

      // Update password if provided
      if (editPassword) {
        const { data: pwResponse, error: pwError } = await supabase.functions.invoke('update-user-password', {
          body: { userId: editingUser.id, password: editPassword },
        });
        if (pwError) throw pwError;
        if (pwResponse?.error) throw new Error(pwResponse.error);
      }

      toast.success('Utilisateur mis à jour');
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      setEditingUser(null);
    } catch (error: any) {
      toast.error('Erreur', { description: error.message });
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer l'utilisateur ${userEmail} ?`)) {
      return;
    }

    setDeletingUserId(userId);
    try {
      const { data: response, error } = await supabase.functions.invoke('delete-user', {
        body: { userId },
      });

      if (error) throw error;
      if (response.error) throw new Error(response.error);

      toast.success('Utilisateur supprimé', {
        description: `${userEmail} a été supprimé avec succès`,
      });

      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error('Erreur', {
        description: error.message || 'Impossible de supprimer l\'utilisateur',
      });
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: fullName }
      });

      if (error) throw error;

      // Also update the profiles table
      await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', user.id);

      toast.success('Profil mis à jour avec succès');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Erreur lors de la mise à jour du profil');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRoleChange = (userId: string, role: string) => {
    if (role === 'none') {
      removeRole.mutate(userId);
    } else {
      assignRole.mutate({ userId, role: role as 'admin' | 'confirmateur' | 'stock_manager' });
    }
  };

  const handleApprovalToggle = (userId: string, newApproval: boolean) => {
    updateApproval.mutate({ userId, isApproved: newApproval });
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inviteEmail || !invitePassword) {
      toast.error('Veuillez entrer un email et un mot de passe');
      return;
    }

    if (invitePassword.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    setIsCreatingUser(true);
    try {
      const { data: response, error } = await supabase.functions.invoke('create-user-direct', {
        body: {
          email: inviteEmail,
          password: invitePassword,
          name: inviteName || undefined,
          role: inviteRole !== 'none' ? inviteRole : undefined,
        },
      });

      if (error) throw error;
      if (response.error) throw new Error(response.error);

      // Show created credentials
      setCreatedCredentials({ email: inviteEmail, password: invitePassword });
      
      toast.success('Utilisateur créé avec succès', {
        description: `${inviteEmail} peut maintenant se connecter`,
      });

      // Reset form but keep credentials visible
      setInviteEmail('');
      setInviteName('');
      setInvitePassword('');
      setInviteRole('none');

      // Refresh users list
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error('Erreur', {
        description: error.message || 'Impossible de créer l\'utilisateur',
      });
    } finally {
      setIsCreatingUser(false);
    }
  };

  const getRoleBadge = (role: string | null) => {
    if (!role) return <Badge variant="outline">Aucun</Badge>;
    if (role === 'admin') return <Badge className="bg-primary">Admin</Badge>;
    if (role === 'confirmateur') return <Badge className="bg-blue-500">Confirmateur</Badge>;
    if (role === 'stock_manager') return <Badge className="bg-amber-500">Stock Manager</Badge>;
    return <Badge variant="outline">{role}</Badge>;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">Paramètres</h1>
        <p className="page-description">
          Gérez vos préférences et paramètres de l'application.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            Profil
          </TabsTrigger>
          <TabsTrigger value="appearance" className="gap-2">
            <Sun className="h-4 w-4" />
            Apparence
          </TabsTrigger>
          {!isAdminLoading && canSeeAdminTabs && (
            <>
              <TabsTrigger value="integrations" className="gap-2">
                <Link className="h-4 w-4" />
                Intégrations
              </TabsTrigger>
              <TabsTrigger value="social" className="gap-2">
                <Share2 className="h-4 w-4" />
                Connexion Réseaux
              </TabsTrigger>
              <TabsTrigger value="users" className="gap-2">
                <Users className="h-4 w-4" />
                Utilisateurs
              </TabsTrigger>
            </>
          )}
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Informations du profil</CardTitle>
              <CardDescription>
                Mettez à jour vos informations personnelles.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  L'email ne peut pas être modifié.
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="fullName">Nom complet</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Votre nom complet"
                />
              </div>

              <Button onClick={handleSaveProfile} disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Enregistrer les modifications
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance Tab */}
        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>Apparence</CardTitle>
              <CardDescription>
                Personnalisez l'apparence de l'application.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Mode sombre</Label>
                  <p className="text-sm text-muted-foreground">
                    Activez le mode sombre pour une meilleure expérience nocturne.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Sun className="h-4 w-4 text-muted-foreground" />
                  <Switch
                    checked={theme === 'dark'}
                    onCheckedChange={toggleTheme}
                  />
                  <Moon className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations Tab - Admin Only */}
        {!isAdminLoading && canSeeAdminTabs && (
          <TabsContent value="integrations">
            <IntegrationsTab />
          </TabsContent>
        )}

        {/* Social Connection Tab - Admin Only */}
        {!isAdminLoading && canSeeAdminTabs && (
          <TabsContent value="social">
            <SocialConnectionTab />
          </TabsContent>
        )}

        {/* Users Tab - Admin Only */}
        {!isAdminLoading && canSeeAdminTabs && (
          <TabsContent value="users" className="space-y-6">
            {/* Create User Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Créer un utilisateur
                </CardTitle>
                <CardDescription>
                  Créez un compte utilisateur avec un mot de passe. Partagez les identifiants manuellement.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="inviteEmail">Email *</Label>
                      <Input
                        id="inviteEmail"
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="email@exemple.com"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="invitePassword">Mot de passe *</Label>
                      <Input
                        id="invitePassword"
                        type="text"
                        value={invitePassword}
                        onChange={(e) => setInvitePassword(e.target.value)}
                        placeholder="Min. 6 caractères"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="inviteName">Nom</Label>
                      <Input
                        id="inviteName"
                        type="text"
                        value={inviteName}
                        onChange={(e) => setInviteName(e.target.value)}
                        placeholder="Nom complet"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="inviteRole">Rôle</Label>
                      <Select value={inviteRole} onValueChange={setInviteRole}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Aucun</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="confirmateur">Confirmateur</SelectItem>
                          <SelectItem value="stock_manager">Stock Manager</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button type="submit" disabled={isCreatingUser}>
                    {isCreatingUser ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Création en cours...
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Créer l'utilisateur
                      </>
                    )}
                  </Button>
                </form>

                {/* Show created credentials */}
                {createdCredentials && (
                  <div className="mt-4 p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                    <h4 className="font-medium text-green-800 dark:text-green-200 mb-2 flex items-center gap-2">
                      <Check className="h-4 w-4" />
                      Identifiants créés
                    </h4>
                    <div className="space-y-1 text-sm">
                      <p><strong>Email:</strong> {createdCredentials.email}</p>
                      <p><strong>Mot de passe:</strong> {createdCredentials.password}</p>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-2"
                      onClick={() => setCreatedCredentials(null)}
                    >
                      Fermer
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Users Management Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Gestion des utilisateurs
                </CardTitle>
                <CardDescription>
                  Gérez les rôles et les approbations des utilisateurs.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {usersLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Utilisateur</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Rôle</TableHead>
                        <TableHead>Approuvé</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usersWithRoles?.map((userItem) => (
                        <TableRow key={userItem.id}>
                          <TableCell className="font-medium">
                            {userItem.full_name || 'Sans nom'}
                          </TableCell>
                          <TableCell>{userItem.email}</TableCell>
                          <TableCell>{getRoleBadge(userItem.role)}</TableCell>
                          <TableCell>
                            <Select
                              value={userItem.is_approved ? 'yes' : 'no'}
                              onValueChange={(value) => handleApprovalToggle(userItem.id, value === 'yes')}
                              disabled={userItem.id === user?.id}
                            >
                              <SelectTrigger 
                                className={`w-28 border-0 font-medium ${
                                  userItem.is_approved 
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                }`}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="yes">
                                  <span className="flex items-center gap-2">
                                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-white">
                                      <Check className="h-3 w-3" />
                                    </span>
                                    Approuvé
                                  </span>
                                </SelectItem>
                                <SelectItem value="no">
                                  <span className="flex items-center gap-2">
                                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white">
                                      <X className="h-3 w-3" />
                                    </span>
                                    Refusé
                                  </span>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Select
                                value={userItem.role || 'none'}
                                onValueChange={(value) => handleRoleChange(userItem.id, value)}
                                disabled={userItem.id === user?.id}
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Aucun</SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="confirmateur">Confirmateur</SelectItem>
                                  <SelectItem value="stock_manager">Stock Manager</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditUser(userItem)}
                                disabled={userItem.id === user?.id}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteUser(userItem.id, userItem.email || '')}
                                disabled={userItem.id === user?.id || deletingUserId === userItem.id}
                              >
                                {deletingUserId === userItem.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

      </Tabs>
      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier l'utilisateur</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={editingUser?.email || ''} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Nom complet</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nom complet" />
            </div>
            <div className="space-y-2">
              <Label>Nouveau mot de passe</Label>
              <Input type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="Laisser vide pour ne pas changer" />
              <p className="text-xs text-muted-foreground">Min. 6 caractères. Laisser vide pour garder le mot de passe actuel.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>Annuler</Button>
            <Button onClick={handleSaveUser} disabled={isSavingUser}>
              {isSavingUser && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
