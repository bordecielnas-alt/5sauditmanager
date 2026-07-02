import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { pct, scoreBg, scoreText, SCORE_THRESHOLD } from "@/lib/scoring";
import { toast } from "sonner";
import { ArrowLeft, Check } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export const Route = createFileRoute("/audits/$id")({ component: AuditEditor });

function AuditEditor() {
  const { id } = Route.useParams();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["audit", id],
    queryFn: async () => {
      const [audit, workshops, zones, machines, auditMachines, criteria, questions, responses] = await Promise.all([
        supabase.from("audits").select("*").eq("id", id).maybeSingle(),
        supabase.from("workshops").select("*").order("name"),
        supabase.from("zones").select("*"),
        supabase.from("machines").select("*"),
        supabase.from("audit_machines").select("*").eq("audit_id", id),
        supabase.from("criteria").select("*").order("order_index"),
        supabase.from("questions").select("*").order("order_index"),
        supabase.from("audit_responses").select("*").eq("audit_id", id),
      ]);
      return {
        audit: audit.data,
        workshops: workshops.data ?? [],
        zones: zones.data ?? [],
        machines: machines.data ?? [],
        auditMachines: auditMachines.data ?? [],
        criteria: criteria.data ?? [],
        questions: questions.data ?? [],
        responses: responses.data ?? [],
      };
    },
  });

  const [form, setForm] = useState<{ audit_date: string; workshop_id: string | null; zone_id: string | null; auditor: string }>({
    audit_date: "", workshop_id: null, zone_id: null, auditor: "",
  });
  useEffect(() => {
    if (data?.audit) setForm({
      audit_date: data.audit.audit_date,
      workshop_id: data.audit.workshop_id,
      zone_id: data.audit.zone_id,
      auditor: data.audit.auditor,
    });
  }, [data?.audit]);

  const zones = useMemo(
    () => (data?.zones ?? []).filter((z) => !form.workshop_id || z.workshop_id === form.workshop_id),
    [data?.zones, form.workshop_id],
  );
  const machinesInZone = useMemo(
    () => (data?.machines ?? []).filter((m) => m.zone_id === form.zone_id),
    [data?.machines, form.zone_id],
  );
  const selectedMachineIds = new Set((data?.auditMachines ?? []).map((am) => am.machine_id));

  const saveHeader = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("audits").update({
        audit_date: form.audit_date,
        workshop_id: form.workshop_id,
        zone_id: form.zone_id,
        auditor: form.auditor,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Enregistré"); qc.invalidateQueries({ queryKey: ["audit", id] }); },
  });

  const toggleMachine = useMutation({
    mutationFn: async ({ machineId, checked }: { machineId: string; checked: boolean }) => {
      if (checked) await supabase.from("audit_machines").insert({ audit_id: id, machine_id: machineId });
      else await supabase.from("audit_machines").delete().eq("audit_id", id).eq("machine_id", machineId);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["audit", id] }),
  });

  const saveResponse = useMutation({
    mutationFn: async (r: { question_id: string; criteria_id: string; score?: number; comment?: string; gap?: string; suggested_action?: string; photo_url?: string }) => {
      const { error } = await supabase.from("audit_responses").upsert(
        { audit_id: id, ...r },
        { onConflict: "audit_id,question_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["audit", id] }),
  });

  // Calcul scores par critère + global
  const scoreByCriteria = useMemo(() => {
    const m: Record<string, { sum: number; n: number }> = {};
    (data?.responses ?? []).forEach((r) => {
      if (r.score == null) return;
      m[r.criteria_id] ??= { sum: 0, n: 0 };
      m[r.criteria_id].sum += r.score;
      m[r.criteria_id].n += 1;
    });
    return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v.sum / v.n]));
  }, [data?.responses]);

  const globalScore = useMemo(() => {
    const vals = Object.values(scoreByCriteria);
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
  }, [scoreByCriteria]);

  const complete = useMutation({
    mutationFn: async () => {
      // Enregistrer note globale + statut
      await supabase.from("audits").update({ global_score: globalScore, status: "completed" }).eq("id", id);
      // Générer actions correctives pour critères < seuil
      const weak = (data?.criteria ?? []).filter((c) => (scoreByCriteria[c.id] ?? 0) < SCORE_THRESHOLD && scoreByCriteria[c.id] != null);
      // Éviter les doublons: on ne crée que si aucune action existante pour (audit, criteria)
      const existing = await supabase.from("corrective_actions").select("criteria_id").eq("audit_id", id);
      const existingSet = new Set((existing.data ?? []).map((x) => x.criteria_id));
      const toInsert = weak
        .filter((c) => !existingSet.has(c.id))
        .map((c) => ({
          audit_id: id,
          criteria_id: c.id,
          description: `Améliorer le critère ${c.name} (note ${scoreByCriteria[c.id].toFixed(2)}/5)`,
          status: "todo",
        }));
      if (toInsert.length) await supabase.from("corrective_actions").insert(toInsert);
    },
    onSuccess: () => {
      toast.success("Audit clôturé et actions correctives générées");
      qc.invalidateQueries({ queryKey: ["audit", id] });
    },
  });

  if (!data?.audit) return <AppLayout><div className="p-8">Chargement…</div></AppLayout>;

  return (
    <AppLayout>
      <div className="p-4 md:p-8 max-w-6xl mx-auto">
        <Link to="/audits" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="h-4 w-4" /> Retour aux audits
        </Link>
        <PageHeader
          title="Audit 5S"
          description={globalScore != null ? `Note globale : ${globalScore.toFixed(2)}/5 (${pct(globalScore)}%)` : "En cours de saisie"}
          actions={
            <>
              <Button variant="outline" onClick={() => saveHeader.mutate()}>Enregistrer</Button>
              <Button onClick={() => complete.mutate()}><Check className="h-4 w-4 mr-2" />Clôturer l'audit</Button>
            </>
          }
        />

        <Card className="mb-6">
          <CardHeader><CardTitle>Informations</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <div>
              <Label>Date</Label>
              <Input type="date" value={form.audit_date} onChange={(e) => setForm({ ...form, audit_date: e.target.value })} />
            </div>
            <div>
              <Label>Atelier</Label>
              <Select value={form.workshop_id ?? ""} onValueChange={(v) => setForm({ ...form, workshop_id: v, zone_id: null })}>
                <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                <SelectContent>
                  {data.workshops.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Zone</Label>
              <Select value={form.zone_id ?? ""} onValueChange={(v) => setForm({ ...form, zone_id: v })} disabled={!form.workshop_id}>
                <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                <SelectContent>
                  {zones.map((z) => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Auditeur</Label>
              <Input value={form.auditor} onChange={(e) => setForm({ ...form, auditor: e.target.value })} />
            </div>

            {form.zone_id && (
              <div className="md:col-span-4">
                <Label className="mb-2 block">Machines auditées</Label>
                {machinesInZone.length === 0 && <p className="text-sm text-muted-foreground">Aucune machine dans cette zone.</p>}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {machinesInZone.map((m) => (
                    <label key={m.id} className="flex items-center gap-2 p-2 border rounded hover:bg-muted/50 cursor-pointer">
                      <Checkbox
                        checked={selectedMachineIds.has(m.id)}
                        onCheckedChange={(c) => toggleMachine.mutate({ machineId: m.id, checked: !!c })}
                      />
                      <span className="text-sm">{m.name} <span className="text-muted-foreground">({m.code})</span></span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Grille d'évaluation */}
        <div className="space-y-4">
          {data.criteria.map((c) => {
            const qs = data.questions.filter((q) => q.criteria_id === c.id);
            const avg = scoreByCriteria[c.id];
            return (
              <Card key={c.id}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>{c.name}</CardTitle>
                  {avg != null && (
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${scoreBg(avg)}`}>
                      {avg.toFixed(2)}/5 · {pct(avg)}%
                    </span>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {qs.map((q) => {
                    const r = data.responses.find((x) => x.question_id === q.id);
                    return (
                      <QuestionRow
                        key={q.id}
                        question={q.text}
                        response={r}
                        onChange={(patch) =>
                          saveResponse.mutate({ question_id: q.id, criteria_id: c.id, ...patch })
                        }
                      />
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}

function QuestionRow({
  question, response, onChange,
}: {
  question: string;
  response: { score?: number | null; comment?: string | null; gap?: string | null; suggested_action?: string | null; photo_url?: string | null } | undefined;
  onChange: (patch: { score?: number; comment?: string; gap?: string; suggested_action?: string; photo_url?: string }) => void;
}) {
  const score = response?.score ?? null;
  return (
    <div className="border rounded-lg p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <p className="font-medium">{question}</p>
        <div className="flex gap-1">
          {[0, 1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              onClick={() => onChange({ score: s })}
              className={`h-8 w-8 rounded text-sm font-semibold border transition-colors ${
                score === s
                  ? scoreBg(s) + " border-transparent"
                  : "bg-background hover:bg-muted"
              }`}
            >{s}</button>
          ))}
        </div>
      </div>
      <div className="grid md:grid-cols-3 gap-2 mt-2">
        <Textarea placeholder="Commentaire" defaultValue={response?.comment ?? ""} onBlur={(e) => onChange({ comment: e.target.value })} rows={2} />
        <Textarea placeholder="Écart constaté" defaultValue={response?.gap ?? ""} onBlur={(e) => onChange({ gap: e.target.value })} rows={2} />
        <Textarea placeholder="Action corrective suggérée" defaultValue={response?.suggested_action ?? ""} onBlur={(e) => onChange({ suggested_action: e.target.value })} rows={2} />
      </div>
      <div className="mt-2">
        <Input placeholder="URL de la photo / preuve (optionnel)" defaultValue={response?.photo_url ?? ""} onBlur={(e) => onChange({ photo_url: e.target.value })} />
      </div>
      {score != null && score < 3 && (
        <p className={`text-xs mt-2 ${scoreText(score)}`}>⚠ Critère faible — une action corrective sera générée à la clôture.</p>
      )}
    </div>
  );
}
