import React, { useEffect, useState, type ComponentType } from "react";
import { Dialog } from "./parity";
import type { FormModalProps } from "./form-modal";

let loadedForm: ComponentType<FormModalProps> | null = null;

/** Load business editing code only when requested; failed downloads stay recoverable. */
export default function FormLoader(props: FormModalProps) {
  const [Component, setComponent] = useState(() => loadedForm);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setFailed(false);
    void import("./form-modal")
      .then((module) => {
        loadedForm = module.default;
        if (active) setComponent(() => module.default);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  if (Component) return <Component {...props} />;
  return (
    <Dialog title={props.form.title} onClose={props.onClose}>
      <p role={failed ? "alert" : "status"}>
        {props.en
          ? failed
            ? "The form could not load. Check the local connection and try again; no changes have been submitted."
            : "Loading the form…"
          : failed
            ? "表单未能加载。请检查本机连接后重试；尚未提交任何修改。"
            : "正在加载表单…"}
      </p>
      {failed && (
        <button
          className="btn primary"
          onClick={() => setAttempt((n) => n + 1)}
        >
          {props.en ? "Retry loading" : "重新加载表单"}
        </button>
      )}
    </Dialog>
  );
}
