type DailyViewsChartProps = {
  data: { date: string; views: number }[];
};

/**
 * Minimal, dependency-free bar chart. Days with no metrics render as
 * zero-height bars — the campaign period always has entries for every day.
 */
export function DailyViewsChart({ data }: DailyViewsChartProps) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No data for this campaign period.
      </p>
    );
  }

  const maxViews = Math.max(1, ...data.map((day) => day.views));
  const width = Math.max(320, data.length * 18);
  const height = 120;
  const barWidth = width / data.length;

  return (
    <div className="overflow-x-auto">
      <svg
        role="img"
        aria-label="Daily views across the campaign period"
        viewBox={`0 0 ${width} ${height + 24}`}
        width={width}
        height={height + 24}
        className="text-primary"
      >
        {data.map((day, index) => {
          const barHeight = (day.views / maxViews) * height;

          return (
            <g key={day.date}>
              <title>
                {day.date}: {day.views.toLocaleString()} views
              </title>
              <rect
                x={index * barWidth + 1}
                y={height - barHeight}
                width={Math.max(1, barWidth - 2)}
                height={barHeight}
                fill="currentColor"
                opacity={day.views === 0 ? 0.15 : 0.8}
              />
            </g>
          );
        })}
        <line
          x1={0}
          y1={height}
          x2={width}
          y2={height}
          stroke="currentColor"
          opacity={0.2}
        />
      </svg>

      <div className="mt-1 flex justify-between text-xs text-muted-foreground">
        <span>{data[0].date}</span>
        <span>{data[data.length - 1].date}</span>
      </div>
    </div>
  );
}
