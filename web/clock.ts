let reference: string | null = null;
export const setReferenceDate = (value: string | null) => {
  reference = value;
};
export const businessNow = () =>
  reference ? new Date(reference + "T10:00:00+08:00") : new Date();
export const businessDay = () =>
  businessNow().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
