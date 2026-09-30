import fs from "node:fs";
import path from "node:path";
import type { CounterData } from "./types";

export function readCounterData(): CounterData {
  const file = path.join(process.cwd(), "data", "versions.json");
  return JSON.parse(fs.readFileSync(file, "utf8")) as CounterData;
}
