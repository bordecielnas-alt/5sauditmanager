import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { dashboardData } from "@/lib/api.functions";
import { pct, scoreText } from "@/lib/scoring";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, PolarAngleAxis, PolarGrid,
  Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, PolarRadiusAxis,
} from "recharts";
import { format, parseISO, subDays, subMonths, subYears, isAfter, startOfWeek, startOfMonth, startOfQuarter, getQuarter } from "date-fns";
import { useMemo, useState, useEffect } from "react";

export const Route = createFileRoute("/")({ component: DashboardPage });

type Period = "week" | "month" | "year" | "all";

function DashboardPage() {
  const dashFn = useServerFn(dashboardData);
  const { data: d } = useQuery({ queryKey: ["dashboard"], queryFn: () => dashFn() });

  const [sitesSel, setSitesSel] = useState<Set<string>>(new Set());
  const [uapsSel, setUapsSel] = useState<Set<string>>(new Set());
  const [gapsSel, setGapsSel] = useState<Set<string>>(new Set());
  const [period, setPeriod] = useState<Period>("all");

  // Tout coché par défaut au chargement des données
  useEffect(() => {
    if (!d) return;
    setSitesSel(new Set(d.sites.map((s) => s.id)));
    setUapsSel(new Set(d.uaps.map((u) => u.id)));
    setGapsSel(new Set(d.gaps.map((g) => g.id)));
  }, [d]);

  const dateFloor = useMemo(() => {
    const now = new Date();
    if (period === "week") return subDays(now, 7);
    if (period === "month") return subMonths(now, 1);
    if (period === "year") return subYears(now, 1);
    return null;
  }, [period]);

  const filteredAudits = useMemo(() => {
    if (!d) return [];
    return d.audits.filter((a) => {
      if (a.site_id && !sitesSel.has(a.site_id)) return false;
      if (a.uap_id && !uapsSel.has(a.uap_id)) return false;
      if (a.gap_id && !gapsSel.has(a.gap_id)) return false;
      if (dateFloor && !isAfter(parseISO(a.audit_date), dateFloor)) return false;
      return true;
    });
  }, [d, sitesSel, uapsSel, gapsSel, dateFloor]);

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
    return { criteria: c.name, score: Number(avg.toFixed(2)), fullMark: 5 };
  });

  const bySite = (d?.sites ?? [])
    .filter((s) => sitesSel.has(s.id))
    .map((s) => {
      const audits = completed.filter((a) => a.site_id === s.id);
      const avg = audits.length ? audits.reduce((x, a) => x + Number(a.global_score ?? 0), 0) / audits.length : 0;
      return { name: s.name, score: Number(avg.toFixed(2)), count: audits.length };
    })
    .filter((r) => r.count > 0)
    .sort((a, b) => b.score - a.score);

  // Timeline grouping (day / week / month / quarter)
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

  const toggle = <T,>(set: Set<T>, setSet: (s: Set<T>) => void, id: T) => {
    const n = new Set(set);
    if (n.has(id)) n.delete(id); else n.add(id);
    setSet(n);
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        <PageHeader title="Dashboard 5S" description="Vue d'ensemble des performances 5S" />

        {/* Filtres */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filtres</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <FilterList
              title="Sites"
              items={d?.sites ?? []}
              selected={sitesSel}
              onToggle={(id) => toggle(sitesSel, setSitesSel, id)}
              onAll={() => setSitesSel(new Set((d?.sites ?? []).map((x) => x.id)))}
              onNone={() => setSitesSel(new Set())}
            />
            <FilterList
              title="UAP"
              items={(d?.uaps ?? []).filter((u) => sitesSel.has(u.site_id))}
              selected={uapsSel}
              onToggle={(id) => toggle(uapsSel, setUapsSel, id)}
              onAll={() => setUapsSel(new Set((d?.uaps ?? []).map((x) => x.id)))}
              onNone={() => setUapsSel(new Set())}
            />
            <FilterList
              title="Gaps"
              items={(d?.gaps ?? []).filter((g) => uapsSel.has(g.uap_id))}
              selected={gapsSel}
              onToggle={(id) => toggle(gapsSel, setGapsSel, id)}
              onAll={() => setGapsSel(new Set((d?.gaps ?? []).map((x) => x.id)))}
              onNone={() => setGapsSel(new Set())}
            />
            <div>
              <div className="font-medium text-sm mb-2">Période</div>
              <div className="flex flex-wrap gap-1">
                {([
                  ["week", "S-1"],
                  ["month", "M-1"],
                  ["year", "A-1"],
                  ["all", "Tout"],
                ] as [Period, string][]).map(([v, l]) => (
                  <Button key={v} size="sm" variant={period === v ? "default" : "outline"} onClick={() => setPeriod(v)}>
                    {l}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Kpi label="Note globale moyenne" value={`${pct(avgGlobal)}%`} sub={`${avgGlobal.toFixed(2)}/5`} tone={pct(avgGlobal)} />
          <Kpi label="Audits (filtre)" value={String(completed.length)} sub={`${filteredAudits.length} au total`} />
          <Kpi label="Actions ouvertes" value={String(openActions)} sub={`${overdueActions} en retard`} tone={overdueActions > 0 ? 0 : 100} />
          <Kpi label="Actions clôturées" value={String(doneActions)} tone={100} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Radar 5S</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radar}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="criteria" />
                  <PolarRadiusAxis domain={[0, 5]} />
                  <Radar dataKey="score" stroke="var(--color-chart-1)" fill="var(--color-chart-1)" fillOpacity={0.4} />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Évolution des scores</CardTitle></CardHeader>
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

          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Classement des sites</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bySite}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 5]} />
                  <Tooltip />
                  <Bar dataKey="score" fill="var(--color-chart-2)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Galerie photos ({filteredPhotos.length})</CardTitle></CardHeader>
            <CardContent>
              {filteredPhotos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune photo pour ce filtre.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {filteredPhotos.map((p) => (
                    <Link
                      key={p.id}
                      to="/audits/$id"
                      params={{ id: p.audit_id }}
                      className="group relative block rounded overflow-hidden border"
                    >
                      <img src={`/api/uploads/${p.file_path}`} alt="" className="w-full aspect-square object-cover" />
                      {p.comment && (
                        <div className="absolute inset-x-0 bottom-0 bg-black/70 text-white text-xs p-1 truncate opacity-0 group-hover:opacity-100 transition">
                          {p.comment}
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}

function FilterList({
  title, items, selected, onToggle, onAll, onNone,
}: {
  title: string;
  items: { id: string; name: string }[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onAll: () => void;
  onNone: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="font-medium text-sm">{title}</div>
        <div className="flex gap-1">
          <button className="text-[10px] uppercase text-muted-foreground hover:text-foreground" onClick={onAll}>Tous</button>
          <span className="text-muted-foreground">·</span>
          <button className="text-[10px] uppercase text-muted-foreground hover:text-foreground" onClick={onNone}>Aucun</button>
        </div>
      </div>
      <div className="max-h-32 overflow-y-auto space-y-1 border rounded p-2">
        {items.length === 0 && <p className="text-xs text-muted-foreground">Aucun</p>}
        {items.map((it) => (
          <Label key={it.id} className="flex items-center gap-2 cursor-pointer text-sm font-normal">
            <Checkbox checked={selected.has(it.id)} onCheckedChange={() => onToggle(it.id)} />
            <span className="truncate">{it.name}</span>
          </Label>
        ))}
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: number }) {
  const toneClass =
    tone == null ? "text-foreground" : tone >= 75 ? scoreText(4) : tone >= 50 ? scoreText(2.7) : scoreText(1);
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`text-3xl font-bold mt-1 ${toneClass}`}>{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}
