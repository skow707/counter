export type CheckStatus = "changed" | "unchanged";

export type ScheduleVersion = {
  id: number;
  versionNumber: number;
  detectedAt: string;
  sourceUrl: string;
  lastModified: string | null;
  etag: string | null;
  contentHash: string | null;
  contentType: string | null;
  changeKey: string;
};

export type CounterData = {
  academicYear: string;
  versions: ScheduleVersion[];
  lastCheck: {
    checkedAt: string;
    status: CheckStatus;
    lastModified: string | null;
    message?: string;
  } | null;
};
