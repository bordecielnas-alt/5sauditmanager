import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  listActions, listReferential, listHierarchy,
  createAction, updateAction, deleteAction,
} from "@/lib/api.functions";
import { Trash2, FileDown, ArrowUpDown, Plus } from "lucide-react";
import { parseISO, isBefore } from "date-fns";
import { useMemo, useState } from "react";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/actions")({ component: ActionsPage });

const STATUSES = [
  { v: "todo", label: "À faire" },
  { v: "in_progress", label: "En cours" },
  { v: "done", label: "Terminé" },
];

type SortKey = "site" | "uap" | "gap" | "due_date" | "status";

function ActionsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listActions);
  const listRefFn = useServerFn(listReferential);
  const listHierFn = useServerFn(listHierarchy);
  const createFn = useServerFn(createAction);
  const updateFn = useServerFn(updateAction);
  const deleteFn = useServerFn(deleteAction);

  const { data: actions } = useQuery({ queryKey: ["actions-page"], queryFn: () => listFn() });
  const { data: ref } = useQuery({ queryKey: ["referential"], queryFn: () => listRefFn() });
  const { data: hier } = useQuery({ queryKey: ["hierarchy"], queryFn: () => listHierFn() });

  const [hideDone, setHideDone] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("due_date");
  const [sortAsc, setSortAsc] = useState(true);

  const update = useMutation({
    mutationFn: async (v: Parameters<typeof updateFn>[0]["data"]) => updateFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["actions-page"] }),
  });
  const del = useMutation({
    mutationFn: async (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["actions-page"] }),
  });

  const now = new Date();
  const enriched = useMemo(() => {
    const sName = (id: string | null) => hier?.sites.find((s) => s.id === id)?.name ?? "";
    const uName = (id: string | null) => hier?.uaps.find((u) => u.id === id)?.name ?? "";
    const gName = (id: string | null) => hier?.gaps.find((g) => g.id === id)?.name ?? "";
    return (actions ?? []).map((a) => ({
      ...a,
      siteName: sName(a.site_id),
      uapName: uName(a.uap_id),
      gapName: gName(a.gap_id),
      overdue: a.status !== "done" && !!a.due_date && isBefore(parseISO(a.due_date), now),
    }));
  }, [actions, hier, now]);

  const rows = useMemo(() => {
    const filtered = hideDone ? enriched.filter((a) => a.status !== "done") : enriched;
    const cmp = (a: string, b: string) => a.localeCompare(b);
    const key = sortKey;
    const s = [...filtered].sort((a, b) => {
      let r = 0;
      if (key === "site") r = cmp(a.siteName, b.siteName);
      else if (key === "uap") r = cmp(a.uapName, b.uapName);
      else if (key === "gap") r = cmp(a.gapName, b.gapName);
      else if (key === "status") r = cmp(a.status, b.status);
      else if (key === "due_date") r = (a.due_date ?? "").localeCompare(b.due_date ?? "");
      return sortAsc ? r : -r;
    });
    return s;
  }, [enriched, hideDone, sortKey, sortAsc]);

  const openCount = enriched.filter((a) => a.status !== "done").length;
  const doneCount = enriched.filter((a) => a.status === "done").length;
  const overdueCount = enriched.filter((a) => a.overdue).length;

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortAsc((v) => !v);
    else { setSortKey(k); setSortAsc(true); }
  };

  const exportExcel = () => {
    const dat = rows.map((a) => ({
      Site: a.siteName, UAP: a.uapName, Gap: a.gapName,
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

  const Th = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <th className="text-left p-3 select-none">
      <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort(k)}>
        {children}<ArrowUpDown className="h-3 w-3 opacity-50" />
        {sortKey === k && <span className="text-[10px]">{sortAsc ? "▲" : "▼"}</span>}
      </button>
    </th>
  );

  return (
    <AppLayout>
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        <PageHeader
          title="Plans d'actions"
          description="Actions correctives issues des audits"
          actions={
            <>
              <NewActionDialog hier={hier ?? { sites: [], uaps: [], gaps: [] }} onCreate={(d) => createFn({ data: d }).then(() => qc.invalidateQueries({ queryKey: ["actions-page"] }))} />
              <Button variant="outline" onClick={exportExcel}><FileDown className="h-4 w-4 mr-2" />Exporter Excel</Button>
            </>
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          <Card><CardContent className="p-4">
            <div className="text-xs uppercase text-muted-foreground">Ouvertes</div>
            <div className="text-2xl font-bold">{openCount}</div>
            {overdueCount > 0 && <div className="text-xs text-danger">{overdueCount} en retard</div>}
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="text-xs uppercase text-muted-foreground">Terminées</div>
            <div className="text-2xl font-bold">{doneCount}</div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs uppercase text-muted-foreground">Affichage</div>
              <div className="text-sm mt-1">Masquer les actions terminées</div>
            </div>
            <Switch checked={hideDone} onCheckedChange={setHideDone} />
          </CardContent></Card>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <Th k="site">Site</Th>
                    <Th k="uap">UAP</Th>
                    <Th k="gap">Gap</Th>
                    <th className="text-left p-3">Description</th>
                    <th className="text-left p-3">Responsable</th>
                    <Th k="due_date">Échéance</Th>
                    <Th k="status">Statut</Th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Aucune action.</td></tr>}
                  {rows.map((a) => (
                    <tr key={a.id} className="border-t hover:bg-muted/50">
                      <td className="p-3">{a.siteName || "—"}</td>
                      <td className="p-3">{a.uapName || "—"}</td>
                      <td className="p-3">{a.gapName || "—"}</td>
                      <td className="p-3 min-w-[280px]">
                        <Input defaultValue={a.description} onBlur={(e) => { if (e.target.value !== a.description) update.mutate({ id: a.id, description: e.target.value }); }} className="h-8" />
                      </td>
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
                      <td className="p-3 text-right"><Button size="sm" variant="ghost" onClick={() => { if (confirm("Supprimer cette action ?")) del.mutate(a.id); }}><Trash2 className="h-4 w-4" /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

function NewActionDialog({
  hier, onCreate,
}: {
  hier: { sites: { id: string; name: string }[]; uaps: { id: string; site_id: string; name: string }[]; gaps: { id: string; uap_id: string; name: string }[] };
  onCreate: (d: { description: string; site_id?: string | null; uap_id?: string | null; gap_id?: string | null; responsible?: string | null; due_date?: string | null }) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [siteId, setSiteId] = useState("");
  const [uapId, setUapId] = useState("");
  const [gapId, setGapId] = useState("");
  const [responsible, setResponsible] = useState("");
  const [dueDate, setDueDate] = useState("");

  const uaps = hier.uaps.filter((u) => u.site_id === siteId);
  const gaps = hier.gaps.filter((g) => g.uap_id === uapId);

  const submit = async () => {
    if (!description.trim()) return;
    await onCreate({
      description,
      site_id: siteId || null,
      uap_id: uapId || null,
      gap_id: gapId || null,
      responsible: responsible || null,
      due_date: dueDate || null,
    });
    setOpen(false);
    setDescription(""); setSiteId(""); setUapId(""); setGapId(""); setResponsible(""); setDueDate("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4 mr-2" />Ajouter une action</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nouvelle action corrective</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>Site</Label>
              <Select value={siteId} onValueChange={(v) => { setSiteId(v); setUapId(""); setGapId(""); }}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{hier.sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>UAP</Label>
              <Select value={uapId} onValueChange={(v) => { setUapId(v); setGapId(""); }} disabled={!siteId}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{uaps.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Gap</Label>
              <Select value={gapId} onValueChange={setGapId} disabled={!uapId}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{gaps.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Responsable</Label><Input value={responsible} onChange={(e) => setResponsible(e.target.value)} /></div>
            <div><Label>Échéance</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
          <Button onClick={submit} disabled={!description.trim()}>Créer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
