import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  listHierarchy, listReferential, createSite, renameSite, deleteSite,
  createUap, renameUap, deleteUap, createGap, updateGap, deleteGap,
  addQuestion, deleteQuestion,
} from "@/lib/api.functions";
import { Plus, Trash2, Pencil, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  return (
    <AppLayout>
      <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8">
        <PageHeader title="Paramètres" description="Sites, UAP, Gaps et référentiel 5S" />
        <HierarchyEditor />
        <ReferentialEditor />
      </div>
    </AppLayout>
  );
}

function HierarchyEditor() {
  const qc = useQueryClient();
  const listFn = useServerFn(listHierarchy);
  const { data } = useQuery({ queryKey: ["hierarchy"], queryFn: () => listFn() });

  const [selectedSite, setSelectedSite] = useState<string | null>(null);
  const [selectedUap, setSelectedUap] = useState<string | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["hierarchy"] });

  const createSiteFn = useServerFn(createSite);
  const renameSiteFn = useServerFn(renameSite);
  const deleteSiteFn = useServerFn(deleteSite);
  const createUapFn = useServerFn(createUap);
  const renameUapFn = useServerFn(renameUap);
  const deleteUapFn = useServerFn(deleteUap);
  const createGapFn = useServerFn(createGap);
  const updateGapFn = useServerFn(updateGap);
  const deleteGapFn = useServerFn(deleteGap);

  const sites = data?.sites ?? [];
  const uaps = (data?.uaps ?? []).filter((u) => u.site_id === selectedSite);
  const gaps = (data?.gaps ?? []).filter((g) => g.uap_id === selectedUap);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <ColumnEditor
        title="Sites"
        items={sites.map((s) => ({ id: s.id, label: s.name }))}
        selectedId={selectedSite}
        onSelect={(id) => { setSelectedSite(id); setSelectedUap(null); }}
        onCreate={async (name) => { await createSiteFn({ data: { name } }); invalidate(); }}
        onRename={async (id, name) => { await renameSiteFn({ data: { id, name } }); invalidate(); }}
        onDelete={async (id) => {
          if (!confirm("Supprimer ce site et toute sa hiérarchie ?")) return;
          await deleteSiteFn({ data: { id } });
          if (id === selectedSite) { setSelectedSite(null); setSelectedUap(null); }
          invalidate();
        }}
        emptyText="Créez votre premier site"
        placeholder="Nouveau site"
      />
      <ColumnEditor
        title="UAP"
        items={uaps.map((u) => ({ id: u.id, label: u.name }))}
        selectedId={selectedUap}
        onSelect={setSelectedUap}
        disabled={!selectedSite}
        disabledText="Sélectionnez un site"
        onCreate={async (name) => {
          if (!selectedSite) return;
          await createUapFn({ data: { site_id: selectedSite, name } });
          invalidate();
        }}
        onRename={async (id, name) => { await renameUapFn({ data: { id, name } }); invalidate(); }}
        onDelete={async (id) => {
          if (!confirm("Supprimer cette UAP et ses Gaps ?")) return;
          await deleteUapFn({ data: { id } });
          if (id === selectedUap) setSelectedUap(null);
          invalidate();
        }}
        emptyText="Aucune UAP dans ce site"
        placeholder="Nouvelle UAP"
      />
      <ColumnEditor
        title="Gaps"
        items={gaps.map((g) => ({ id: g.id, label: g.name + (g.code ? ` (${g.code})` : "") }))}
        selectedId={null}
        onSelect={() => {}}
        disabled={!selectedUap}
        disabledText="Sélectionnez une UAP"
        onCreate={async (name) => {
          if (!selectedUap) return;
          await createGapFn({ data: { uap_id: selectedUap, name } });
          invalidate();
        }}
        onRename={async (id, name) => { await updateGapFn({ data: { id, name } }); invalidate(); }}
        onDelete={async (id) => {
          if (!confirm("Supprimer ce Gap ?")) return;
          await deleteGapFn({ data: { id } });
          invalidate();
        }}
        emptyText="Aucun Gap dans cette UAP"
        placeholder="Nouveau Gap"
      />
    </div>
  );
}

function ColumnEditor({
  title, items, selectedId, onSelect, onCreate, onRename, onDelete,
  disabled, disabledText, emptyText, placeholder,
}: {
  title: string;
  items: { id: string; label: string }[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: (name: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  disabled?: boolean;
  disabledText?: string;
  emptyText: string;
  placeholder: string;
}) {
  const [value, setValue] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  return (
    <Card className={disabled ? "opacity-60" : ""}>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {disabled && <p className="text-sm text-muted-foreground">{disabledText}</p>}
        {!disabled && (
          <>
            <div className="flex gap-2">
              <Input placeholder={placeholder} value={value} onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && value.trim()) { onCreate(value.trim()).then(() => { setValue(""); toast.success("Ajouté"); }); }}} />
              <Button size="sm" onClick={() => { if (value.trim()) onCreate(value.trim()).then(() => { setValue(""); toast.success("Ajouté"); }); }}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <ul className="space-y-1">
              {items.length === 0 && <li className="text-sm text-muted-foreground">{emptyText}</li>}
              {items.map((it) => (
                <li key={it.id} className={`flex items-center gap-2 rounded border p-2 text-sm ${selectedId === it.id ? "bg-muted" : ""}`}>
                  {editingId === it.id ? (
                    <>
                      <Input value={editValue} onChange={(e) => setEditValue(e.target.value)} className="h-7" autoFocus
                        onKeyDown={(e) => { if (e.key === "Enter") { onRename(it.id, editValue).then(() => setEditingId(null)); }}} />
                      <Button size="sm" variant="ghost" onClick={() => onRename(it.id, editValue).then(() => setEditingId(null))}>
                        <Check className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <button className="flex-1 text-left truncate" onClick={() => onSelect(it.id)}>{it.label}</button>
                      <Button size="sm" variant="ghost" onClick={() => { setEditingId(it.id); setEditValue(it.label); }}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => onDelete(it.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ReferentialEditor() {
  const qc = useQueryClient();
  const listFn = useServerFn(listReferential);
  const addQFn = useServerFn(addQuestion);
  const delQFn = useServerFn(deleteQuestion);
  const { data } = useQuery({ queryKey: ["referential"], queryFn: () => listFn() });
  const [qByCrit, setQByCrit] = useState<Record<string, string>>({});

  const add = useMutation({
    mutationFn: async (criteria_id: string) => {
      const t = qByCrit[criteria_id]?.trim();
      if (!t) return;
      await addQFn({ data: { criteria_id, text: t } });
    },
    onSuccess: (_r, cid) => { setQByCrit({ ...qByCrit, [cid]: "" }); qc.invalidateQueries({ queryKey: ["referential"] }); },
  });
  const del = useMutation({
    mutationFn: async (id: string) => delQFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["referential"] }),
  });

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">Questions par critère 5S</h2>
      <div className="space-y-3">
        {data?.criteria.map((c) => {
          const qs = data.questions.filter((q) => q.criteria_id === c.id);
          return (
            <Card key={c.id}>
              <CardHeader className="pb-2"><CardTitle className="text-base">{c.name}</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-2 mb-3">
                  {qs.map((q) => (
                    <li key={q.id} className="flex items-center justify-between border rounded p-2">
                      <span className="text-sm">{q.text}</span>
                      <Button variant="ghost" size="sm" onClick={() => del.mutate(q.id)}><Trash2 className="h-4 w-4" /></Button>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <Input placeholder="Nouvelle question" value={qByCrit[c.id] ?? ""} onChange={(e) => setQByCrit({ ...qByCrit, [c.id]: e.target.value })} />
                  <Button onClick={() => add.mutate(c.id)}><Plus className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
