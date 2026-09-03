// Chart data only — no business/application data.
// All business data now comes from the backend API.

export const recoveryChartData = [
  { date: "Aug 24", atRisk: 2100000, recovered: 1290000, rate: 61.4 },
  { date: "Aug 25", atRisk: 1850000, recovered: 1180000, rate: 63.8 },
  { date: "Aug 26", atRisk: 2340000, recovered: 1450000, rate: 62.0 },
  { date: "Aug 27", atRisk: 1920000, recovered: 1220000, rate: 63.5 },
  { date: "Aug 28", atRisk: 2050000, recovered: 1310000, rate: 63.9 },
  { date: "Aug 29", atRisk: 1780000, recovered: 1080000, rate: 60.7 },
  { date: "Aug 30", atRisk: 1870000, recovered: 1150000, rate: 61.5 },
];

export const recoveryTypeData = [
  { name: "Failed Payments", value: 4850000, fill: "#2563EB" },
  { name: "Abandoned Checkouts", value: 3200000, fill: "#7C3AED" },
  { name: "Subscription Failures", value: 2650000, fill: "#0EA5E9" },
];

export const analyticsData = {
  weekly: [
    { day: "Mon", atRisk: 1850000, recovered: 1140000 },
    { day: "Tue", atRisk: 2100000, recovered: 1380000 },
    { day: "Wed", atRisk: 1920000, recovered: 1250000 },
    { day: "Thu", atRisk: 2340000, recovered: 1510000 },
    { day: "Fri", atRisk: 1780000, recovered: 1120000 },
    { day: "Sat", atRisk: 1450000, recovered: 890000 },
    { day: "Sun", atRisk: 1870000, recovered: 1150000 },
  ],
  interventions: [
    { type: "Smart Retry", count: 284, success: 198, rate: 70 },
    { type: "UPI Fallback", count: 156, success: 112, rate: 72 },
    { type: "WhatsApp Link", count: 203, success: 134, rate: 66 },
    { type: "Email Recovery", count: 318, success: 175, rate: 55 },
    { type: "Grace Period", count: 89, success: 61, rate: 69 },
    { type: "Manual Review", count: 34, success: 28, rate: 82 },
  ]
};
