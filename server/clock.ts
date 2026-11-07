// A reference clock is valid only for the explicitly isolated fixture database.
export const referenceDate =
  process.env.REFERENCE_DATE &&
  new URL(process.env.DATABASE_URL || "postgresql://localhost/vesta")
    .pathname === "/vesta_reference"
    ? process.env.REFERENCE_DATE
    : null;
export const businessNow = () =>
  referenceDate ? new Date(referenceDate + "T10:00:00+08:00") : new Date();
export const businessDay = () =>
  businessNow().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
