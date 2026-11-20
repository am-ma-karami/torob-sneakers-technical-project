import { lazy, Suspense, useEffect } from "react";
import { Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { Layers3, SlidersHorizontal } from "lucide-react";
import { motion } from "motion/react";
import { Catalog } from "./pages/Catalog";
import { Loading } from "./components/Shared";
import { ComparisonTray } from "./components/ComparisonTray";
import { useComparison } from "./lib/comparison";
import { fa } from "./lib/format";
const Detail = lazy(() =>
  import("./pages/Detail").then((m) => ({ default: m.Detail })),
);
const Compare = lazy(() =>
  import("./pages/Compare").then((m) => ({ default: m.Compare })),
);
const Finder = lazy(() =>
  import("./pages/Finder").then((m) => ({ default: m.Finder })),
);
const Directory = lazy(() =>
  import("./pages/Directories").then((m) => ({ default: m.Directory })),
);
const About = lazy(() =>
  import("./pages/Directories").then((m) => ({ default: m.About })),
);
export function App() {
  const location = useLocation(),
    { items } = useComparison();
  useEffect(() => {
    window.scrollTo({ top: 0 });
    document.getElementById("main")?.focus({ preventScroll: true });
  }, [location.pathname]);
  return (
    <>
      <a href="#main" className="skip-link">
        رفتن به محتوای اصلی
      </a>
      <header className="site-header">
        <div className="header-inner">
          <Link className="brand" to="/" aria-label="راد، صفحه اصلی">
            <span className="brand-mark">
              <Layers3 />
            </span>
            <strong>
              راد<span>RAD</span>
            </strong>
          </Link>
          <nav aria-label="ناوبری اصلی">
            <NavLink to="/" end>
              کشف کفش
            </NavLink>
            <NavLink to="/brands" className="nav-brands">
              برندها
            </NavLink>
            <NavLink to="/finder">کفش من</NavLink>
            <NavLink to="/compare">
              مقایسه{items.length > 0 && <small>{fa(items.length)}</small>}
            </NavLink>
          </nav>
          <span className="header-note">
            <SlidersHorizontal size={15} /> انتخاب، با شناخت بیشتر
          </span>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="container">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/" element={<Catalog />} />
              <Route path="/shoe/:slug" element={<Detail />} />
              <Route path="/compare" element={<Compare />} />
              <Route path="/finder" element={<Finder />} />
              <Route path="/brands" element={<Directory kind="brands" />} />
              <Route
                path="/categories"
                element={<Directory kind="categories" />}
              />
              <Route path="/about" element={<About />} />
              <Route
                path="*"
                element={
                  <div className="state-panel">
                    <h1>این مسیر پیدا نشد.</h1>
                    <Link className="button" to="/">
                      برگشت به کاتالوگ
                    </Link>
                  </div>
                }
              />
            </Routes>
          </Suspense>
        </motion.div>
      </main>
      <footer className="site-footer">
        <div>
          <Link to="/" className="footer-brand">
            راد <span>RAD</span>
          </Link>
          <p>هر قدم، با شناخت بیشتر.</p>
        </div>
        <nav aria-label="پیوندهای تکمیلی">
          <Link to="/categories">دسته‌بندی‌ها</Link>
          <Link to="/brands">برندها</Link>
          <Link to="/finder">کفش مناسب من</Link>
          <Link to="/about">داده‌ها و روش‌ها</Link>
        </nav>
        <p className="footer-credit">
          با داده‌های RunRepeat، ShoeGeometry و SoleHunt.
          <br />
          اعتبار و مجوزهای CC BY 4.0 در صفحه منابع هر محصول.
        </p>
      </footer>
      <ComparisonTray />
    </>
  );
}
