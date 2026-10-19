// ==========================================
// The numbers the app quotes about QI evidence
// ==========================================
// Every hint, guide, checker and chart that tells a trainee "how many" reads
// from here, so the app tells one story: a little data, often; a baseline of
// 10 to 12 points before the first change; no fixed number of PDSA cycles.

export const QI = {
    // Data points on the primary run chart
    BASELINE_MIN: 10,       // the run-chart rules start to mean something
    BASELINE_TARGET: 12,    // what to aim for before the first change
    SPC_MIN: 15,            // XmR limits are provisional below this
    SAMPLE_PER_POINT: '10 to 20',   // consecutive eligible patients per weekly point

    // Run-chart and SPC rules
    RUN_SHIFT: 6,           // consecutive points on one side of the median
    RUN_TREND: 5,           // consecutive points rising or falling
    SPC_RUN: 8,             // consecutive points on one side of the mean (XmR)

    // Evidence of iterative testing — RCEM sets no number; this is what most
    // first projects need to show a sustained shift.
    PDSA_TYPICAL: 3,

    // References in the literature section
    REFERENCES_MIN: 3,
    REFERENCES_GOOD: 5,
};

export const DATA_STORY = `Collect a little, often: one point a week (daily if the process is high volume), each from a small sample of ${QI.SAMPLE_PER_POINT} consecutive eligible patients, or every eligible patient if the EPR gives it for free. Aim for ${QI.BASELINE_MIN} to ${QI.BASELINE_TARGET} baseline points before your first change, then keep the same definition, sample and cadence throughout.`;
