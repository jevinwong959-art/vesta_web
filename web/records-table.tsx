import React, { createContext, useContext } from "react";
import { Search, FileText } from "lucide-react";

export const RecordsLanguage = createContext(false);

export function EmptyState({
  title,
  description,
  action,
  filtered = false,
}: {
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  filtered?: boolean;
}) {
  const Icon = filtered ? Search : FileText;
  return (
    <div className="empty records-empty">
      <Icon size={28} aria-hidden="true" />
      <div role="status">
        <p className="empty-title">{title}</p>
        {description && <p>{description}</p>}
      </div>
      {action && (
        <button type="button" className="btn" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}

/** Shared table semantics for workspace, business details and mobile records. */
export function RecordsTable({
  heads,
  rows,
  className = "table-scroll",
  empty,
}: {
  heads: string[];
  rows: React.ReactNode[][];
  className?: string;
  empty?: React.ReactNode;
}) {
  const en = useContext(RecordsLanguage);
  return (
    <div className={className}>
      {rows.length ? (
        <table role="table">
          <thead role="rowgroup">
            <tr role="row">
              {heads.map((h, index) => (
                <th key={index} scope="col" role="columnheader">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody role="rowgroup">
            {rows.map((row, index) => (
              <tr key={index} role="row">
                {row.map((cell, col) => (
                  <td
                    key={col}
                    role="cell"
                    data-label={heads[col]}
                    data-action={
                      /^(操作|Actions?)$/i.test(heads[col]) || undefined
                    }
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        empty || (
          <EmptyState
            title={en ? "No records yet" : "暂无记录"}
            description={
              en
                ? "Records available to your account will appear here."
                : "当前账号可查看的记录会显示在这里。"
            }
          />
        )
      )}
    </div>
  );
}
