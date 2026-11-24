import { PostTile } from "@/components/radio/post-tile";
import { SpatialRadioShowcase } from "@/components/radio/spatial-radio-showcase";
import { getFeaturedPosts, getLatestPosts } from "@/lib/api";

export default async function HomePage() {
  const [featured, latest] = await Promise.all([getFeaturedPosts(), getLatestPosts()]);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <section className="pt-10 pb-6 sm:pt-16">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-secondary">Trạm Thanh Âm &amp; Cảm Xúc</p>
        <h1 className="mt-3 max-w-2xl font-serif text-4xl leading-tight text-foreground sm:text-5xl">
          Đọc chậm, nghe sâu, <span className="text-primary">lòng dịu lại.</span>
        </h1>
        <p className="mt-4 max-w-xl text-muted">
          Những trang tản văn được kể lại bằng giọng đọc ấm áp, hòa cùng tiếng mưa và tiếng đàn.
        </p>
      </section>

      <SpatialRadioShowcase posts={featured} />

      <section id="moi-len-song" className="scroll-mt-24 pt-20">
        <h2 className="font-serif text-2xl text-foreground">Mới lên sóng</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {latest.map((post) => (
            <PostTile key={post.id} post={post} queue={latest} />
          ))}
        </div>
      </section>
    </div>
  );
}
