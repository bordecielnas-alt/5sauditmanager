import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { listActions, listReferential, updateAction, deleteAction } from "@/lib/api.functions";
import { Trash2, FileDown } from "lucide-react";
import { parseISO, isBefore } from "date-fns";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/actions")({ component: ActionsPage });

const STATUSES = [
  { v: "todo", label: "À faire" },
  { v: "in_progress", label: "En cours" },
  { v: "done", label: "Terminé" },
];

function ActionsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listActions);
  const listRefFn = useServerFn(listReferential);
  const updateFn = useServerFn(updateAction);
  const deleteFn = useServerFn(deleteAction);

  const { data: actions } = useQuery({ queryKey: ["actions-page"], queryFn: () => listFn() });
  const { data: ref } = useQuery({ queryKey: ["referential"], queryFn: () => listRefFn() });

  const update = useMutation({
    mutationFn: async (v: { id: string; responsible?: string | null; due_date?: string | null; status?: string }) =>
      updateFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["actions-page"] }),
  });
  const del = useMutation({
    mutationFn: async (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["actions-page"] }),
  });

  const now = new Date();
  const rows = (actions ?? []).map((a) => {
    const overdue = a.status !== "done" && a.due_date && isBefore(parseISO(a.due_date), now);
    return { ...a, overdue };
  });

  const exportExcel = () => {
    const dat = rows.map((a) => ({
      Description: a.description,
      Critère: ref?.criteria.find((c) => c.id === a.criteria_id)?.name ?? "",
      Responsable: a.responsible ?? "",
      Échéance: a.due_date ?? "",
      Statut: a.overdue ? "En retard" : STATUSES.find((s) => s.v === a.status)?.label,
    }));
    const ws = XLSX.utils.json_to_sheet(dat);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Actions");
    XLSX.writeFile(wb, "actions-correctives.xlsx");
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        <PageHeader
          title="Plans d'actions"
          description="Actions correctives issues des audits"
          actions={<Button variant="outline" onClick={exportExcel}><FileDown className="h-4 w-4 mr-2" />Exporter Excel</Button>}
        />
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="text-left p-3">Description</th>
                    <th className="text-left p-3">Critère</th>
                    <th className="text-left p-3">Responsable</th>
                    <th className="text-left p-3">Échéance</th>
                    <th className="text-left p-3">Statut</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Aucune action.</td></tr>}
                  {rows.map((a) => {
                    const crit = ref?.criteria.find((c) => c.id === a.criteria_id);
                    return (
                      <tr key={a.id} className="border-t hover:bg-muted/50">
                        <td className="p-3">{a.description}</td>
                        <td className="p-3 text-muted-foreground">{crit?.name ?? "—"}</td>
                        <td className="p-3">
                          <Input defaultValue={a.responsible ?? ""} onBlur={(e) => update.mutate({ id: a.id, responsible: e.target.value || null })} className="h-8" />
                        </td>
                        <td className="p-3">
                          <Input type="date" defaultValue={a.due_date ?? ""} onBlur={(e) => update.mutate({ id: a.id, due_date: e.target.value || null })} className="h-8 w-40" />
                          {a.overdue && <div className="text-xs text-danger mt-1">En retard</div>}
                        </td>
                        <td className="p-3">
                          <Select value={a.status} onValueChange={(v) => update.mutate({ id: a.id, status: v })}>
                            <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {STATUSES.map((s) => <SelectItem key={s.v} value={s.v}>{s.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          {a.overdue && <Badge variant="destructive" className="ml-2">Retard</Badge>}
                        </td>
                        <td className="p-3 text-right"><Button size="sm" variant="ghost" onClick={() => del.mutate(a.id)}><Trash2 className="h-4 w-4" /></Button></td>
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
