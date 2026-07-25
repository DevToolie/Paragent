import { mkdir, appendFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { MetricRow } from "./types.js";

export class MetricsEmitter {
  private readonly rows: MetricRow[] = [];

  constructor(private readonly outPath?: string) {}

  emit(row: MetricRow): void {
    this.rows.push(row);
  }

  getRows(): readonly MetricRow[] {
    return this.rows;
  }

  async flush(): Promise<void> {
    if (!this.outPath) return;
    await mkdir(path.dirname(this.outPath), { recursive: true });
    const body =
      this.rows.map((r) => JSON.stringify(r)).join("\n") +
      (this.rows.length ? "\n" : "");
    await writeFile(this.outPath, body, "utf8");
  }

  async appendFlush(): Promise<void> {
    if (!this.outPath) return;
    await mkdir(path.dirname(this.outPath), { recursive: true });
    const body =
      this.rows.map((r) => JSON.stringify(r)).join("\n") +
      (this.rows.length ? "\n" : "");
    await appendFile(this.outPath, body, "utf8");
    this.rows.length = 0;
  }
}

export async function readMetricNdjson(filePath: string): Promise<MetricRow[]> {
  const { readFile } = await import("node:fs/promises");
  let text: string;
  try {
    text = await readFile(filePath, "utf8");
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") return [];
    throw err;
  }
  const rows: MetricRow[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    rows.push(JSON.parse(trimmed) as MetricRow);
  }
  return rows;
}
