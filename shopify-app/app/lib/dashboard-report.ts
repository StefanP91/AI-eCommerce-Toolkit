import type { DashboardStats } from "./products";

export type ReportRow = {
  title: string;
  handle: string;
  status: string;
  seoScore: number;
  metaTitle: string;
  metaDescription: string;
};

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildDashboardReportCsv(
  stats: DashboardStats,
  rows: ReportRow[],
  exportedAt: string,
): string {
  const catalogShare = stats.totalProducts
    ? Math.round((stats.productsOptimized / stats.totalProducts) * 100)
    : 0;

  const lines = [
    "AI Commerce Suite - Dashboard Report",
    `Exported at,${escapeCsv(exportedAt)}`,
    "Period,Last 7 days",
    "",
    "Summary",
    "Metric,Value",
    `Total products,${stats.totalProducts}`,
    `Products optimized,${stats.productsOptimized}`,
    `Optimized share,${catalogShare}%`,
    `Time saved (hours),${stats.timeSavedHours}`,
    `Average SEO score,${stats.avgSeoScore}`,
    `CTR estimate,${stats.ctrEstimate}%`,
    "",
    "SEO breakdown",
    "Category,Share",
    `Excellent,${stats.seoBreakdown.excellent}%`,
    `Good,${stats.seoBreakdown.good}%`,
    `Needs work,${stats.seoBreakdown.needsWork}%`,
    `Poor,${stats.seoBreakdown.poor}%`,
    "",
    "Products to optimize",
    "Product,Type,Status,SEO Score",
    ...stats.recentActivity.map((item) =>
      [
        escapeCsv(item.title),
        escapeCsv(item.type),
        escapeCsv(item.status),
        String(item.seoScore),
      ].join(","),
    ),
    "",
    "Products",
    "Title,Handle,Status,SEO Score,Meta Title,Meta Description",
    ...rows.map((row) =>
      [
        escapeCsv(row.title),
        escapeCsv(row.handle),
        escapeCsv(row.status),
        String(row.seoScore),
        escapeCsv(row.metaTitle),
        escapeCsv(row.metaDescription),
      ].join(","),
    ),
  ];

  return `${lines.join("\r\n")}\r\n`;
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
