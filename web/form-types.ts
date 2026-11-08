export type Field = {
  key: string;
  label: string;
  section?: string;
  type?: string;
  options?: { value: string; label: string }[];
  value?: any;
  required?: boolean;
};
export type Form = {
  title: string;
  fields: Field[];
  submit: (v: any) => Promise<any>;
  quote?: boolean;
  items?: any[];
  allocations?: { order: string; amount: number }[];
};
