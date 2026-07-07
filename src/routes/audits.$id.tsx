import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PhotoUploader, type PhotoItem } from "@/components/PhotoUploader";
import {
  getAudit, updateAuditHeader, saveResponse, completeAudit,
  listHierarchy, listReferential, previousAuditContext,
} from "@/lib/api.functions";
import { pct, scoreBg, scoreText, SCORE_THRESHOLD } from "@/lib/scoring";
import { toast } from "sonner";
import { ArrowLeft, Check, ChevronDown, ChevronLeft, ChevronRight, History, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";

export const Route = createFileRoute("/audits/$id")({ component: AuditEditor });

type ViewMode = "complet" | "etape";

function AuditEditor() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();

  const getAuditFn = useServerFn(getAudit);
  const listHierFn = useServerFn(listHierarchy);
  const listRefFn = useServerFn(listReferential);
  const prevCtxFn = useServerFn(previousAuditContext);
  const updateHeaderFn = useServerFn(updateAuditHeader);
  const saveRespFn = useServerFn(saveResponse);
  const completeFn = useServerFn(completeAudit);

  const { data: current } = useQuery({ queryKey: ["audit", id], queryFn: () => getAuditFn({ data: { id } }) });
  const { data: hier } = useQuery({ queryKey: ["hierarchy"], queryFn: () => listHierFn() });
  const { data: ref } = useQuery({ queryKey: ["referential"], queryFn: () => listRefFn() });
  const { data: prev } = useQuery({ queryKey: ["prev-audit", id], queryFn: () => prevCtxFn({ data: { audit_id: id } }) });

  const [form, setForm] = useState({ audit_date: "", site_id: "", uap_id: "", gap_id: "", auditor: "" });
  const [dirty, setDirty] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("complet");
  const [stepIdx, setStepIdx] = useState(0);
  const [confirmClose, setConfirmClose] = useState(false);

  useEffect(() => {
    if (current?.audit) setForm({
      audit_date: current.audit.audit_date,
      site_id: current.audit.site_id ?? "",
      uap_id: current.audit.uap_id ?? "",
      gap_id: current.audit.gap_id ?? "",
      auditor: current.audit.auditor,
    });
  }, [current?.audit]);

  // Warn on unload if dirty
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const uaps = useMemo(() => (hier?.uaps ?? []).filter((u) => u.site_id === form.site_id), [hier, form.site_id]);
  const gaps = useMemo(() => (hier?.gaps ?? []).filter((g) => g.uap_id === form.uap_id), [hier, form.uap_id]);

  const gapName = hier?.gaps.find((g) => g.id === form.gap_id)?.name ?? "";
  const photoStamp = `${gapName || "—"} / ${form.audit_date || "—"} / ${form.auditor || "—"}`;

  const saveHeader = useMutation({
    mutationFn: async () => updateHeaderFn({ data: { id, ...form } }),
    onSuccess: () => {
      toast.success("Enregistré comme brouillon");
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["audit", id] });
      qc.invalidateQueries({ queryKey: ["prev-audit", id] });
      qc.invalidateQueries({ queryKey: ["audits-list"] });
    },
  });

  const scoreByCriteria = useMemo(() => {
    const m: Record<string, { sum: number; n: number }> = {};
    (current?.responses ?? []).forEach((r) => {
      if (r.score == null) return;
      m[r.criteria_id] ??= { sum: 0, n: 0 };
      m[r.criteria_id].sum += r.score;
      m[r.criteria_id].n += 1;
    });
    return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v.sum / v.n]));
  }, [current?.responses]);

  const globalScore = useMemo(() => {
    const vals = Object.values(scoreByCriteria);
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
  }, [scoreByCriteria]);

  const complete = useMutation({
    mutationFn: async () => {
      await updateHeaderFn({ data: { id, ...form } });
      return completeFn({ data: { id } });
    },
    onSuccess: () => {
      toast.success("Audit clôturé — actions correctives ajoutées au plan");
      setDirty(false);
      qc.invalidateQueries();
      nav({ to: "/audits" });
    },
  });

  if (!current?.audit) return <AppLayout><div className="p-8">Chargement…</div></AppLayout>;

  const prevResponsesByQ = new Map((prev?.responses ?? []).map((r) => [r.question_id, r]));
  const prevPhotosByR = new Map<string, PhotoItem[]>();
  (prev?.photos ?? []).forEach((p) => {
    const arr = prevPhotosByR.get(p.response_id) ?? [];
    arr.push(p as PhotoItem);
    prevPhotosByR.set(p.response_id, arr);
  });

  const photosByResponse = new Map<string, PhotoItem[]>();
  (current.photos ?? []).forEach((p) => {
    const arr = photosByResponse.get(p.response_id) ?? [];
    arr.push(p as PhotoItem);
    photosByResponse.set(p.response_id, arr);
  });

  const allQuestions = (ref?.criteria ?? []).flatMap((c) =>
    ref!.questions.filter((q) => q.criteria_id === c.id).map((q) => ({ q, c })),
  );

  const renderQuestion = (q: { id: string; text: string }, c: { id: string; name: string }) => {
    const r = current.responses.find((x) => x.question_id === q.id);
    const currentPhotos = r ? (photosByResponse.get(r.id) ?? []) : [];
    const prevR = prevResponsesByQ.get(q.id);
    const prevPhotos = prevR ? (prevPhotosByR.get(prevR.id) ?? []) : [];
    return (
      <QuestionRow
        key={q.id}
        auditId={id}
        criteriaId={c.id}
        questionId={q.id}
        questionText={q.text}
        response={r}
        responseId={r?.id}
        currentPhotos={currentPhotos}
        prevScore={prevR?.score ?? null}
        prevComment={prevR?.comment ?? null}
        prevPhotos={prevPhotos}
        prevDate={prev?.audit?.audit_date ?? null}
        photoStamp={photoStamp}
        onSave={(patch) => {
          setDirty(true);
          return saveRespFn({ data: { audit_id: id, question_id: q.id, criteria_id: c.id, ...patch } })
            .then(() => qc.invalidateQueries({ queryKey: ["audit", id] }));
        }}
        onPhotoChange={() => { setDirty(true); qc.invalidateQueries({ queryKey: ["audit", id] }); }}
      />
    );
  };

  const stepMax = allQuestions.length;
  const clampedStep = Math.min(stepIdx, Math.max(0, stepMax - 1));

  return (
    <AppLayout>
      <div className="p-4 md:p-8 max-w-6xl mx-auto">
        <Link to="/audits" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="h-4 w-4" /> Retour aux audits
        </Link>
        <PageHeader
          title="Audit 5S"
          description={
            <span className="flex items-center gap-3">
              {globalScore != null ? `Note : ${globalScore.toFixed(2)}/5 (${pct(globalScore)}%)` : "En cours de saisie"}
              {dirty && <span className="text-xs text-warning font-semibold">● Travail non sauvegardé</span>}
            </span>
          }
          actions={
            <>
              <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="complet">Affichage complet</SelectItem>
                  <SelectItem value="etape">Affichage étape</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => saveHeader.mutate()}>
                <Save className="h-4 w-4 mr-2" />Enregistrer brouillon
              </Button>
              <Button onClick={() => setConfirmClose(true)}>
                <Check className="h-4 w-4 mr-2" />Clôturer l'audit
              </Button>
            </>
          }
        />

        <Card className="mb-6">
          <CardHeader><CardTitle>Informations</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-5">
            <div>
              <Label>Date</Label>
              <Input type="date" value={form.audit_date} onChange={(e) => { setForm({ ...form, audit_date: e.target.value }); setDirty(true); }} />
            </div>
            <div>
              <Label>Site</Label>
              <Select value={form.site_id} onValueChange={(v) => { setForm({ ...form, site_id: v, uap_id: "", gap_id: "" }); setDirty(true); }}>
                <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                <SelectContent>
                  {hier?.sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>UAP</Label>
              <Select value={form.uap_id} onValueChange={(v) => { setForm({ ...form, uap_id: v, gap_id: "" }); setDirty(true); }} disabled={!form.site_id}>
                <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                <SelectContent>
                  {uaps.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Gap</Label>
              <Select value={form.gap_id} onValueChange={(v) => { setForm({ ...form, gap_id: v }); setDirty(true); }} disabled={!form.uap_id}>
                <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                <SelectContent>
                  {gaps.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Auditeur</Label>
              <Input value={form.auditor} onChange={(e) => { setForm({ ...form, auditor: e.target.value }); setDirty(true); }} />
            </div>
            {prev?.audit && (
              <div className="md:col-span-5 text-xs text-muted-foreground flex items-center gap-2">
                <History className="h-3 w-3" />
                Dernier audit sur ce Gap : {format(parseISO(prev.audit.audit_date), "dd/MM/yyyy")}
                {prev.audit.global_score != null && ` — ${Number(prev.audit.global_score).toFixed(2)}/5`}
              </div>
            )}
          </CardContent>
        </Card>

        {viewMode === "complet" ? (
          <div className="space-y-4">
            {ref?.criteria.map((c) => {
              const qs = ref.questions.filter((q) => q.criteria_id === c.id);
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
                    {qs.map((q) => renderQuestion(q, c))}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          stepMax > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">
                  {allQuestions[clampedStep].c.name} — question {clampedStep + 1} / {stepMax}
                </CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={clampedStep === 0} onClick={() => setStepIdx(clampedStep - 1)}>
                    <ChevronLeft className="h-4 w-4" />Précédent
                  </Button>
                  <Button variant="outline" size="sm" disabled={clampedStep >= stepMax - 1} onClick={() => setStepIdx(clampedStep + 1)}>
                    Suivant<ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {(() => {
                  const step = allQuestions[clampedStep];
                  const rItem = current.responses.find((x) => x.question_id === step.q.id);
                  const stepPhotos = rItem ? (photosByResponse.get(rItem.id) ?? []) : [];
                  const sortedPhotos = [...stepPhotos].sort((a, b) => a.id.localeCompare(b.id));
                  const stepActions = rItem
                    ? (current.actions ?? []).filter((a) => a.response_id === rItem.id)
                    : [];
                  return (
                    <>
                      {renderQuestion(step.q, step.c)}
                      {sortedPhotos.length > 0 && (
                        <div>
                          <div className="text-sm font-medium mb-2">
                            Galerie photos ({sortedPhotos.length})
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {sortedPhotos.map((p) => (
                              <div key={p.id} className="border rounded-lg overflow-hidden bg-muted/30">
                                <img
                                  src={`/api/uploads/${p.file_path}`}
                                  alt=""
                                  className="w-full h-64 object-cover"
                                />
                                {p.comment && (
                                  <div className="p-2 text-xs text-muted-foreground">{p.comment}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-medium mb-2">
                          Actions associées ({stepActions.length})
                        </div>
                        {stepActions.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            Aucune action liée à cet item. Saisissez une "action corrective suggérée" — elle sera créée à la clôture.
                          </p>
                        ) : (
                          <ul className="space-y-1.5">
                            {stepActions.map((a) => (
                              <li key={a.id} className="flex items-start gap-2 border rounded p-2 text-sm">
                                <span className={`mt-0.5 h-2 w-2 rounded-full ${a.status === "done" ? "bg-success" : a.status === "in_progress" ? "bg-warning" : "bg-danger"}`} />
                                <div className="flex-1">
                                  <div>{a.description}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {a.responsible ?? "—"}{a.due_date ? ` · Échéance ${a.due_date}` : ""} · {a.status}
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          )
        )}
      </div>

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clôturer cet audit ?</AlertDialogTitle>
            <AlertDialogDescription>
              La note globale sera figée et les actions correctives suggérées seront ajoutées au plan d'actions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => complete.mutate()}>Confirmer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

function QuestionRow({
  auditId, criteriaId, questionId, questionText, response, responseId,
  currentPhotos, prevScore, prevComment, prevPhotos, prevDate, photoStamp, onSave, onPhotoChange,
}: {
  auditId: string;
  criteriaId: string;
  questionId: string;
  questionText: string;
  response: { score: number | null; comment: string | null; gap_text: string | null; suggested_action: string | null } | undefined;
  responseId: string | undefined;
  currentPhotos: PhotoItem[];
  prevScore: number | null;
  prevComment: string | null;
  prevPhotos: PhotoItem[];
  prevDate: string | null;
  photoStamp: string;
  onSave: (patch: { score?: number; comment?: string; gap_text?: string; suggested_action?: string }) => void;
  onPhotoChange: () => void;
}) {
  const score = response?.score ?? null;
  const [openHistory, setOpenHistory] = useState(false);
  const hasHistory = prevScore != null || prevPhotos.length > 0 || !!prevComment;

  return (
    <div className="border rounded-lg p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <p className="font-medium">{questionText}</p>
        <div className="flex gap-1">
          {[0, 1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              onClick={() => onSave({ score: s })}
              className={`h-8 w-8 rounded text-sm font-semibold border transition-colors ${
                score === s ? scoreBg(s) + " border-transparent" : "bg-background hover:bg-muted"
              }`}
            >{s}</button>
          ))}
        </div>
      </div>

      {hasHistory && (
        <Collapsible open={openHistory} onOpenChange={setOpenHistory} className="mb-2">
          <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ChevronDown className={`h-3 w-3 transition-transform ${openHistory ? "rotate-180" : ""}`} />
            Dernier audit
            {prevScore != null && <span className={`ml-1 px-1.5 rounded font-semibold ${scoreBg(prevScore)}`}>{prevScore}/5</span>}
            {prevDate && <span className="opacity-60">· {format(parseISO(prevDate), "dd/MM/yyyy")}</span>}
            {prevPhotos.length > 0 && <span className="opacity-60">· {prevPhotos.length} photo(s)</span>}
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 p-2 bg-muted/40 rounded space-y-2">
            {prevComment && <div className="text-xs italic text-muted-foreground">« {prevComment} »</div>}
            {prevPhotos.length === 0 && <p className="text-xs text-muted-foreground">Pas de photo lors du dernier audit.</p>}
            <div className="flex flex-wrap gap-2">
              {prevPhotos.map((p) => (
                <div key={p.id} className="w-28">
                  <img src={`/api/uploads/${p.file_path}`} alt="" className="w-full h-20 object-cover rounded border" />
                  {p.comment && <div className="text-[10px] text-muted-foreground mt-1 truncate">{p.comment}</div>}
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      <div className="grid md:grid-cols-3 gap-2 mt-2">
        <Textarea placeholder="Commentaire" defaultValue={response?.comment ?? ""} onBlur={(e) => onSave({ comment: e.target.value })} rows={2} />
        <Textarea placeholder="Écart constaté" defaultValue={response?.gap_text ?? ""} onBlur={(e) => onSave({ gap_text: e.target.value })} rows={2} />
        <Textarea placeholder="Action corrective suggérée (deviendra une action du plan à la clôture)" defaultValue={response?.suggested_action ?? ""} onBlur={(e) => onSave({ suggested_action: e.target.value })} rows={2} />
      </div>

      <div className="mt-3">
        <PhotoUploader
          auditId={auditId}
          questionId={questionId}
          criteriaId={criteriaId}
          responseId={responseId}
          photos={currentPhotos}
          defaultComment={photoStamp}
          onChanged={onPhotoChange}
        />
      </div>

      {score != null && score < SCORE_THRESHOLD && (
        <p className={`text-xs mt-2 ${scoreText(score)}`}>⚠ Critère faible — pensez à saisir une action corrective.</p>
      )}
    </div>
  );
}
