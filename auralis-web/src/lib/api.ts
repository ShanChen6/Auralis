import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { PostCard, PostDetail, PostList } from "./types";

const API_URL = (process.env.API_URL ?? "http://localhost:4000/api").replace(/\/$/, "");

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, { headers: { accept: "application/json" } });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch (error) {
    // API tắt (VD: lúc build) thì hiển thị trạng thái trống thay vì làm hỏng trang
    console.warn(`[auralis] Không gọi được API ${path}:`, (error as Error).message);
    return null;
  }
}

export async function getFeaturedPosts(): Promise<PostCard[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("posts", "featured");
  return (await getJson<PostCard[]>("/posts/featured?limit=5")) ?? [];
}

export async function getLatestPosts(limit = 12): Promise<PostCard[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("posts");
  return (await getJson<PostList>(`/posts?limit=${limit}`))?.items ?? [];
}

export async function getPost(slug: string): Promise<PostDetail | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("posts", `post:${slug}`);
  return getJson<PostDetail>(`/posts/${encodeURIComponent(slug)}`);
}
