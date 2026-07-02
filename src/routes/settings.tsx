import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const [c, q] = await Promise.all([
        supabase.from("criteria").select("*").order("order_index"),
        supabase.from("questions").select("*").order("order_index"),
      ]);
      return { criteria: c.data ?? [], questions: q.data ?? [] };
    },
  });

  const [qByCrit, setQByCrit] = useState<Record<string, string>>({});

  const addQ = useMutation({
    mutationFn: async (criteria_id: string) => {
      const text = qByCrit[criteria_id]?.trim();
      if (!text) return;
      const existing = data?.questions.filter((x) => x.criteria_id === criteria_id).length ?? 0;
      await supabase.from("questions").insert({ criteria_id, text, order_index: existing + 1 });
    },
    onSuccess: (_r, cid) => { setQByCrit({ ...qByCrit, [cid]: "" }); qc.invalidateQueries({ queryKey: ["settings"] }); },
  });
  const delQ = useMutation({
    mutationFn: async (id: string) => { await supabase.from("questions").delete().eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });

  return (
    <AppLayout>
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <PageHeader title="Paramètres" description="Critères 5S et questions d'évaluation" />
        <div className="space-y-4">
          {data?.criteria.map((c) => {
            const qs = data.questions.filter((q) => q.criteria_id === c.id);
            return (
              <Card key={c.id}>
                <CardHeader><CardTitle>{c.name}</CardTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-2 mb-3">
                    {qs.map((q) => (
                      <li key={q.id} className="flex items-center justify-between border rounded p-2">
                        <span className="text-sm">{q.text}</span>
                        <Button variant="ghost" size="sm" onClick={() => delQ.mutate(q.id)}><Trash2 className="h-4 w-4" /></Button>
                      </li>
                    ))}
                  </ul>
                  <div className="flex gap-2">
                    <Input placeholder="Nouvelle question" value={qByCrit[c.id] ?? ""} onChange={(e) => setQByCrit({ ...qByCrit, [c.id]: e.target.value })} />
                    <Button onClick={() => addQ.mutate(c.id)}><Plus className="h-4 w-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
