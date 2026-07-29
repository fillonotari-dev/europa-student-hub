import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type State =
  | { kind: "loading" }
  | { kind: "invalid" }
  | { kind: "already" }
  | { kind: "ready" }
  | { kind: "submitting" }
  | { kind: "done" }
  | { kind: "error"; message: string };

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (!token) {
      setState({ kind: "invalid" });
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_ANON } },
        );
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.valid) setState({ kind: "ready" });
        else if (data?.reason === "already_unsubscribed") setState({ kind: "already" });
        else setState({ kind: "invalid" });
      } catch {
        setState({ kind: "error", message: "Errore di rete. Riprova più tardi." });
      }
    })();
  }, [token]);

  async function confirm() {
    setState({ kind: "submitting" });
    try {
      const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
        body: { token },
      });
      if (error) throw error;
      if (data?.success) setState({ kind: "done" });
      else if (data?.reason === "already_unsubscribed") setState({ kind: "already" });
      else setState({ kind: "error", message: "Non è stato possibile completare l'operazione." });
    } catch (e: any) {
      setState({ kind: "error", message: e?.message ?? "Errore imprevisto." });
    }
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Disiscrizione dalle email</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {state.kind === "loading" && <p className="text-sm text-muted-foreground">Verifica del link…</p>}
          {state.kind === "invalid" && (
            <p className="text-sm text-muted-foreground">
              Il link non è valido o è scaduto. Se hai ricevuto un'email di recente, apri il link più recente.
            </p>
          )}
          {state.kind === "already" && (
            <p className="text-sm">Questo indirizzo è già stato disiscritto. Non riceverai più email da noi.</p>
          )}
          {state.kind === "ready" && (
            <>
              <p className="text-sm">
                Confermi di volerti disiscrivere dalle comunicazioni via email di Studentato Europa?
              </p>
              <Button onClick={confirm} className="w-full">Conferma disiscrizione</Button>
            </>
          )}
          {state.kind === "submitting" && (
            <p className="text-sm text-muted-foreground">Elaborazione in corso…</p>
          )}
          {state.kind === "done" && (
            <p className="text-sm">Fatto. Il tuo indirizzo è stato rimosso dalle nostre comunicazioni.</p>
          )}
          {state.kind === "error" && (
            <p className="text-sm text-destructive">{state.message}</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}