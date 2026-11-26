import { lazy, Suspense, useEffect } from "react";
import {
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
  useParams,
  Navigate,
} from "react-router-dom";
import { Layers3, Search } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Home } from "./pages/Home";
import { Catalog } from "./pages/Catalog";
import { Loading } from "./components/Shared";
import { ComparisonTray } from "./components/ComparisonTray";
import { useComparison } from "./lib/comparison";
import { formatNumber } from "./lib/format";
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
const Admin = lazy(() =>
  import("./pages/Admin").then((m) => ({ default: m.Admin })),
);
export function App() {
  const reduce = useReducedMotion();
  const location = useLocation(),
    { items } = useComparison();
  const adminRoute =
    location.pathname === "/admin" || location.pathname.startsWith("/admin/");
  useEffect(() => {
    const titles: Record<string, string> = {
      "/": "راد | از فرم تا احساس حرکت",
      "/shoes": "راد | کشف و مقایسه کفش",
      "/compare": "راد | مقایسه کفش‌ها",
      "/compare/select": "راد | انتخاب کفش برای مقایسه",
      "/finder": "راد | کفش مناسب من",
      "/brands": "راد | برندها",
      "/categories": "راد | دسته‌های کفش",
      "/about": "راد | درباره ما",
      "/admin": "راد | مدیریت",
    };
    if (titles[location.pathname]) document.title = titles[location.pathname];
    window.scrollTo({ top: 0 });
    document.getElementById("main")?.focus({ preventScroll: true });
  }, [location.pathname]);
  return (
    <>
      <a href="#main" className="skip-link">
        رفتن به محتوای اصلی
      </a>
      {!adminRoute && (
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
              <NavLink to="/shoes">کشف کفش</NavLink>
              <NavLink to="/brands" className="nav-brands">
                برندها
              </NavLink>
              <NavLink to="/finder">کفش من</NavLink>
              <NavLink to="/compare">
                مقایسه
                {items.length > 0 && (
                  <small>{formatNumber(items.length)}</small>
                )}
              </NavLink>
            </nav>
            <span className="header-note">
              <Link to="/shoes" aria-label="جستجوی کفش" className="nav-search">
                <Search size={18} /> جستجو
              </Link>
            </span>
          </div>
        </header>
      )}
      <main
        id="main"
        tabIndex={-1}
        className={adminRoute ? "container admin-container" : "container"}
      >
        <motion.div
          key={location.pathname}
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reduce ? 0 : 0.2 }}
        >
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/admin/*" element={<Admin />} />
              <Route path="/" element={<Home />} />
              <Route path="/shoes" element={<Catalog />} />
              <Route path="/shoes/:slug" element={<Detail />} />
              <Route path="/shoe/:slug" element={<LegacyDetail />} />
              <Route path="/compare" element={<Compare />} />
              <Route path="/compare/select" element={<Compare />} />
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
                    <Link className="button" to="/shoes">
                      برگشت به کاتالوگ
                    </Link>
                  </div>
                }
              />
            </Routes>
          </Suspense>
        </motion.div>
      </main>
      {!adminRoute && (
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
            <Link to="/about">درباره راد</Link>
          </nav>
        </footer>
      )}
      {!adminRoute && <ComparisonTray />}
    </>
  );
}

function LegacyDetail() {
  const { slug } = useParams();
  const location = useLocation();
  return (
    <Navigate to={`/shoes/${slug}${location.search}${location.hash}`} replace />
  );
}
