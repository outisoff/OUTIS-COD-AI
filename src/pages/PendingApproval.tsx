import { Clock, LogOut, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";

const PendingApproval = () => {
  const { logout, user } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted p-4">
      <h1 className="sr-only">Compte en attente d'approbation</h1>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <Clock className="h-8 w-8 text-amber-600" />
          </div>
          <CardTitle className="text-2xl">Compte en attente d'approbation</CardTitle>
          <CardDescription className="text-base">
            Votre compte a été créé avec succès, mais il doit être approuvé par un administrateur avant que vous puissiez accéder à l'application.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4" />
              <span>{user?.email}</span>
            </div>
          </div>
          
          <div className="text-center text-sm text-muted-foreground">
            <p>Vous recevrez un e-mail une fois votre compte approuvé.</p>
            <p className="mt-2">En cas de questions, contactez votre administrateur.</p>
          </div>

          <Button 
            variant="outline" 
            className="w-full" 
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Se déconnecter
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default PendingApproval;
