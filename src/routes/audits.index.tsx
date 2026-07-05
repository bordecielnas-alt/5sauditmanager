import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { listAudits, listHierarchy, createAudit, deleteAudit } from "@/lib/api.functions";
import { pct, scoreBg } from "@/lib/scoring";
import { format, parseISO } from "date-fns";
import { Plus, Trash2, FileDown } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/audits/")({ component: AuditsList });

function AuditsList() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const listAuditsFn = useServerFn(listAudits);
  const listHierarchyFn = useServerFn(listHierarchy);
  const createFn = useServerFn(createAudit);
  const delFn = useServerFn(deleteAudit);

  const { data: audits } = useQuery({ queryKey: ["audits-list"], queryFn: () => listAuditsFn() });
  const { data: hier } = useQuery({ queryKey: ["hierarchy"], queryFn: () => listHierarchyFn() });

  const del = useMutation({
    mutationFn: async (id: string) => delFn({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["audits-list"] }); toast.success("Audit supprimé"); },
  });

  const exportExcel = () => {
    if (!audits || !hier) return;
    const site = (id: string | null) => hier.sites.find((s) => s.id === id)?.name ?? "";
    const uap = (id: string | null) => hier.uaps.find((u) => u.id === id)?.name ?? "";
    const gap = (id: string | null) => hier.gaps.find((g) => g.id === id)?.name ?? "";
    const rows = audits.map((a) => ({
      Date: a.audit_date, Site: site(a.site_id), UAP: uap(a.uap_id), Gap: gap(a.gap_id),
      Auditeur: a.auditor, "Note /5": a.global_score,
      "Conformité %": a.global_score ? pct(Number(a.global_score)) : "", Statut: a.status,
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
              <NewAuditDialog
                hier={hier ?? { sites: [], uaps: [], gaps: [] }}
                onCreate={async (payload) => {
                  const r = await createFn({ data: payload });
                  nav({ to: "/audits/$id", params: { id: r.id } });
                }}
              />
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
                    <th className="text-left p-3">Site</th>
                    <th className="text-left p-3">UAP</th>
                    <th className="text-left p-3">Gap</th>
                    <th className="text-left p-3">Auditeur</th>
                    <th className="text-left p-3">Note</th>
                    <th className="text-left p-3">Statut</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {(!audits || audits.length === 0) && (
                    <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Aucun audit — cliquez sur "Nouvel audit" pour commencer.</td></tr>
                  )}
                  {audits?.map((a) => {
                    const s = hier?.sites.find((x) => x.id === a.site_id);
                    const u = hier?.uaps.find((x) => x.id === a.uap_id);
                    const g = hier?.gaps.find((x) => x.id === a.gap_id);
                    return (
                      <tr key={a.id} className="border-t hover:bg-muted/50">
                        <td className="p-3">
                          <Link to="/audits/$id" params={{ id: a.id }} className="font-medium hover:underline">
                            {format(parseISO(a.audit_date), "dd/MM/yyyy")}
                          </Link>
                        </td>
                        <td className="p-3">{s?.name ?? "—"}</td>
                        <td className="p-3">{u?.name ?? "—"}</td>
                        <td className="p-3">{g?.name ?? "—"}</td>
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

function NewAuditDialog({
  hier, onCreate,
}: {
  hier: { sites: { id: string; name: string }[]; uaps: { id: string; site_id: string; name: string }[]; gaps: { id: string; uap_id: string; name: string }[] };
  onCreate: (d: { site_id: string; uap_id: string; gap_id: string; auditor: string; audit_date: string }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [siteId, setSiteId] = useState<string>("");
  const [uapId, setUapId] = useState<string>("");
  const [gapId, setGapId] = useState<string>("");
  const [auditor, setAuditor] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));

  const uaps = hier.uaps.filter((u) => u.site_id === siteId);
  const gaps = hier.gaps.filter((g) => g.uap_id === uapId);
  const canSubmit = siteId && uapId && gapId && date;

  const submit = async () => {
    if (!canSubmit) return;
    await onCreate({ site_id: siteId, uap_id: uapId, gap_id: gapId, audit_date: date, auditor });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4 mr-2" />Nouvel audit</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nouvel audit 5S</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Site</Label>
            <Select value={siteId} onValueChange={(v) => { setSiteId(v); setUapId(""); setGapId(""); }}>
              <SelectTrigger><SelectValue placeholder="Choisir un site…" /></SelectTrigger>
              <SelectContent>
                {hier.sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>UAP</Label>
            <Select value={uapId} onValueChange={(v) => { setUapId(v); setGapId(""); }} disabled={!siteId}>
              <SelectTrigger><SelectValue placeholder="Choisir une UAP…" /></SelectTrigger>
              <SelectContent>
                {uaps.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Gap</Label>
            <Select value={gapId} onValueChange={setGapId} disabled={!uapId}>
              <SelectTrigger><SelectValue placeholder="Choisir un Gap…" /></SelectTrigger>
              <SelectContent>
                {gaps.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Auditeur</Label>
            <Input value={auditor} onChange={(e) => setAuditor(e.target.value)} placeholder="Nom de l'auditeur" />
          </div>
          {(hier.sites.length === 0) && (
            <p className="text-sm text-muted-foreground">
              Aucun site configuré. Ajoutez d'abord Sites/UAP/Gaps dans les Paramètres.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
          <Button onClick={submit} disabled={!canSubmit}>Créer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
