export const SCORE_THRESHOLD = 3; // <3/5 = action corrective auto

export function pct(score: number | null | undefined): number {
  if (score == null) return 0;
  return Math.round((score / 5) * 100);
}

export function scoreColor(score: number | null | undefined): "success" | "warning" | "danger" | "muted" {
  if (score == null) return "muted";
  const p = pct(score);
  if (p >= 75) return "success";
  if (p >= 50) return "warning";
  return "danger";
}

export function scoreBg(score: number | null | undefined): string {
  const c = scoreColor(score);
  return {
    success: "bg-[var(--color-success)] text-[var(--color-success-foreground)]",
    warning: "bg-[var(--color-warning)] text-[var(--color-warning-foreground)]",
    danger: "bg-[var(--color-danger)] text-[var(--color-danger-foreground)]",
    muted: "bg-muted text-muted-foreground",
  }[c];
}

export function scoreText(score: number | null | undefined): string {
  const c = scoreColor(score);
  return {
    success: "text-[var(--color-success)]",
    warning: "text-[var(--color-warning)]",
    danger: "text-[var(--color-danger)]",
    muted: "text-muted-foreground",
  }[c];
}
