import { useState, type FormEvent, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpLeft,
  BarChart3,
  Eye,
  Layers3,
  LogOut,
  MousePointer2,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import {
  AdminError,
  adminApi,
  type AdminSession,
  type TrafficResult,
} from "../lib/admin";
import { formatNumber } from "../lib/format";
import { Loading } from "../components/Shared";
import "./admin.css";

const sessionKey = ["admin", "session"];
function defaults() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (name: string) => parts.find((part) => part.type === name)!.value;
  const end = `${get("year")}-${get("month")}-${get("day")}`;
  const start = new Date(`${end}T12:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 29);
  return { start: start.toISOString().slice(0, 10), end };
}
export function Admin() {
  const client = useQueryClient();
  const session = useQuery({
    queryKey: sessionKey,
    retry: false,
    staleTime: 60_000,
    queryFn: async () => {
      try {
        return await adminApi<AdminSession>("/session");
      } catch (error) {
        if (error instanceof AdminError && error.status === 401) return null;
        throw error;
      }
    },
  });
  if (session.isPending) return <Loading />;
  if (session.isError)
    return (
      <div className="state-panel" role="alert">
        <h1>اتصال به پنل برقرار نشد</h1>
        <button onClick={() => session.refetch()}>تلاش دوباره</button>
      </div>
    );
  if (!session.data)
    return (
      <AdminLogin complete={(data) => client.setQueryData(sessionKey, data)} />
    );
  return <AdminWorkspace session={session.data} />;
}
function AdminLogin({
  complete,
}: {
  complete: (session: AdminSession) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const data = await adminApi<AdminSession>("/login", {
        body: {
          username: String(form.get("username")).trim(),
          password: String(form.get("password")),
        },
      });
      complete(data);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "ورود انجام نشد؛ دوباره تلاش کنید",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="admin-login">
      <Link to="/" className="admin-brand">
        <Layers3 aria-hidden="true" />
        <strong>
          راد <small>RAD</small>
        </strong>
      </Link>
      <div className="admin-login-card">
        <ShieldCheck
          className="admin-login-icon"
          size={28}
          aria-hidden="true"
        />
        <span className="eyebrow">مدیریت راد</span>
        <h1>ورود به پنل مدیریت</h1>
        <p>آمار دیده‌شدن و کلیک روی فروشگاه‌ها را دنبال کنید.</p>
        <form onSubmit={submit}>
          <label>
            نام کاربری
            <input
              name="username"
              required
              minLength={3}
              maxLength={80}
              autoComplete="username"
              autoCapitalize="none"
              dir="ltr"
            />
          </label>
          <label>
            رمز عبور
            <input
              name="password"
              type="password"
              required
              maxLength={256}
              autoComplete="current-password"
              dir="ltr"
            />
          </label>
          {error && (
            <p className="admin-error" role="alert">
              {error}
            </p>
          )}
          <button className="button" disabled={busy} type="submit">
            {busy ? "در حال ورود…" : "ورود به پنل"}
          </button>
        </form>
      </div>
      <Link className="text-link" to="/shoes">
        بازگشت به سایت <ArrowUpLeft size={16} aria-hidden="true" />
      </Link>
    </section>
  );
}
function AdminWorkspace({ session }: { session: AdminSession }) {
  const client = useQueryClient();
  const [loggingOut, setLoggingOut] = useState(false),
    [error, setError] = useState("");
  async function logout() {
    setLoggingOut(true);
    setError("");
    try {
      await adminApi<void>("/logout", { body: {}, csrf: session.csrf_token });
      await client.cancelQueries({ queryKey: ["admin"] });
      client.removeQueries({
        predicate: (query) =>
          query.queryKey[0] === "admin" && query.queryKey[1] !== "session",
      });
      client.setQueryData(sessionKey, null);
    } catch (error) {
      if (error instanceof AdminError && error.status === 401) {
        await client.cancelQueries({ queryKey: ["admin"] });
        client.removeQueries({
          predicate: (query) =>
            query.queryKey[0] === "admin" && query.queryKey[1] !== "session",
        });
        client.setQueryData(sessionKey, null);
      } else
        setError(error instanceof Error ? error.message : "خروج انجام نشد");
    } finally {
      setLoggingOut(false);
    }
  }
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link to="/" className="admin-brand">
          <Layers3 aria-hidden="true" />
          <strong>
            راد <small>مدیریت</small>
          </strong>
        </Link>
        <nav aria-label="بخش‌های مدیریت">
          <Link to="/admin" aria-current="page">
            <BarChart3 size={19} aria-hidden="true" /> آمار فروشگاه‌ها
          </Link>
        </nav>
        <div className="admin-account">
          <span>
            وارد شده با <bdi>{session.username}</bdi>
          </span>
          <Link to="/shoes">
            مشاهدهٔ سایت <ArrowUpLeft size={15} aria-hidden="true" />
          </Link>
          <button onClick={logout} disabled={loggingOut}>
            <LogOut size={16} aria-hidden="true" />
            {loggingOut ? "در حال خروج…" : "خروج"}
          </button>
          {error && <p role="alert">{error}</p>}
        </div>
      </aside>
      <StoreTraffic />
    </div>
  );
}
function StoreTraffic() {
  const client = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [formError, setFormError] = useState("");
  const dates = defaults();
  const search = new URLSearchParams();
  for (const key of [
    "q",
    "market",
    "retailer_id",
    "active_only",
    "sort",
    "page",
  ]) {
    if (params.get(key)) search.set(key, params.get(key)!);
  }
  search.set("start_date", params.get("start_date") || dates.start);
  search.set("end_date", params.get("end_date") || dates.end);
  search.set("page_size", "25");
  const queryString = search.toString();
  const query = useQuery({
    queryKey: ["admin", "traffic", queryString],
    retry: false,
    queryFn: ({ signal }) =>
      adminApi<TrafficResult>(`/analytics/stores?${queryString}`, { signal }),
  });
  useEffect(() => {
    if (query.error instanceof AdminError && query.error.status === 401) {
      client.removeQueries({ queryKey: ["admin", "traffic"] });
      client.setQueryData(sessionKey, null);
    }
  }, [query.error, client]);
  const data = query.data;
  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    if (String(values.get("start_date")) > String(values.get("end_date"))) {
      setFormError("تاریخ شروع باید قبل از تاریخ پایان باشد.");
      return;
    }
    setFormError("");
    const next = new URLSearchParams();
    values.forEach((value, key) => {
      if (value) next.set(key, String(value).trim());
    });
    setParams(next);
  }
  function changePage(page: number) {
    const next = new URLSearchParams(params);
    next.set("page", String(page));
    setParams(next);
  }
  const percent = (value: number | null | undefined) =>
    value == null ? "—" : `${formatNumber(value)} %`;
  return (
    <section className="admin-content" aria-labelledby="admin-traffic-title">
      <header className="admin-heading">
        <div>
          <span className="eyebrow">عملکرد فروشگاه‌ها</span>
          <h1 id="admin-traffic-title">از دیده‌شدن تا کلیک خرید</h1>
          <p>
            برای هر کفش و فروشگاه، بازدیدکننده‌ها و کلیک‌کننده‌های یکتا را
            ببینید.
          </p>
        </div>
        <button
          className="admin-refresh"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
        >
          <RefreshCw size={16} aria-hidden="true" /> به‌روزرسانی
        </button>
      </header>
      <form
        className="admin-filters"
        key={params.toString()}
        onSubmit={filter}
        aria-label="فیلتر آمار"
      >
        <label className="admin-search">
          <span>
            <Search size={15} aria-hidden="true" /> کفش یا فروشگاه
          </span>
          <input
            name="q"
            placeholder="نام کفش، برند یا فروشگاه"
            maxLength={160}
            defaultValue={params.get("q") || ""}
          />
        </label>
        <label>
          از تاریخ
          <input
            name="start_date"
            type="date"
            lang="en"
            required
            max={dates.end}
            defaultValue={search.get("start_date")!}
          />
        </label>
        <label>
          تا تاریخ
          <input
            name="end_date"
            type="date"
            lang="en"
            required
            max={dates.end}
            defaultValue={search.get("end_date")!}
          />
        </label>
        <label>
          بازار
          <select name="market" defaultValue={params.get("market") || ""}>
            <option value="">همهٔ بازارها</option>
            <option value="iran">ایران</option>
            <option value="foreign">خارج از ایران</option>
          </select>
        </label>
        <label>
          فروشگاه
          <select
            name="retailer_id"
            defaultValue={params.get("retailer_id") || ""}
          >
            <option value="">همهٔ فروشگاه‌ها</option>
            {data?.retailers.map((store) => (
              <option key={store.retailer_id} value={store.retailer_id}>
                {store.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          مرتب‌سازی
          <select name="sort" defaultValue={params.get("sort") || "views"}>
            <option value="views">بیشترین بازدیدکننده</option>
            <option value="clicks">بیشترین کلیک‌کننده</option>
            <option value="ctr">بیشترین نرخ کلیک</option>
            <option value="name">نام کفش</option>
          </select>
        </label>
        <label className="admin-check">
          <input
            name="active_only"
            type="checkbox"
            value="true"
            defaultChecked={params.get("active_only") === "true"}
          />{" "}
          فقط ردیف‌های دارای آمار
        </label>
        <button className="button" type="submit">
          اعمال فیلترها
        </button>
        {params.size > 0 && (
          <button type="button" onClick={() => setParams({})}>
            پاک کردن فیلترها
          </button>
        )}
        {formError && (
          <p role="alert" className="admin-error">
            {formError}
          </p>
        )}
      </form>
      <div className="admin-stats" aria-label="خلاصه آمار">
        {[
          {
            title: "بازدیدکنندهٔ یکتا",
            value: data ? formatNumber(data.summary.viewers) : "—",
            icon: <Eye size={19} aria-hidden="true" />,
          },
          {
            title: "کلیک‌کنندهٔ یکتا",
            value: data ? formatNumber(data.summary.clickers) : "—",
            icon: <MousePointer2 size={19} aria-hidden="true" />,
          },
          {
            title: "نرخ کلیک",
            value: percent(data?.summary.ctr),
            icon: <ArrowUpLeft size={19} aria-hidden="true" />,
          },
          {
            title: "ردیف‌های دارای آمار",
            value: data ? formatNumber(data.summary.active_pairs) : "—",
            icon: <BarChart3 size={19} aria-hidden="true" />,
          },
        ].map((item) => (
          <div key={item.title} className="admin-stat">
            {item.icon}
            <span>{item.title}</span>
            <strong dir="ltr">{item.value}</strong>
          </div>
        ))}
      </div>
      <div className="admin-table-panel">
        <div className="admin-table-heading">
          <h2>آمار هر کفش و فروشگاه</h2>
          <span>
            {data ? `${formatNumber(data.total)} ردیف` : "در حال دریافت…"}
          </span>
        </div>
        {query.isPending ? (
          <p role="status" className="admin-empty">
            در حال دریافت آمار…
          </p>
        ) : query.isError ? (
          <div role="alert" className="admin-empty">
            <p>{query.error.message}</p>
            <button onClick={() => query.refetch()}>تلاش دوباره</button>
          </div>
        ) : data && data.items.length > 0 ? (
          <>
            <div
              className="admin-table-scroll"
              tabIndex={0}
              role="region"
              aria-label="جدول آمار فروشگاه‌ها"
            >
              <table>
                <thead>
                  <tr>
                    <th scope="col">کفش</th>
                    <th scope="col">فروشگاه</th>
                    <th scope="col">دیده‌اند</th>
                    <th scope="col">کلیک کرده‌اند</th>
                    <th scope="col">نرخ کلیک</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((row) => (
                    <tr key={`${row.shoe_id}:${row.source}:${row.retailer_id}`}>
                      <td>
                        <Link
                          to={`/shoes/${row.slug}#stores`}
                          target="_blank"
                          rel="noopener noreferrer"
                          dir="auto"
                        >
                          {row.shoe_name}
                          <ArrowUpLeft size={14} aria-hidden="true" />
                        </Link>
                        <small dir="auto">{row.brand}</small>
                      </td>
                      <td>
                        <span dir="auto">{row.retailer_name}</span>
                        <small>
                          {row.market === "iran"
                            ? "ایران"
                            : row.market === "foreign"
                              ? "خارج از ایران"
                              : "بازار نامشخص"}
                        </small>
                      </td>
                      <td className="admin-number" data-label="دیده‌اند">
                        {formatNumber(row.viewers)}
                      </td>
                      <td className="admin-number" data-label="کلیک کرده‌اند">
                        {formatNumber(row.clickers)}
                      </td>
                      <td className="admin-ctr" data-label="نرخ کلیک">
                        <span dir="ltr">{percent(row.ctr)}</span>
                        <span className="admin-ctr-bar" aria-hidden="true">
                          <span style={{ width: `${row.ctr || 0}%` }} />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <nav className="admin-pagination" aria-label="صفحه‌های آمار">
              <button
                disabled={data.page <= 1}
                onClick={() => changePage(data.page - 1)}
              >
                قبلی
              </button>
              <span>
                صفحهٔ {formatNumber(data.page)} از {formatNumber(data.pages)}
              </span>
              <button
                disabled={data.page >= data.pages}
                onClick={() => changePage(data.page + 1)}
              >
                بعدی
              </button>
            </nav>
          </>
        ) : (
          <p className="admin-empty">
            ردیفی با این فیلترها پیدا نشد. بازه یا فیلترها را تغییر دهید.
          </p>
        )}
      </div>
      <p className="admin-definition">
        هر مرورگر در بازهٔ انتخابی، برای هر کفش و فروشگاه یک بار شمرده می‌شود.
        نمایش با دیده‌شدن حداقل نیمی از ردیف برای 1 ثانیه ثبت می‌شود؛ کلیک
        مستقیم هم یک نمایش محسوب می‌شود. بازدید مدیر محاسبه نمی‌شود؛ کلیک خرید
        به معنی پرداخت نهایی نیست. تاریخ‌ها بر اساس ساعت ایران هستند. آمار از
        زمان فعال‌سازی این بخش جمع می‌شود.
      </p>
    </section>
  );
}
