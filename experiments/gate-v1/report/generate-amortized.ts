/**
 * Amortized-cost report generator from metrics NDJSON.
 * Empty scaffold (zeros + no_data) when input is missing or empty — never invents rates.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildGateReport,
  amortizedTokensOverN,
} from "../../../src/metrics/aggregate.js";
import { readMetricNdjson } from "../../../src/metrics/emitter.js";
import type { GateReportSection, MetricRow } from "../../../src/metrics/types.js";

export interface ReportPaths {
  json: string;
  csv: string;
  html: string;
  svg: string;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderSvg(
  points: Array<{
    n: number;
    amortized_tokens: number;
    program_build_paid?: boolean;
  }>,
): string {
  const width = 640;
  const height = 320;
  const pad = 40;
  if (points.length === 0) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#f7f7f7"/>
  <text x="${width / 2}" y="${height / 2}" text-anchor="middle" fill="#666" font-family="sans-serif" font-size="14">no_data — amortized tokens/task</text>
</svg>
`;
  }
  const xs = points.map((p) => p.n);
  const ys = points.map((p) => p.amortized_tokens);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = 0;
  const maxY = Math.max(...ys, 1);
  const sx = (n: number) =>
    pad + ((n - minX) / Math.max(maxX - minX, 1)) * (width - 2 * pad);
  const sy = (v: number) =>
    height - pad - ((v - minY) / Math.max(maxY - minY, 1)) * (height - 2 * pad);
  const poly = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.n)},${sy(p.amortized_tokens)}`)
    .join(" ");
  // A one-time build payment is where the curve steps *up*. Marked rather than
  // smoothed: a task recompiled after churn paid full price twice, and a plot
  // showing only the decline overstates the result (#123).
  const payments = points
    .filter((p) => p.program_build_paid)
    .map(
      (p) =>
        `<circle cx="${sx(p.n)}" cy="${sy(p.amortized_tokens)}" r="4" fill="#b23" />`,
    )
    .join("\n  ");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#ffffff"/>
  <path d="${poly}" fill="none" stroke="#222" stroke-width="2"/>
  ${payments}
  <text x="${pad}" y="24" font-family="sans-serif" font-size="14" fill="#222">amortized tokens/task over N</text>
  <text x="${pad}" y="40" font-family="sans-serif" font-size="11" fill="#b23">● one-time program-build payment</text>
</svg>
`;
}

function renderCsv(sections: GateReportSection[]): string {
  const header = "name,status,value,numerator,denominator,formula";
  const lines = sections.map((s) => {
    const value = s.value === null ? "" : String(s.value);
    const num = s.numerator ?? "";
    const den = s.denominator ?? "";
    return [
      JSON.stringify(s.name),
      s.status,
      value,
      num,
      den,
      JSON.stringify(s.formula),
    ].join(",");
  });
  return [header, ...lines].join("\n") + "\n";
}

function renderHtml(
  report: ReturnType<typeof buildGateReport>,
  svgRelative: string,
): string {
  const rows = report.metrics
    .map(
      (m) => `<tr>
  <td>${escapeXml(m.name)}</td>
  <td>${escapeXml(m.status)}</td>
  <td>${m.value === null ? "null" : escapeXml(String(m.value))}</td>
  <td>${escapeXml(m.formula)}</td>
</tr>`,
    )
    .join("\n");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Gate-v1 amortized report</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; color: #222; }
    table { border-collapse: collapse; width: 100%; max-width: 960px; }
    th, td { border: 1px solid #ccc; padding: 0.4rem 0.6rem; text-align: left; }
    th { background: #f0f0f0; }
    .meta { color: #555; margin-bottom: 1rem; }
  </style>
</head>
<body>
  <h1>Gate-v1 amortized report</h1>
  <p class="meta">generated_at=${escapeXml(report.generated_at)} · step_rows=${report.row_counts.step} · run_rows=${report.row_counts.run}</p>
  <p class="meta">Empty or unwired inputs yield status=no_data and null values — never invented rates.</p>
  <p class="meta">amortization: ${report.amortization.payments} one-time program-build payment(s) across ${report.amortization.distinct_builds} distinct build(s)${report.amortization.payments === 0 ? " — the amortized curve is no_data until one is measured" : ""}.</p>
  <table>
    <thead><tr><th>metric</th><th>status</th><th>value</th><th>formula</th></tr></thead>
    <tbody>
${rows}
    </tbody>
  </table>
  <h2>Amortized tokens chart</h2>
  <img src="${escapeXml(svgRelative)}" alt="amortized tokens over N" width="640" height="320"/>
</body>
</html>
`;
}

export async function writeReport(
  rows: readonly MetricRow[],
  outDir: string,
): Promise<ReportPaths> {
  await mkdir(outDir, { recursive: true });
  const report = buildGateReport(rows);
  const amortized = amortizedTokensOverN(rows);

  const paths: ReportPaths = {
    json: path.join(outDir, "report.json"),
    csv: path.join(outDir, "report.csv"),
    html: path.join(outDir, "report.html"),
    svg: path.join(outDir, "amortized.svg"),
  };

  await writeFile(paths.json, JSON.stringify(report, null, 2) + "\n", "utf8");
  await writeFile(paths.csv, renderCsv(report.metrics), "utf8");
  await writeFile(paths.svg, renderSvg(amortized.points), "utf8");
  await writeFile(
    paths.html,
    renderHtml(report, path.basename(paths.svg)),
    "utf8",
  );
  return paths;
}

async function main(): Promise<void> {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const gateRoot = path.resolve(__dirname, "..");
  const outDir = path.join(gateRoot, "out", "report");
  const ndjsonPath = path.join(gateRoot, "out", "metrics.ndjson");
  const rows = await readMetricNdjson(ndjsonPath);
  const paths = await writeReport(rows, outDir);
  console.log(
    JSON.stringify({
      rows: rows.length,
      status: rows.length === 0 ? "no_data_scaffold" : "computed_from_ndjson",
      ndjson: ndjsonPath,
      paths,
    }),
  );
}

const isDirect =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirect) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
