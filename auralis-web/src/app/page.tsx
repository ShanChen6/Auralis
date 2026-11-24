import { PostTile } from "@/components/radio/post-tile";
import { SpatialRadioShowcase } from "@/components/radio/spatial-radio-showcase";
import { TopOfWeek } from "@/components/radio/top-week";
import { getFeaturedPosts, getLatestPosts, getTopOfWeek } from "@/lib/api";

export default async function HomePage() {
  const [featured, latest, top] = await Promise.all([getFeaturedPosts(), getLatestPosts(), getTopOfWeek()]);

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

      <div className="grid gap-10 pt-20 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section id="moi-len-song" className="scroll-mt-24">
          <h2 className="font-serif text-2xl text-foreground">Mới lên sóng</h2>
          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            {latest.map((post) => (
              <PostTile key={post.id} post={post} queue={latest} />
            ))}
          </div>
        </section>
        {top.length > 0 && (
          <section aria-labelledby="top-week-title">
            <h2 id="top-week-title" className="font-serif text-2xl text-foreground">
              Nghe nhiều trong tuần
            </h2>
            <div className="mt-6">
              <TopOfWeek posts={top} />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
