import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getAuthErrorMessage } from '@/lib/errorMessages';
import { isRateLimited, recordAttempt, getRemainingAttempts, getBackoffDelay } from '@/lib/rateLimit';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [rateLimitInfo, setRateLimitInfo] = useState({ isLimited: false, remainingTime: 0 });
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  // Preserve same-origin relative `next` param through login (used by OAuth consent).
  const rawNext = searchParams.get('next');
  const nextPath = rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : null;

  // Check rate limit status periodically
  useEffect(() => {
    const checkRateLimit = () => {
      const loginLimit = isRateLimited('auth:login');
      setRateLimitInfo({
        isLimited: loginLimit.isLimited,
        remainingTime: loginLimit.remainingTime,
      });
    };
    
    checkRateLimit();
    const interval = setInterval(checkRateLimit, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check rate limit before attempting login
    const { isLimited, remainingTime } = isRateLimited('auth:login');
    if (isLimited) {
      toast({
        title: 'Trop de tentatives',
        description: `Veuillez réessayer dans ${remainingTime} secondes`,
        variant: 'destructive',
      });
      return;
    }
    
    // Apply backoff delay
    const backoffDelay = getBackoffDelay('auth:login');
    if (backoffDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
    
    setIsLoading(true);
    
    try {
      await login(email, password);
      recordAttempt('auth:login', true);
      if (nextPath) {
        window.location.href = nextPath;
      } else {
        navigate('/dashboard');
      }
    } catch (error: unknown) {
      recordAttempt('auth:login', false);
      const remaining = getRemainingAttempts('auth:login');
      toast({
        title: 'Erreur de connexion',
        description: remaining > 0 
          ? `${getAuthErrorMessage(error)} (${remaining} tentatives restantes)`
          : getAuthErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mb-4">
            <Package className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">OUTIS COD — Système de gestion e-commerce</h1>
          <h2 className="sr-only">Connexion</h2>
          <p className="text-foreground/80 text-sm mt-1">
            Système de gestion e-commerce
          </p>
        </div>

        {/* Auth Card */}
        <Card className="border-border shadow-lg">
          <CardHeader className="text-center">
            <CardTitle>Connexion</CardTitle>
            <CardDescription className="text-foreground/80">
              Connectez-vous à votre compte
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="votre@email.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-password">Mot de passe</Label>
                <Input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading || rateLimitInfo.isLimited}>
                {rateLimitInfo.isLimited ? (
                  `Réessayez dans ${rateLimitInfo.remainingTime}s`
                ) : isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connexion...
                  </>
                ) : (
                  'Se connecter'
                )}
              </Button>
            </form>

            <p className="text-center text-sm text-foreground/80 mt-4">
              Contactez un administrateur pour obtenir un accès.
            </p>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-foreground/70">
          © 2026 OUTIS COD. Tous droits réservés.
        </p>
      </div>
    </main>
  );
}
