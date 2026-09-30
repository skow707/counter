export const config = {
  academicYear: process.env.ACADEMIC_YEAR ?? "2026/27",
  totemUrl: process.env.TOTEM_URL ?? "https://www.abarc.it/totem/",
  timeoutMs: Number(process.env.CRAWLER_TIMEOUT_MS ?? 20_000),
  retries: Number(process.env.CRAWLER_RETRIES ?? 3),
  userAgent: "ABARC-Orario-Counter/1.0 (+https://github.com/)"
};
