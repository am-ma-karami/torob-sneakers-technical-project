import { Link, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { Columns3, X } from "lucide-react";
import { useComparison } from "../lib/comparison";
import { ProductImage } from "./Shared";
import { formatNumber } from "../lib/format";
export function comparisonUrl(
  items: { shoe_id: number; selected_colorway?: unknown }[],
  path: "/compare" | "/compare/select" = "/compare",
) {
  const params = new URLSearchParams({
    ids: items.map((s) => s.shoe_id).join(","),
  });
  items.forEach((s) => {
    if (typeof s.selected_colorway === "string")
      params.set("variant_" + s.shoe_id, s.selected_colorway);
  });
  return path + "?" + params.toString();
}
export function ComparisonTray() {
  const { items, remove, clear, message } = useComparison(),
    location = useLocation();
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        {message}
      </div>
      <AnimatePresence>
        {items.length > 0 &&
          !["/compare", "/compare/select"].includes(location.pathname) && (
            <motion.aside
              className="comparison-tray"
              aria-label="کفش‌های انتخاب‌شده برای مقایسه"
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <div className="tray-label">
                <Columns3 size={19} />
                <b>
                  مقایسه <span>{formatNumber(items.length)} / 4</span>
                </b>
              </div>
              <div className="tray-shoes">
                {items.map((s) => (
                  <div className="tray-shoe" key={s.shoe_id}>
                    <ProductImage
                      src={s.catalog_image_url || s.image_url}
                      name={s.name}
                    />
                    <span dir="ltr">{s.name}</span>
                    <button
                      aria-label={`حذف ${s.name} از سبد مقایسه`}
                      onClick={() => remove(s.shoe_id)}
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
              <Link
                to={
                  items.length === 1 ? "/compare/select" : comparisonUrl(items)
                }
                className="button tray-cta"
              >
                {items.length === 1 ? "انتخاب کفش دوم" : "مقایسه کن"}
              </Link>
              <button
                className="tray-clear"
                aria-label="پاک کردن سبد مقایسه"
                onClick={clear}
              >
                <X size={16} />
              </button>
            </motion.aside>
          )}
      </AnimatePresence>
    </>
  );
}
