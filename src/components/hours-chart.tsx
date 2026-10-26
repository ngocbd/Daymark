import { useEffect, useState } from "react";

export type HourBar = { label: string; hours: number };

export function HoursChart({ data }: { data: HourBar[] }) {
  const [lib, setLib] = useState<typeof import("recharts") | null>(null);

  useEffect(() => {
    let live = true;
    void import("recharts").then((mod) => {
      if (live) setLib(mod);
    });
    return () => {
      live = false;
    };
  }, []);

  const peak = Math.max(8, ...data.map((row) => row.hours));

  if (!lib) {
    return <div className="h-56 rounded-2xl bg-paper" aria-hidden="true" />;
  }

  const { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } = lib;

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap="28%">
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--color-muted)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, Math.ceil(peak)]}
            width={28}
            tick={{ fill: "var(--color-muted)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "var(--color-primary-soft)" }}
            formatter={(value) => [`${Number(value).toFixed(1)} h`, "Worked"]}
            contentStyle={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-line)",
              borderRadius: 12,
              color: "var(--color-ink)",
              fontSize: 13,
            }}
          />
          <Bar dataKey="hours" fill="var(--color-primary)" radius={[8, 8, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
