import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HierarchyFilter, useResolvedFilters } from "@/components/HierarchyFilter";
import { dashboardData } from "@/lib/api.functions";
import { pct, scoreBg, scoreText } from "@/lib/scoring";
import {
  CartesianGrid, Line, LineChart, PolarAngleAxis, PolarGrid,
  Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, PolarRadiusAxis,
} from "recharts";
import { format, parseISO, subDays, subMonths, subYears, isAfter, startOfWeek, startOfMonth, startOfQuarter, getQuarter } from "date-fns";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/")({ component: DashboardPage });

const CRITERIA_FR: Record<string, string> = {
  Seiri: "Seiri - Trier",
  Seiton: "Seiton - Ranger",
  Seiso: "Seiso - Nettoyer",
  Seiketsu: "Seiketsu - Standardiser",
  Shitsuke: "Shitsuke - Respecter",
};

function DashboardPage() {
  const dashFn = useServerFn(dashboardData);
  const { data: d } = useQuery({ queryKey: ["dashboard"], queryFn: () => dashFn() });

  const hier = useMemo(
    () => (d ? { sites: d.sites, uaps: d.uaps, gaps: d.gaps } : undefined),
    [d],
  );
  const f = useResolvedFilters(hier);

  const dateFloor = useMemo(() => {
    const now = new Date();
    if (f.period === "week") return subDays(now, 7);
    if (f.period === "month") return subMonths(now, 1);
    if (f.period === "year") return subYears(now, 1);
    return null;
  }, [f.period]);

  const filteredAudits = useMemo(() => {
    if (!d) return [];
    return d.audits.filter((a) => {
      if (a.site_id && !f.sites.has(a.site_id)) return false;
      if (a.uap_id && !f.uaps.has(a.uap_id)) return false;
      if (a.gap_id && !f.gaps.has(a.gap_id)) return false;
      if (dateFloor && !isAfter(parseISO(a.audit_date), dateFloor)) return false;
      return true;
    });
  }, [d, f, dateFloor]);

  const auditIdSet = useMemo(() => new Set(filteredAudits.map((a) => a.id)), [filteredAudits]);
  const filteredResponses = useMemo(
    () => (d?.responses ?? []).filter((r) => auditIdSet.has(r.audit_id)),
    [d, auditIdSet],
  );
  const filteredPhotos = useMemo(
    () => (d?.photos ?? []).filter((p) => auditIdSet.has(p.audit_id)),
    [d, auditIdSet],
  );

  const completed = filteredAudits.filter((a) => a.status === "completed");
  const avgGlobal = completed.length
    ? completed.reduce((s, a) => s + Number(a.global_score ?? 0), 0) / completed.length
    : 0;

  const openActions = d?.actions.filter((a) => a.status !== "done").length ?? 0;
  const overdueActions = d?.actions.filter((a) => a.status !== "done" && a.due_date && new Date(a.due_date) < new Date()).length ?? 0;
  const doneActions = d?.actions.filter((a) => a.status === "done").length ?? 0;

  const radar = (d?.criteria ?? []).map((c) => {
    const rs = filteredResponses.filter((r) => r.criteria_id === c.id && r.score != null);
    const avg = rs.length ? rs.reduce((s, r) => s + (r.score ?? 0), 0) / rs.length : 0;
    return { criteria: CRITERIA_FR[c.name] ?? c.name, score: Number(avg.toFixed(2)), fullMark: 5 };
  });

  const bySite = useMemo(() => (d?.sites ?? [])
    .filter((s) => f.sites.has(s.id))
    .map((s) => {
      const audits = completed.filter((a) => a.site_id === s.id);
      const avg = audits.length ? audits.reduce((x, a) => x + Number(a.global_score ?? 0), 0) / audits.length : 0;
      return { id: s.id, name: s.name, score: Number(avg.toFixed(2)), count: audits.length };
    })
    .filter((r) => r.count > 0)
    .sort((a, b) => b.score - a.score),
    [d, f.sites, completed]);

  const byGap = useMemo(() => (d?.gaps ?? [])
    .filter((g) => f.gaps.has(g.id))
    .map((g) => {
      const uap = d?.uaps.find((u) => u.id === g.uap_id);
      const site = uap ? d?.sites.find((s) => s.id === uap.site_id) : undefined;
      const audits = completed.filter((a) => a.gap_id === g.id);
      const avg = audits.length ? audits.reduce((x, a) => x + Number(a.global_score ?? 0), 0) / audits.length : 0;
      return {
        id: g.id,
        name: g.name,
        parent: `${site?.name ?? "—"} / ${uap?.name ?? "—"}`,
        score: Number(avg.toFixed(2)),
        count: audits.length,
      };
    })
    .filter((r) => r.count > 0)
    .sort((a, b) => b.score - a.score),
    [d, f.gaps, completed]);

  const [xAxis, setXAxis] = useState<"day" | "week" | "month" | "quarter">("month");
  const timeline = useMemo(() => {
    const bucketKey = (iso: string) => {
      const dt = parseISO(iso);
      if (xAxis === "day") return format(dt, "yyyy-MM-dd");
      if (xAxis === "week") return format(startOfWeek(dt, { weekStartsOn: 1 }), "yyyy-'S'II");
      if (xAxis === "month") return format(startOfMonth(dt), "yyyy-MM");
      return `${format(startOfQuarter(dt), "yyyy")}-T${getQuarter(dt)}`;
    };
    const bucketLabel = (iso: string) => {
      const dt = parseISO(iso);
      if (xAxis === "day") return format(dt, "dd/MM");
      if (xAxis === "week") return `S${format(dt, "II")} ${format(dt, "yy")}`;
      if (xAxis === "month") return format(dt, "MM/yy");
      return `T${getQuarter(dt)} ${format(dt, "yy")}`;
    };
    const byBucket = new Map<string, { label: string; sum: number; n: number }>();
    [...completed]
      .sort((a, b) => a.audit_date.localeCompare(b.audit_date))
      .forEach((a) => {
        const k = bucketKey(a.audit_date);
        const e = byBucket.get(k) ?? { label: bucketLabel(a.audit_date), sum: 0, n: 0 };
        e.sum += Number(a.global_score ?? 0);
        e.n += 1;
        byBucket.set(k, e);
      });
    return [...byBucket.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, v]) => ({ date: v.label, score: Number((v.sum / v.n).toFixed(2)) }));
  }, [completed, xAxis]);

  return (
    <AppLayout>
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        <PageHeader title="Dashboard 5S" description="Vue d'ensemble des performances 5S" />

        <HierarchyFilter hier={hier} />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Kpi label="Note globale moyenne" value={`${pct(avgGlobal)}%`} sub={`${avgGlobal.toFixed(2)}/5`} tone={pct(avgGlobal)} />
          <Kpi label="Audits (filtre)" value={String(completed.length)} sub={`${filteredAudits.length} au total`} />
          <Link to="/actions" search={{ status: "open" }} className="block">
            <Kpi label="Actions ouvertes" value={String(openActions)} sub={overdueActions > 0 ? `${overdueActions} en retard` : "—"} tone={overdueActions > 0 ? 0 : 100} />
          </Link>
          <Link to="/actions" search={{ status: "done" }} className="block">
            <Kpi label="Actions clôturées" value={String(doneActions)} sub="—" tone={100} />
          </Link>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Radar 5S</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radar}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="criteria" tick={{ fontSize: 11 }} />
                  <PolarRadiusAxis domain={[0, 5]} />
                  <Radar dataKey="score" stroke="var(--color-chart-1)" fill="var(--color-chart-1)" fillOpacity={0.4} />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Évolution des scores</CardTitle>
              <div className="flex gap-1">
                {(["day", "week", "month", "quarter"] as const).map((v) => (
                  <Button key={v} size="sm" variant={xAxis === v ? "default" : "outline"} onClick={() => setXAxis(v)} className="h-7 text-xs">
                    {v === "day" ? "Jour" : v === "week" ? "Semaine" : v === "month" ? "Mois" : "Trimestre"}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeline}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[0, 5]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="score" stroke="var(--color-chart-1)" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <PodiumCard title="Classement des sites" rows={bySite} emptyText="Aucun site audité." />
          <PodiumCard title="Classement des Gaps" rows={byGap} emptyText="Aucun Gap audité." />

          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Galerie photos ({filteredPhotos.length})</CardTitle></CardHeader>
            <CardContent>
              {filteredPhotos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune photo pour ce filtre.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {filteredPhotos.map((p) => {
                    const gapName = d?.gaps.find((g) => g.id === p.gap_id)?.name ?? "—";
                    const stamp = `${gapName} · ${p.audit_date ? format(parseISO(p.audit_date), "dd/MM/yyyy") : "—"} · ${p.auditor ?? "—"}`;
                    return (
                      <Link
                        key={p.id}
                        to="/audits/$id"
                        params={{ id: p.audit_id }}
                        className="group relative block rounded overflow-hidden border"
                        title={stamp}
                      >
                        <img src={`/api/uploads/${p.file_path}`} alt="" className="w-full aspect-square object-cover" />
                        <div className="absolute inset-x-0 top-0 bg-black/60 text-white text-[10px] px-1.5 py-0.5 truncate">
                          {stamp}
                        </div>
                        {p.comment && (
                          <div className="absolute inset-x-0 bottom-0 bg-black/70 text-white text-xs p-1 truncate opacity-0 group-hover:opacity-100 transition">
                            {p.comment}
                          </div>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}

function PodiumCard({
  title, rows, emptyText,
}: {
  title: string;
  rows: { id: string; name: string; parent?: string; score: number; count: number }[];
  emptyText: string;
}) {
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <ol className="space-y-2">
            {rows.map((r, i) => {
              const podium = i < 3;
              return (
                <li
                  key={r.id}
                  className={`flex items-center gap-3 rounded-lg border p-2.5 ${
                    podium ? "bg-muted/50 border-primary/30" : ""
                  }`}
                >
                  <div className={`w-8 text-center text-lg ${podium ? "" : "text-muted-foreground text-sm"}`}>
                    {podium ? medals[i] : `#${i + 1}`}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{r.name}</div>
                    {r.parent && <div className="text-xs text-muted-foreground truncate">{r.parent}</div>}
                    <div className="text-xs text-muted-foreground">{r.count} audit{r.count > 1 ? "s" : ""}</div>
                  </div>
                  <div className={`px-2 py-1 rounded text-xs font-semibold ${scoreBg(r.score)}`}>
                    {r.score.toFixed(2)}/5 · {pct(r.score)}%
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: number }) {
  const toneClass =
    tone == null ? "text-foreground" : tone >= 75 ? scoreText(4) : tone >= 50 ? scoreText(2.7) : scoreText(1);
  return (
    <Card className="h-full">
      <CardContent className="p-4 h-full flex flex-col">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`text-3xl font-bold mt-1 ${toneClass}`}>{value}</div>
        <div className="text-xs text-muted-foreground mt-1 min-h-[1rem]">{sub ?? ""}</div>
      </CardContent>
    </Card>
  );
}
