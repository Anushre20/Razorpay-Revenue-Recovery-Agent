export const failedTransactions = [
  { id: "TXN-2847361", merchant: "Zomato Foods Pvt Ltd", customer: "Rahul Sharma", amount: 89400, failureReason: "Insufficient funds", riskScore: 87, status: "At Risk", category: "Failed Payment", time: "2 min ago", phone: "+91 98765 43210" },
  { id: "TXN-2847289", merchant: "Swiggy India", customer: "Priya Patel", amount: 156000, failureReason: "Card expired", riskScore: 72, status: "In Recovery", category: "Failed Payment", time: "5 min ago", phone: "+91 87654 32109" },
  { id: "TXN-2847201", merchant: "Flipkart Internet", customer: "Amit Kumar", amount: 342000, failureReason: "Bank timeout", riskScore: 45, status: "Recovered", category: "Abandoned Checkout", time: "12 min ago", phone: "+91 76543 21098" },
  { id: "TXN-2847155", merchant: "Meesho Network", customer: "Sneha Reddy", amount: 78500, failureReason: "Authentication failed", riskScore: 91, status: "At Risk", category: "Failed Payment", time: "18 min ago", phone: "+91 65432 10987" },
  { id: "TXN-2847098", merchant: "Nykaa Fashion", customer: "Kavitha Nair", amount: 215000, failureReason: "Subscription lapsed", riskScore: 63, status: "In Recovery", category: "Subscription", time: "25 min ago", phone: "+91 54321 09876" },
  { id: "TXN-2846987", merchant: "Dunzo Daily", customer: "Suresh Menon", amount: 45000, failureReason: "Insufficient funds", riskScore: 78, status: "At Risk", category: "Failed Payment", time: "31 min ago", phone: "+91 43210 98765" },
  { id: "TXN-2846876", merchant: "Groww Invest", customer: "Deepika Singh", amount: 500000, failureReason: "Card blocked", riskScore: 95, status: "At Risk", category: "Failed Payment", time: "42 min ago", phone: "+91 32109 87654" },
  { id: "TXN-2846765", merchant: "Ola Cabs", customer: "Vikram Joshi", amount: 125000, failureReason: "Network error", riskScore: 38, status: "Recovered", category: "Failed Payment", time: "58 min ago", phone: "+91 21098 76543" },
  { id: "TXN-2846654", merchant: "PhonePe Commerce", customer: "Ananya Iyer", amount: 67800, failureReason: "Recurring charge failed", riskScore: 82, status: "In Recovery", category: "Subscription", time: "1h 15m ago", phone: "+91 19876 54321" },
  { id: "TXN-2846543", merchant: "Urban Company", customer: "Rajesh Verma", amount: 389000, failureReason: "Abandoned checkout", riskScore: 55, status: "Recovered", category: "Abandoned Checkout", time: "1h 40m ago", phone: "+91 98712 34567" },
  { id: "TXN-2846432", merchant: "Byju's Learning", customer: "Meena Krishnan", amount: 750000, failureReason: "Insufficient funds", riskScore: 89, status: "At Risk", category: "Subscription", time: "2h ago", phone: "+91 87601 23456" },
  { id: "TXN-2846321", merchant: "Zepto Delivery", customer: "Arjun Nambiar", amount: 34500, failureReason: "Card expired", riskScore: 67, status: "In Recovery", category: "Failed Payment", time: "2h 30m ago", phone: "+91 76590 12345" },
];

export const merchants = [
  { id: "M001", name: "Zomato Foods Pvt Ltd", logo: "Z", color: "#EF4444", atRisk: 4250000, recovered: 2890000, recoveryRate: 68, activeCases: 23, trend: "+12%" },
  { id: "M002", name: "Flipkart Internet", logo: "F", color: "#F59E0B", atRisk: 3120000, recovered: 1970000, recoveryRate: 63, activeCases: 17, trend: "+8%" },
  { id: "M003", name: "Swiggy India", logo: "S", color: "#10B981", atRisk: 2870000, recovered: 1890000, recoveryRate: 66, activeCases: 19, trend: "+15%" },
  { id: "M004", name: "Groww Invest", logo: "G", color: "#6366F1", atRisk: 1980000, recovered: 1100000, recoveryRate: 56, activeCases: 11, trend: "-3%" },
  { id: "M005", name: "Byju's Learning", logo: "B", color: "#EC4899", atRisk: 1750000, recovered: 1250000, recoveryRate: 71, activeCases: 8, trend: "+22%" },
  { id: "M006", name: "Nykaa Fashion", logo: "N", color: "#F97316", atRisk: 1480000, recovered: 980000, recoveryRate: 66, activeCases: 14, trend: "+5%" },
];

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

export const aiDiagnoses: Record<string, any> = {
  "TXN-2847361": {
    problem: "Card declined due to insufficient funds — high likelihood of bounce back",
    rootCause: "User's salary credit delayed by 3 days (payroll vendor lag). Historical pattern shows 4 prior successes post-retry within 72h window.",
    confidence: 89,
    recommendedAction: "Schedule 3 retry attempts at 24h intervals. Send soft SMS nudge at T+1h. Offer UPI fallback as alternate payment.",
    urgency: "High",
    alternatePayments: ["UPI", "Net Banking", "EMI"],
    estimatedRecovery: 89400,
    agentReasoning: "User has 8-month payment history with merchant. Last 3 failures recovered on retry within 48h. Bank: HDFC. Retry window optimal: 9AM–11AM IST."
  },
  "TXN-2847155": {
    problem: "3D Secure authentication failed — user did not complete OTP flow",
    rootCause: "OTP delivery failed (DND activated on phone). User session timed out at authentication step. Cart value suggests high intent.",
    confidence: 76,
    recommendedAction: "Send WhatsApp payment link. Offer direct debit via UPI VPA. Trigger email with fresh checkout link valid 24h.",
    urgency: "High",
    alternatePayments: ["WhatsApp Pay", "UPI", "Saved Cards"],
    estimatedRecovery: 78500,
    agentReasoning: "DND registry check confirms SMS blocked. WhatsApp delivery rate: 94% for this customer segment. Cart abandoned at payment step, not product selection."
  },
  "TXN-2847289": {
    problem: "Card expired — customer unaware, auto-renewal failed silently",
    rootCause: "Card expiry date: 07/2026 but new card not updated in saved credentials. Renewal notification sent but not actioned.",
    confidence: 94,
    recommendedAction: "Send card update request with tokenization link. Offer one-time UPI payment to resume subscription. Apply ₹50 grace discount.",
    urgency: "Medium",
    alternatePayments: ["Update Card", "UPI AutoPay", "Net Banking"],
    estimatedRecovery: 156000,
    agentReasoning: "Customer LTV: ₹24,300. Subscription tenure: 14 months. Churn risk if not recovered: 73%. Discount ROI: 340x."
  },
};

export const recoveryActions = [
  { id: "ACT-001", txnId: "TXN-2847361", action: "Smart Retry", reason: "Salary credit expected. Historical 4/4 retry success in similar pattern.", status: "Executed", result: "Pending bank response", time: "10 min ago", channel: "Auto" },
  { id: "ACT-002", txnId: "TXN-2847361", action: "UPI Reminder", reason: "SMS blocked; WhatsApp reachability 94%.", status: "Executed", result: "Message delivered", time: "8 min ago", channel: "WhatsApp" },
  { id: "ACT-003", txnId: "TXN-2847289", action: "Card Update Link", reason: "Expired card identified. Tokenization link sent.", status: "Executed", result: "Link opened", time: "15 min ago", channel: "Email" },
  { id: "ACT-004", txnId: "TXN-2847155", action: "Alternate Payment", reason: "Auth failure. UPI fallback offered.", status: "Pending", result: "Awaiting user action", time: "3 min ago", channel: "WhatsApp" },
  { id: "ACT-005", txnId: "TXN-2847098", action: "Subscription Grace", reason: "Long-term customer. 7-day grace + re-auth.", status: "Pending", result: "Grace period active", time: "20 min ago", channel: "Auto" },
  { id: "ACT-006", txnId: "TXN-2846765", action: "Retry", reason: "Bank timeout — transient error. Retry succeeded.", status: "Executed", result: "Payment recovered ✓", time: "52 min ago", channel: "Auto" },
  { id: "ACT-007", txnId: "TXN-2846432", action: "Escalation Hold", reason: "3 failed retries. Human review requested.", status: "Stopped", result: "Escalated to ops team", time: "2h ago", channel: "Manual" },
];

export const agentLogs = [
  { id: 1, time: "14:32:07", type: "DETECT", message: "New failure signal: TXN-2847361 | Merchant: Zomato | ₹894 | Reason: NSF", level: "info" },
  { id: 2, time: "14:32:08", type: "DIAGNOSE", message: "Analyzing customer history... 8-month tenure, 4 prior recoveries on retry", level: "info" },
  { id: 3, time: "14:32:09", type: "DIAGNOSE", message: "Bank: HDFC | DND: No | UPI linked: Yes | Confidence: 89%", level: "info" },
  { id: 4, time: "14:32:10", type: "DECIDE", message: "Strategy selected: Smart retry + UPI fallback. Estimated recovery: ₹894", level: "success" },
  { id: 5, time: "14:32:11", type: "POLICY", message: "Checking guardrails: retry_limit=3 ✓ | amount_within_range ✓ | cooldown_period ✓", level: "info" },
  { id: 6, time: "14:32:12", type: "POLICY", message: "Human approval not required (amount < ₹10,000 threshold)", level: "success" },
  { id: 7, time: "14:32:13", type: "EXECUTE", message: "Retry #1 scheduled for T+24h | WhatsApp notification queued", level: "info" },
  { id: 8, time: "14:32:14", type: "EXECUTE", message: "UPI fallback link generated: rzp.io/p/2847361 | Expires: 24h", level: "info" },
  { id: 9, time: "14:33:01", type: "DETECT", message: "New failure signal: TXN-2847155 | Merchant: Meesho | ₹785 | Reason: Auth fail", level: "info" },
  { id: 10, time: "14:33:02", type: "DIAGNOSE", message: "3DS failure detected. OTP delivery check: DND registered on +91 65432 10987", level: "warn" },
  { id: 11, time: "14:33:03", type: "DECIDE", message: "Switching to WhatsApp payment link. Cart value justifies alternate channel cost.", level: "success" },
  { id: 12, time: "14:33:04", type: "POLICY", message: "Channel switch approved: within daily limit (8/50 WhatsApp sends)", level: "success" },
  { id: 13, time: "14:33:05", type: "EXECUTE", message: "WhatsApp message dispatched. Tracking link ID: WA-88291", level: "info" },
  { id: 14, time: "14:34:18", type: "VERIFY", message: "TXN-2847201 RECOVERED ✓ | ₹3,420 received | Method: UPI | T+37min", level: "success" },
  { id: 15, time: "14:35:00", type: "DETECT", message: "Batch scan: 3 subscription failures detected (Nykaa, Byju's, PhonePe)", level: "info" },
];

export const auditTrail = [
  { id: "AUD-001", timestamp: "2026-08-30 14:32:14", txnId: "TXN-2847361", aiDecision: "Schedule retry + UPI fallback", reason: "NSF pattern, high historical recovery", policyCheck: "PASS", action: "Smart Retry + WhatsApp", result: "Pending", actor: "AI Agent" },
  { id: "AUD-002", timestamp: "2026-08-30 14:33:05", txnId: "TXN-2847155", aiDecision: "Switch to alternate channel", reason: "DND registered, OTP undeliverable", policyCheck: "PASS", action: "WhatsApp Payment Link", result: "Delivered", actor: "AI Agent" },
  { id: "AUD-003", timestamp: "2026-08-30 14:34:18", txnId: "TXN-2847201", aiDecision: "Retry via UPI", reason: "Transient bank timeout", policyCheck: "PASS", action: "UPI Retry", result: "RECOVERED ₹3,420", actor: "AI Agent" },
  { id: "AUD-004", timestamp: "2026-08-30 14:28:33", txnId: "TXN-2847289", aiDecision: "Card update + grace discount", reason: "Expired card, high LTV customer", policyCheck: "PASS", action: "Email + ₹50 Discount", result: "Link Opened", actor: "AI Agent" },
  { id: "AUD-005", timestamp: "2026-08-30 13:45:12", txnId: "TXN-2846432", aiDecision: "Escalate to human review", reason: "3 retry failures, high amount", policyCheck: "ESCALATED", action: "Ops Team Notified", result: "Under Review", actor: "AI Agent → Human" },
  { id: "AUD-006", timestamp: "2026-08-30 13:12:08", txnId: "TXN-2846765", aiDecision: "Immediate retry", reason: "Network error, transient failure", policyCheck: "PASS", action: "Automatic Retry", result: "RECOVERED ₹1,250", actor: "AI Agent" },
  { id: "AUD-007", timestamp: "2026-08-30 12:55:44", txnId: "TXN-2846543", aiDecision: "Abandoned checkout re-engagement", reason: "High cart value, 2h abandonment", policyCheck: "PASS", action: "Email + Push Notification", result: "RECOVERED ₹3,890", actor: "AI Agent" },
];

export const guardrails = [
  { id: "G001", category: "Retry Limits", rule: "Maximum 3 retries per transaction within 72 hours", status: "Active", triggeredToday: 2 },
  { id: "G002", category: "Retry Limits", rule: "Minimum 4-hour cooldown between consecutive retries", status: "Active", triggeredToday: 0 },
  { id: "G003", category: "Amount Limits", rule: "Auto-recovery only for amounts ≤ ₹25,000", status: "Active", triggeredToday: 5 },
  { id: "G004", category: "Amount Limits", rule: "Human approval required for amounts > ₹1,00,000", status: "Active", triggeredToday: 1 },
  { id: "G005", category: "Escalation Rules", rule: "Escalate if 3 consecutive retries fail", status: "Active", triggeredToday: 1 },
  { id: "G006", category: "Escalation Rules", rule: "Escalate if customer DND + no alternate payment method", status: "Active", triggeredToday: 0 },
  { id: "G007", category: "Stopping Rules", rule: "Stop recovery if customer explicitly opts out", status: "Active", triggeredToday: 0 },
  { id: "G008", category: "Stopping Rules", rule: "Stop if 5+ complaints from same customer in 7 days", status: "Active", triggeredToday: 0 },
  { id: "G009", category: "Human Approval", rule: "WhatsApp discount offers > ₹500 require manager sign-off", status: "Active", triggeredToday: 0 },
  { id: "G010", category: "Human Approval", rule: "New merchant onboarding recovery rules need ops review", status: "Active", triggeredToday: 0 },
];

export const blockedActions = [
  { id: "BLK-001", timestamp: "2026-08-30 13:22:15", txnId: "TXN-2846321", blockedAction: "4th retry attempt", blockReason: "Retry limit (3/3) reached", guardrail: "G001", status: "Blocked" },
  { id: "BLK-002", timestamp: "2026-08-30 11:45:33", txnId: "TXN-2846432", blockedAction: "Auto-recovery ₹3,890", blockReason: "Amount exceeds ₹25,000 auto limit", guardrail: "G003", status: "Escalated" },
  { id: "BLK-003", timestamp: "2026-08-30 10:12:07", txnId: "TXN-2846987", blockedAction: "WhatsApp discount ₹750", blockReason: "Discount > ₹500 requires approval", guardrail: "G009", status: "Pending Approval" },
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
