import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import type { Summary } from "./types";
type ComparisonState = {
  items: Summary[];
  toggle: (s: Summary) => void;
  remove: (id: number) => void;
  clear: () => void;
  message: string;
};
const Context = createContext<ComparisonState | null>(null);
export function ComparisonProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Summary[]>(() => {
    try {
      const data = JSON.parse(localStorage.getItem("rad-compare") || "[]");
      return Array.isArray(data)
        ? data
            .filter(
              (x) =>
                Number.isInteger(x?.shoe_id) &&
                typeof x?.name === "string" &&
                typeof x?.slug === "string",
            )
            .slice(0, 4)
        : [];
    } catch {
      return [];
    }
  });
  const [message, setMessage] = useState("");
  const save = (next: Summary[]) => {
    setItems(next);
    try {
      localStorage.setItem("rad-compare", JSON.stringify(next));
    } catch {
      /* browsing remains usable without storage */
    }
  };
  const toggle = (s: Summary) => {
    if (items.some((x) => x.shoe_id === s.shoe_id)) {
      save(items.filter((x) => x.shoe_id !== s.shoe_id));
      setMessage(`${s.name} از مقایسه حذف شد`);
    } else if (items.length < 4) {
      save([...items, s]);
      setMessage(`${s.name} به مقایسه اضافه شد`);
    } else
      setMessage("حداکثر چهار کفش را می‌توان مقایسه کرد؛ ابتدا یکی را حذف کن.");
  };
  return (
    <Context
      value={{
        items,
        toggle,
        remove: (id) => save(items.filter((x) => x.shoe_id !== id)),
        clear: () => save([]),
        message,
      }}
    >
      {children}
    </Context>
  );
}
export function useComparison() {
  const state = useContext(Context);
  if (!state) throw new Error("Missing comparison provider");
  return state;
}
