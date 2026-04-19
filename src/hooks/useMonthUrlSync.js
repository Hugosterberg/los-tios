import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isValidMonthKey(value) {
  return typeof value === "string" && MONTH_REGEX.test(value);
}

/**
 * Two-way sync between a yyyy-MM state variable and the URL `?month=` query param.
 *
 * - On first render (and whenever the URL param changes externally), if the URL param is
 *   a valid yyyy-MM and differs from `value`, this calls `setValue(urlMonth)`. Hydration
 *   happens even when `active` is false so a deep link still seeds state; the user can
 *   then switch the page into month-mode and see the right period.
 * - Whenever `value` changes and `active` is true, the URL param is updated with
 *   `replace: true` (no history entry, so browser back still works naturally).
 * - When `active` flips from true → false while this hook owns the param (previously
 *   wrote it), the param is cleared so a stale month doesn't leak into other tabs via
 *   generic sidebar navigation.
 *
 * Pages that have multiple period modes (e.g. Statistics "monthly" vs "yearly") should set
 * `active={false}` when the current mode is not month-based.
 */
export function useMonthUrlSync(value, setValue, { active = true, paramName = "month" } = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlValue = searchParams.get(paramName);
  const hasHydratedFromUrl = useRef(false);
  /* Flips true once this hook instance has either written the URL param or hydrated
     state from it — i.e. once the page "owns" the param. Used to scope "clear on
     inactive": on a pristine render (no URL param, state at default), we must not
     clear a param we never touched; once owned, switching to inactive (e.g. rolling
     range instead of calendar month) should clean up. */
  const ownsParamRef = useRef(false);

  const valueRef = useRef(value);
  valueRef.current = value;
  const setValueRef = useRef(setValue);
  setValueRef.current = setValue;

  useEffect(() => {
    if (!hasHydratedFromUrl.current && isValidMonthKey(urlValue) && urlValue !== valueRef.current) {
      setValueRef.current(urlValue);
      ownsParamRef.current = true;
    }
    hasHydratedFromUrl.current = true;
  }, [urlValue]);

  useEffect(() => {
    if (active) {
      if (!isValidMonthKey(value)) return;
      if (value === urlValue) {
        /* Param matches state — treat as owned so a later inactive transition cleans up. */
        if (urlValue !== null) ownsParamRef.current = true;
        return;
      }
      const next = new URLSearchParams(searchParams);
      next.set(paramName, value);
      setSearchParams(next, { replace: true });
      ownsParamRef.current = true;
      return;
    }
    if (ownsParamRef.current && urlValue !== null) {
      const next = new URLSearchParams(searchParams);
      next.delete(paramName);
      setSearchParams(next, { replace: true });
      ownsParamRef.current = false;
    }
  }, [value, active, urlValue, paramName, searchParams, setSearchParams]);
}

/** Appends `?month=YYYY-MM` to a URL when valid. Safe to call with null/invalid values. */
export function appendMonthParam(url, month, paramName = "month") {
  if (!isValidMonthKey(month)) return url;
  const joiner = url.includes("?") ? "&" : "?";
  return `${url}${joiner}${paramName}=${month}`;
}
