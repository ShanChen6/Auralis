import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

const ALLOWED_TAG = /^(posts|featured|top-week|categories|post:[a-z0-9-]{1,220})$/;

function validSecret(given: string | null): boolean {
  const expected = process.env.REVALIDATE_SECRET;
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * On-Demand ISR: auralis-api gọi khi biên tập viên duyệt / cập nhật bài.
 * POST { tags: ["posts", "post:<slug>"] } kèm header x-revalidate-secret.
 */
export async function POST(request: NextRequest) {
  if (!validSecret(request.headers.get("x-revalidate-secret"))) {
    return NextResponse.json({ message: "Sai mã bí mật" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { tags?: unknown } | null;
  const tags = Array.isArray(body?.tags) ? body.tags.filter((t): t is string => typeof t === "string") : [];
  const accepted = tags.filter((t) => ALLOWED_TAG.test(t)).slice(0, 50);
  if (accepted.length === 0) {
    return NextResponse.json({ message: "Không có tag hợp lệ" }, { status: 400 });
  }
  // "max": người xem tiếp theo nhận bản cũ ngay, bản mới được tạo ở nền (stale-while-revalidate)
  for (const tag of accepted) revalidateTag(tag, "max");
  return NextResponse.json({ revalidated: accepted });
}
