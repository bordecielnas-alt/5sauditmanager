import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/workshops")({ component: WorkshopsPage });

function WorkshopsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["workshops-page"],
    queryFn: async () => {
      const [w, z] = await Promise.all([
        supabase.from("workshops").select("*").order("name"),
        supabase.from("zones").select("*").order("name"),
      ]);
      return { workshops: w.data ?? [], zones: z.data ?? [] };
    },
  });

  const [wName, setWName] = useState("");
  const [wManager, setWManager] = useState("");
  const [zByWorkshop, setZByWorkshop] = useState<Record<string, string>>({});

  const addW = useMutation({
    mutationFn: async () => {
      if (!wName.trim()) return;
      await supabase.from("workshops").insert({ name: wName, manager: wManager || null });
    },
    onSuccess: () => { setWName(""); setWManager(""); qc.invalidateQueries({ queryKey: ["workshops-page"] }); toast.success("Atelier ajouté"); },
  });
  const delW = useMutation({
    mutationFn: async (id: string) => { await supabase.from("workshops").delete().eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workshops-page"] }),
  });
  const addZ = useMutation({
    mutationFn: async (workshopId: string) => {
      const name = zByWorkshop[workshopId]?.trim();
      if (!name) return;
      await supabase.from("zones").insert({ name, workshop_id: workshopId });
    },
    onSuccess: (_r, wid) => { setZByWorkshop({ ...zByWorkshop, [wid]: "" }); qc.invalidateQueries({ queryKey: ["workshops-page"] }); },
  });
  const delZ = useMutation({
    mutationFn: async (id: string) => { await supabase.from("zones").delete().eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workshops-page"] }),
  });

  return (
    <AppLayout>
      <div className="p-4 md:p-8 max-w-5xl mx-auto">
        <PageHeader title="Ateliers & zones" description="Structure des ateliers audités" />

        <Card className="mb-6">
          <CardHeader><CardTitle>Nouvel atelier</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Input placeholder="Nom de l'atelier" value={wName} onChange={(e) => setWName(e.target.value)} className="max-w-xs" />
            <Input placeholder="Responsable (optionnel)" value={wManager} onChange={(e) => setWManager(e.target.value)} className="max-w-xs" />
            <Button onClick={() => addW.mutate()}><Plus className="h-4 w-4 mr-2" />Ajouter</Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {data?.workshops.map((w) => {
            const zones = data.zones.filter((z) => z.workshop_id === w.id);
            return (
              <Card key={w.id}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>{w.name}</CardTitle>
                    {w.manager && <p className="text-xs text-muted-foreground mt-1">Resp. {w.manager}</p>}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => { if (confirm("Supprimer l'atelier et toutes ses zones ?")) delW.mutate(w.id); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Zones</div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {zones.length === 0 && <span className="text-sm text-muted-foreground">Aucune zone.</span>}
                    {zones.map((z) => (
                      <span key={z.id} className="inline-flex items-center gap-2 bg-muted rounded px-2 py-1 text-sm">
                        {z.name}
                        <button className="text-muted-foreground hover:text-danger" onClick={() => delZ.mutate(z.id)}>×</button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Nouvelle zone"
                      value={zByWorkshop[w.id] ?? ""}
                      onChange={(e) => setZByWorkshop({ ...zByWorkshop, [w.id]: e.target.value })}
                      className="max-w-xs"
                    />
                    <Button size="sm" onClick={() => addZ.mutate(w.id)}>Ajouter zone</Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {data?.workshops.length === 0 && (
            <p className="text-center text-muted-foreground py-8">Commencez par créer un atelier.</p>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
