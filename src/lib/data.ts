import { EngineerMetrics, RadarChartData, DateRange, AlertItem } from "./types";

export const engineerData: EngineerMetrics[] = [
  {
    name: "Sheema Parwaz",
    cesPercent: 80.0,
    avgPcc: 24.5,
    closed: 64,
    open: 12,
    openGreaterThan14: 8,
    closedLessThan7: 44.0,
    closedEqual1: 19.0,
    participationRate: 4.3, // Ov. QA (average of communication, resp quality, tech accuracy)
    linkCount: 4.5, // Communication (1-5 scale)
    citationCount: 4.2, // Resp. Quality (1-5 scale)
    creationCount: 4.2, // Tech. Accuracy (1-5 scale)
    enterprisePercent: 25.0,
    technicalPercent: 42.2,
    surveyCount: 5,
  },
  {
    name: "Manish Sharma",
    cesPercent: 100.0,
    avgPcc: 8.2,
    closed: 92,
    open: 18,
    openGreaterThan14: 12,
    closedLessThan7: 82.0,
    closedEqual1: 50.0,
    participationRate: 3.9, // Ov. QA (average of 4.1, 3.8, 3.8)
    linkCount: 4.1, // Communication (1-5 scale)
    citationCount: 3.8, // Resp. Quality (1-5 scale)
    creationCount: 3.8, // Tech. Accuracy (1-5 scale)
    enterprisePercent: 26.0,
    technicalPercent: 36.8,
    surveyCount: 7,
  },
  {
    name: "Parth Sharma",
    cesPercent: 85.0,
    avgPcc: 7.7,
    closed: 136,
    open: 22,
    openGreaterThan14: 15,
    closedLessThan7: 75.0,
    closedEqual1: 38.0,
    participationRate: 3.7, // Ov. QA (average of 3.9, 3.6, 3.6)
    linkCount: 3.9, // Communication (1-5 scale)
    citationCount: 3.6, // Resp. Quality (1-5 scale)
    creationCount: 3.6, // Tech. Accuracy (1-5 scale)
    enterprisePercent: 13.0,
    technicalPercent: 37.0,
    surveyCount: 20,
  },
  {
    name: "Jared Beckler",
    cesPercent: 100.0,
    avgPcc: 19.1,
    closed: 80,
    open: 14,
    openGreaterThan14: 6,
    closedLessThan7: 69.0,
    closedEqual1: 21.0,
    participationRate: 4.4, // Ov. QA (average of 4.6, 4.3, 4.3)
    linkCount: 4.6, // Communication (1-5 scale)
    citationCount: 4.3, // Resp. Quality (1-5 scale)
    creationCount: 4.3, // Tech. Accuracy (1-5 scale)
    enterprisePercent: 45.0,
    technicalPercent: 59.6,
    surveyCount: 3,
  },
  {
    name: "Alex Bridgeman",
    cesPercent: 71.0,
    avgPcc: 16.6,
    closed: 57,
    open: 31,
    openGreaterThan14: 24,
    closedLessThan7: 65.0,
    closedEqual1: 23.0,
    participationRate: 4.2, // Overall Quality
    linkCount: 3.5, // Communication (1-5 scale)
    citationCount: 4.0, // Resp. Quality (1-5 scale)
    creationCount: 5.0, // Tech. Accuracy (1-5 scale)
    enterprisePercent: 34.5,
    technicalPercent: 48.0,
    surveyCount: 7,
  },
  {
    name: "Fernando Duran",
    cesPercent: 89.0,
    avgPcc: 18.6,
    closed: 49,
    open: 19,
    openGreaterThan14: 11,
    closedLessThan7: 55.0,
    closedEqual1: 18.0,
    participationRate: 3.8, // Ov. QA (average of 3.9, 3.7, 3.8)
    linkCount: 3.9, // Communication (1-5 scale)
    citationCount: 3.7, // Resp. Quality (1-5 scale)
    creationCount: 3.8, // Tech. Accuracy (1-5 scale)
    enterprisePercent: 53.0,
    technicalPercent: 44.0,
    surveyCount: 9,
  },
  {
    name: "Rahul Joshi",
    cesPercent: 88.0,
    avgPcc: 8.1,
    closed: 114,
    open: 16,
    openGreaterThan14: 9,
    closedLessThan7: 88.0,
    closedEqual1: 21.0,
    participationRate: 4.1, // Ov. QA (average of 4.2, 4.0, 4.1)
    linkCount: 4.2, // Communication (1-5 scale)
    citationCount: 4.0, // Resp. Quality (1-5 scale)
    creationCount: 4.1, // Tech. Accuracy (1-5 scale)
    enterprisePercent: 6.0,
    technicalPercent: 35.0,
    surveyCount: 8,
  },
  {
    name: "Akash Singh",
    cesPercent: 67.0,
    avgPcc: 18.1,
    closed: 87,
    open: 25,
    openGreaterThan14: 18,
    closedLessThan7: 40.0,
    closedEqual1: 23.0,
    participationRate: 3.5, // Ov. QA (average of 3.6, 3.4, 3.5)
    linkCount: 3.6, // Communication (1-5 scale)
    citationCount: 3.4, // Resp. Quality (1-5 scale)
    creationCount: 3.5, // Tech. Accuracy (1-5 scale)
    enterprisePercent: 13.0,
    technicalPercent: 45.5,
    surveyCount: 3,
  },
];

export const averageMetrics: EngineerMetrics = {
  name: "Team Average",
  cesPercent: 82.0, // Updated Team Average CES
  avgPcc: 15.3,
  closed: 85,
  open: 19.6,
  openGreaterThan14: 12.9,
  closedLessThan7: 66.0,
  closedEqual1: 28.0,
  participationRate: 3.9, // Ov. QA (average of all engineers)
  linkCount: 4.0, // Communication (average of all engineers)
  citationCount: 3.8, // Resp. Quality (average of all engineers)
  creationCount: 3.8, // Tech. Accuracy (average of all engineers)
  enterprisePercent: 25.0,
  technicalPercent: 43.3,
  surveyCount: 7.75, // Average of actual survey counts: (5+7+20+3+7+9+8+3)/8 = 7.75
};

export const dateRanges: DateRange[] = [
  {
    label: "June 2025",
    value: "june-2025",
    start: new Date(2025, 5, 1),
    end: new Date(2025, 5, 30),
  },
  {
    label: "July 2024",
    value: "july-2024",
    start: new Date(2024, 6, 1),
    end: new Date(2024, 6, 31),
  },
  {
    label: "June 2024",
    value: "june-2024",
    start: new Date(2024, 5, 1),
    end: new Date(2024, 5, 30),
  },
];

export const alerts: AlertItem[] = [
  {
    id: "1",
    type: "warning",
    message: "CES scores below target for 2 engineers",
    timestamp: new Date(),
  },
  {
    id: "2",
    type: "info",
    message: "Monthly performance review due",
    timestamp: new Date(Date.now() - 86400000),
  },
];
