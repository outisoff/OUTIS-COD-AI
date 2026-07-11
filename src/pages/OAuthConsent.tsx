import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck } from "lucide-react";

// Typed wrapper around the beta supabase.auth.oauth namespace.
type OAuthClient = { name?: string; redirect_uris?: string[] };
type OAuthDetails = {
  client?: OAuthClient;
  scope?: string;
  redirect_url?: string;
  redirect_to?: string;
};
type OAuthResult = { redirect_url?: string; redirect_to?: string };
const authOauth = (supabase.auth as unknown as {
  oauth: {
    getAuthorizationDetails: (id: string) => Promise<{ data: OAuthDetails | null; error: { message: string } | null }>;
    approveAuthorization: (id: string) => Promise<{ data: OAuthResult | null; error: { message: string } | null }>;
    denyAuthorization: (id: string) => Promise<{ data: OAuthResult | null; error: { message: string } | null }>;
  };
}).oauth;

function safeNext(): string {
  return window.location.pathname + window.location.search;
}

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<OAuthDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Requête d'autorisation invalide (authorization_id manquant).");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        window.location.href = "/login?next=" + encodeURIComponent(safeNext());
        return;
      }
      const { data, error } = await authOauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) {
        setError(error.message);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const { data, error } = approve
      ? await authOauth.approveAuthorization(authorizationId)
      : await authOauth.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("Le serveur d'autorisation n'a pas renvoyé d'URL de redirection.");
      return;
    }
    window.location.href = target;
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Autorisation impossible</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  if (!details) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </main>
    );
  }

  const clientName = details.client?.name ?? "une application";

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Connecter {clientName} à OUTIS COD</CardTitle>
          <CardDescription>
            {clientName} pourra utiliser les outils de cette application en votre nom pendant que vous êtes connecté.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border p-3 text-sm space-y-1">
            <p className="font-medium">Ce que cela autorise</p>
            <ul className="list-disc pl-5 text-muted-foreground">
              <li>Lire et modifier vos commandes, clients et stock via les outils MCP</li>
              <li>Agir avec vos permissions actuelles dans l'application</li>
            </ul>
          </div>
          <p className="text-xs text-muted-foreground">
            Cela ne contourne pas les permissions ni les règles de sécurité de l'application.
          </p>
          <div className="flex gap-2 pt-2">
            <Button onClick={() => decide(true)} disabled={busy} className="flex-1">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Approuver"}
            </Button>
            <Button onClick={() => decide(false)} disabled={busy} variant="outline" className="flex-1">
              Refuser
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
