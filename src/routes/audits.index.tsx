import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { pct, scoreBg } from "@/lib/scoring";
import { format, parseISO } from "date-fns";
import { Plus, Trash2, FileDown } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/audits/")({ component: AuditsList });

function AuditsList() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["audits-list"],
    queryFn: async () => {
      const [audits, workshops, zones] = await Promise.all([
        supabase.from("audits").select("*").order("audit_date", { ascending: false }),
        supabase.from("workshops").select("*"),
        supabase.from("zones").select("*"),
      ]);
      return { audits: audits.data ?? [], workshops: workshops.data ?? [], zones: zones.data ?? [] };
    },
  });

  const createAudit = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("audits")
        .insert({ auditor: "Auditeur", audit_date: new Date().toISOString().slice(0, 10) })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (a) => nav({ to: "/audits/$id", params: { id: a.id } }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("audits").delete().eq("id", id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["audits-list"] });
      toast.success("Audit supprimé");
    },
  });

  const exportExcel = () => {
    if (!data) return;
    const rows = data.audits.map((a) => ({
      Date: a.audit_date,
      Atelier: data.workshops.find((w) => w.id === a.workshop_id)?.name ?? "",
      Zone: data.zones.find((z) => z.id === a.zone_id)?.name ?? "",
      Auditeur: a.auditor,
      "Note /5": a.global_score,
      "Conformité %": a.global_score ? pct(Number(a.global_score)) : "",
      Statut: a.status,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Audits");
    XLSX.writeFile(wb, "audits-5s.xlsx");
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        <PageHeader
          title="Audits 5S"
          description="Historique et création des audits"
          actions={
            <>
              <Button variant="outline" onClick={exportExcel}><FileDown className="h-4 w-4 mr-2" />Exporter Excel</Button>
              <Button onClick={() => createAudit.mutate()}><Plus className="h-4 w-4 mr-2" />Nouvel audit</Button>
            </>
          }
        />

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="text-left p-3">Date</th>
                    <th className="text-left p-3">Atelier</th>
                    <th className="text-left p-3">Zone</th>
                    <th className="text-left p-3">Auditeur</th>
                    <th className="text-left p-3">Note</th>
                    <th className="text-left p-3">Statut</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {data?.audits.length === 0 && (
                    <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Aucun audit — cliquez sur "Nouvel audit" pour commencer.</td></tr>
                  )}
                  {data?.audits.map((a) => {
                    const w = data.workshops.find((x) => x.id === a.workshop_id);
                    const z = data.zones.find((x) => x.id === a.zone_id);
                    return (
                      <tr key={a.id} className="border-t hover:bg-muted/50">
                        <td className="p-3">
                          <Link to="/audits/$id" params={{ id: a.id }} className="font-medium hover:underline">
                            {format(parseISO(a.audit_date), "dd/MM/yyyy")}
                          </Link>
                        </td>
                        <td className="p-3">{w?.name ?? "—"}</td>
                        <td className="p-3">{z?.name ?? "—"}</td>
                        <td className="p-3">{a.auditor}</td>
                        <td className="p-3">
                          {a.global_score != null ? (
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${scoreBg(Number(a.global_score))}`}>
                              {Number(a.global_score).toFixed(2)}/5 · {pct(Number(a.global_score))}%
                            </span>
                          ) : "—"}
                        </td>
                        <td className="p-3">
                          <Badge variant={a.status === "completed" ? "default" : "secondary"}>
                            {a.status === "completed" ? "Terminé" : "Brouillon"}
                          </Badge>
                        </td>
                        <td className="p-3 text-right">
                          <Button size="sm" variant="ghost" onClick={() => { if (confirm("Supprimer cet audit ?")) del.mutate(a.id); }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
