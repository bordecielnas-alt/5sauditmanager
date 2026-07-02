import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { pct, scoreText } from "@/lib/scoring";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, PolarAngleAxis, PolarGrid,
  Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, PolarRadiusAxis,
} from "recharts";
import { format, parseISO } from "date-fns";

export const Route = createFileRoute("/")({ component: DashboardPage });

async function fetchDashboard() {
  const [audits, actions, criteria, responses, workshops, zones] = await Promise.all([
    supabase.from("audits").select("*").order("audit_date", { ascending: false }),
    supabase.from("corrective_actions").select("*"),
    supabase.from("criteria").select("*").order("order_index"),
    supabase.from("audit_responses").select("*"),
    supabase.from("workshops").select("*"),
    supabase.from("zones").select("*"),
  ]);
  return {
    audits: audits.data ?? [],
    actions: actions.data ?? [],
    criteria: criteria.data ?? [],
    responses: responses.data ?? [],
    workshops: workshops.data ?? [],
    zones: zones.data ?? [],
  };
}

function DashboardPage() {
  const { data } = useQuery({ queryKey: ["dashboard"], queryFn: fetchDashboard });
  const d = data;

  const completed = d?.audits.filter((a) => a.status === "completed") ?? [];
  const avgGlobal =
    completed.length > 0
      ? completed.reduce((s, a) => s + Number(a.global_score ?? 0), 0) / completed.length
      : 0;

  const openActions = d?.actions.filter((a) => a.status !== "done").length ?? 0;
  const overdueActions =
    d?.actions.filter(
      (a) => a.status !== "done" && a.due_date && new Date(a.due_date) < new Date(),
    ).length ?? 0;
  const doneActions = d?.actions.filter((a) => a.status === "done").length ?? 0;

  // Radar par critère
  const radar = (d?.criteria ?? []).map((c) => {
    const rs = (d?.responses ?? []).filter(
      (r) => r.criteria_id === c.id && r.score != null,
    );
    const avg = rs.length ? rs.reduce((s, r) => s + (r.score ?? 0), 0) / rs.length : 0;
    return { criteria: c.name.split(" - ")[0], score: Number(avg.toFixed(2)), fullMark: 5 };
  });

  // Note par atelier
  const byWorkshop = (d?.workshops ?? [])
    .map((w) => {
      const audits = completed.filter((a) => a.workshop_id === w.id);
      const avg =
        audits.length > 0
          ? audits.reduce((s, a) => s + Number(a.global_score ?? 0), 0) / audits.length
          : 0;
      return { name: w.name, score: Number(avg.toFixed(2)), count: audits.length };
    })
    .filter((r) => r.count > 0)
    .sort((a, b) => b.score - a.score);

  // Évolution
  const timeline = [...completed]
    .sort((a, b) => a.audit_date.localeCompare(b.audit_date))
    .map((a) => ({
      date: format(parseISO(a.audit_date), "dd/MM"),
      score: Number(a.global_score ?? 0),
    }));

  return (
    <AppLayout>
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        <PageHeader title="Dashboard 5S" description="Vue d'ensemble des performances 5S" />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Kpi label="Note globale moyenne" value={`${pct(avgGlobal)}%`} sub={`${avgGlobal.toFixed(2)}/5`} tone={pct(avgGlobal)} />
          <Kpi label="Audits réalisés" value={String(completed.length)} sub={`${d?.audits.length ?? 0} au total`} />
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
            <CardHeader><CardTitle>Classement des ateliers</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byWorkshop}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 5]} />
                  <Tooltip />
                  <Bar dataKey="score" fill="var(--color-chart-2)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
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
