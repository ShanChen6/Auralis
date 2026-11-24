/** Gọi API từ trình duyệt qua proxy /backend (cùng domain với web) */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function errorMessage(body: unknown, status: number): string {
  const message = (body as { message?: unknown } | null)?.message;
  if (Array.isArray(message)) return message.map((m) => String(m).replace(/^[\w.]+: /, "")).join(" · ");
  if (typeof message === "string") return message;
  if (status === 401) return "Vui lòng đăng nhập";
  if (status >= 500) return "Máy chủ đang bận, bạn thử lại sau nhé";
  return `Có lỗi xảy ra (${status})`;
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(`/backend${path}`, {
    credentials: "same-origin",
    ...rest,
    headers: {
      accept: "application/json",
      ...(json !== undefined ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (res.status === 204) return undefined as T;
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(errorMessage(body, res.status), res.status);
  return body as T;
}
