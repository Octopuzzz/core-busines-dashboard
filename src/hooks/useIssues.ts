"use client";

import { useEffect, useState } from "react";
import type { IssueQuery, IssueResponse } from "@/lib/jira/types";

interface Result {
  key: string;
  data: IssueResponse | null;
  error: string | null;
}

export function useIssues(query: IssueQuery | null, reloadKey = 0) {
  const key = query ? JSON.stringify(query) : "";
  const reqKey = `${key}#${reloadKey}`;
  const [result, setResult] = useState<Result>({ key: "", data: null, error: null });

  useEffect(() => {
    if (!key) return;
    const ctrl = new AbortController();
    fetch("/api/jira/issues", {
      method: "POST",
      body: key,
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json" },
    })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? `Request failed (${r.status})`);
        setResult({ key: reqKey, data: body as IssueResponse, error: null });
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setResult((s) => ({ ...s, key: reqKey, error: e.message }));
      });
    return () => ctrl.abort();
  }, [key, reqKey]);

  if (!key) return { data: null, loading: false, error: null };
  return {
    data: result.data,
    loading: result.key !== reqKey,
    error: result.key === reqKey ? result.error : null,
  };
}
