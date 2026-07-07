import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useFilters, resolveSelection, type Period } from "@/lib/filter-store";
import { useMemo } from "react";

type Hier = {
  sites: { id: string; name: string }[];
  uaps: { id: string; site_id: string; name: string }[];
  gaps: { id: string; uap_id: string; name: string }[];
};

export function useResolvedFilters(hier: Hier | undefined) {
  const [f] = useFilters();
  return useMemo(() => {
    const sites = resolveSelection(f.sites, (hier?.sites ?? []).map((x) => x.id));
    const uaps = resolveSelection(f.uaps, (hier?.uaps ?? []).map((x) => x.id));
    const gaps = resolveSelection(f.gaps, (hier?.gaps ?? []).map((x) => x.id));
    return { sites, uaps, gaps, period: f.period };
  }, [f, hier]);
}

export function HierarchyFilter({
  hier,
  showPeriod = true,
}: {
  hier: Hier | undefined;
  showPeriod?: boolean;
}) {
  const [f, set] = useFilters();
  const sites = hier?.sites ?? [];
  const uapsAll = hier?.uaps ?? [];
  const gapsAll = hier?.gaps ?? [];

  const selSites = resolveSelection(f.sites, sites.map((x) => x.id));
  const selUaps = resolveSelection(f.uaps, uapsAll.map((x) => x.id));
  const selGaps = resolveSelection(f.gaps, gapsAll.map((x) => x.id));

  const visibleUaps = uapsAll.filter((u) => selSites.has(u.site_id));
  const visibleGaps = gapsAll.filter((g) => selUaps.has(g.uap_id));

  const toggle = (
    key: "sites" | "uaps" | "gaps",
    current: Set<string>,
    id: string,
  ) => {
    const n = new Set(current);
    if (n.has(id)) n.delete(id); else n.add(id);
    set({ [key]: Array.from(n) } as Partial<{ sites: string[]; uaps: string[]; gaps: string[] }>);
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Filtres</CardTitle>
      </CardHeader>
      <CardContent className={`grid gap-4 ${showPeriod ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
        <List
          title="Sites"
          items={sites}
          selected={selSites}
          onToggle={(id) => toggle("sites", selSites, id)}
          onAll={() => set({ sites: "all" })}
          onNone={() => set({ sites: [] })}
        />
        <List
          title="UAP"
          items={visibleUaps}
          selected={selUaps}
          onToggle={(id) => toggle("uaps", selUaps, id)}
          onAll={() => set({ uaps: "all" })}
          onNone={() => set({ uaps: [] })}
        />
        <List
          title="Gaps"
          items={visibleGaps}
          selected={selGaps}
          onToggle={(id) => toggle("gaps", selGaps, id)}
          onAll={() => set({ gaps: "all" })}
          onNone={() => set({ gaps: [] })}
        />
        {showPeriod && (
          <div>
            <div className="font-medium text-sm mb-2">Période</div>
            <div className="flex flex-wrap gap-1">
              {([
                ["week", "S-1"],
                ["month", "M-1"],
                ["year", "A-1"],
                ["all", "Tout"],
              ] as [Period, string][]).map(([v, l]) => (
                <Button
                  key={v}
                  size="sm"
                  variant={f.period === v ? "default" : "outline"}
                  onClick={() => set({ period: v })}
                >
                  {l}
                </Button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function List({
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
