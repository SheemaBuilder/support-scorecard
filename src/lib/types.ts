export interface EngineerMetrics {
  name: string;
  cesPercent: number;
  avgPcc: number;
  closed: number;
  open: number;
  openGreaterThan14: number;
  closedLessThan7: number;
  closedEqual1: number;
  participationRate: number;
  linkCount: number;
  citationCount: number;
  creationCount: number;
  enterprisePercent: number;
  technicalPercent: number;
  surveyCount: number;
}

export interface PerformanceMetric {
  label: string;
  value: number;
  maxValue?: number;
  color?: string;
}

export interface RadarChartData {
  metrics: PerformanceMetric[];
  title: string;
  subtitle?: string;
}

export interface ComparisonData {
  current: RadarChartData;
  previous: RadarChartData;
}

export interface DateRange {
  label: string;
  value: string;
  start: Date;
  end: Date;
  tableName?: string; // Optional table name for monthly tables
}

export interface AlertItem {
  id: string;
  type: "warning" | "info" | "error";
  message: string;
  timestamp: Date;
}
