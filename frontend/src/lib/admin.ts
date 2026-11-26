export class AdminError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export async function adminApi<T>(
  path: string,
  options: { body?: unknown; csrf?: string; signal?: AbortSignal } = {},
): Promise<T> {
  const response = await fetch(`/api/admin${path}`, {
    method: options.body !== undefined ? "POST" : "GET",
    credentials: "same-origin",
    signal: options.signal,
    headers: {
      ...(options.body !== undefined
        ? { "Content-Type": "application/json" }
        : {}),
      ...(options.csrf ? { "X-CSRF-Token": options.csrf } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new AdminError(
      response.status,
      data?.error?.message || "ارتباط با پنل برقرار نشد؛ دوباره تلاش کنید",
    );
  }
  return response.status === 204
    ? (undefined as T)
    : (response.json() as Promise<T>);
}
export type AdminSession = {
  username: string;
  csrf_token: string;
  expires_at: string;
};
export type TrafficResult = {
  items: {
    shoe_id: number;
    slug: string;
    shoe_name: string;
    brand: string;
    retailer_id: string;
    retailer_name: string;
    source: string;
    market: string | null;
    viewers: number;
    clickers: number;
    ctr: number | null;
  }[];
  summary: {
    viewers: number;
    clickers: number;
    ctr: number | null;
    active_pairs: number;
  };
  retailers: { retailer_id: string; name: string }[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
  start_date: string;
  end_date: string;
};
