import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/machines")({ component: MachinesPage });

function MachinesPage() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["machines-page"],
    queryFn: async () => {
      const [m, z, w] = await Promise.all([
        supabase.from("machines").select("*").order("name"),
        supabase.from("zones").select("*"),
        supabase.from("workshops").select("*"),
      ]);
      return { machines: m.data ?? [], zones: z.data ?? [], workshops: w.data ?? [] };
    },
  });

  const [form, setForm] = useState({ name: "", code: "", zone_id: "", status: "active" });

  const add = useMutation({
    mutationFn: async () => {
      if (!form.name || !form.zone_id) return;
      await supabase.from("machines").insert(form);
    },
    onSuccess: () => { setForm({ name: "", code: "", zone_id: "", status: "active" }); qc.invalidateQueries({ queryKey: ["machines-page"] }); },
  });
  const del = useMutation({
    mutationFn: async (id: string) => { await supabase.from("machines").delete().eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["machines-page"] }),
  });

  return (
    <AppLayout>
      <div className="p-4 md:p-8 max-w-6xl mx-auto">
        <PageHeader title="Machines" description="Inventaire des machines par zone" />

        <Card className="mb-6">
          <CardContent className="p-4 grid gap-2 md:grid-cols-5">
            <Input placeholder="Nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input placeholder="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            <Select value={form.zone_id} onValueChange={(v) => setForm({ ...form, zone_id: v })}>
              <SelectTrigger><SelectValue placeholder="Zone" /></SelectTrigger>
              <SelectContent>
                {data?.zones.map((z) => {
                  const w = data.workshops.find((x) => x.id === z.workshop_id);
                  return <SelectItem key={z.id} value={z.id}>{w?.name} → {z.name}</SelectItem>;
                })}
              </SelectContent>
            </Select>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Actif</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="inactive">Inactif</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => add.mutate()}><Plus className="h-4 w-4 mr-2" />Ajouter</Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted text-muted-foreground">
                <tr><th className="text-left p-3">Nom</th><th className="text-left p-3">Code</th><th className="text-left p-3">Zone</th><th className="text-left p-3">État</th><th /></tr>
              </thead>
              <tbody>
                {data?.machines.map((m) => {
                  const z = data.zones.find((x) => x.id === m.zone_id);
                  const w = data.workshops.find((x) => x.id === z?.workshop_id);
                  return (
                    <tr key={m.id} className="border-t hover:bg-muted/50">
                      <td className="p-3 font-medium">{m.name}</td>
                      <td className="p-3 text-muted-foreground">{m.code}</td>
                      <td className="p-3">{w?.name} → {z?.name}</td>
                      <td className="p-3">{m.status}</td>
                      <td className="p-3 text-right"><Button size="sm" variant="ghost" onClick={() => del.mutate(m.id)}><Trash2 className="h-4 w-4" /></Button></td>
                    </tr>
                  );
                })}
                {data?.machines.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Aucune machine.</td></tr>}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
