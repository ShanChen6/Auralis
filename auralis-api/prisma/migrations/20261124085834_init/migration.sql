-- Extensions cho tìm kiếm tiếng Việt (bỏ dấu + trigram)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- unaccent() là STABLE nên không dùng được trong generated column / index.
-- Bọc lại thành hàm IMMUTABLE với dictionary cố định.
CREATE OR REPLACE FUNCTION immutable_unaccent(text)
  RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('LISTENER', 'AUTHOR', 'EDITOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('DRAFT', 'PENDING', 'PUBLISHED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AudioSource" AS ENUM ('NONE', 'UPLOAD', 'AI_EDGE', 'AI_VOICESTUDIO');

-- CreateEnum
CREATE TYPE "AudioStatus" AS ENUM ('TEXT_ONLY', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "MoodTag" AS ENUM ('CALM', 'HEALING', 'NOSTALGIC', 'MELANCHOLY', 'ROMANTIC', 'HOPEFUL', 'LONELY', 'MOTIVATED');

-- CreateEnum
CREATE TYPE "CommentStatus" AS ENUM ('VISIBLE', 'HIDDEN');

-- CreateEnum
CREATE TYPE "LiveRoomStatus" AS ENUM ('SCHEDULED', 'LIVE', 'ENDED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "display_name" VARCHAR(100) NOT NULL,
    "password_hash" TEXT,
    "avatar_url" TEXT,
    "bio" VARCHAR(500),
    "role" "UserRole" NOT NULL DEFAULT 'LISTENER',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(220) NOT NULL,
    "summary" VARCHAR(500),
    "cover_url" TEXT,
    "audio_url" TEXT,
    "duration" INTEGER,
    "mood_tag" "MoodTag" NOT NULL,
    "status" "PostStatus" NOT NULL DEFAULT 'DRAFT',
    "audio_source" "AudioSource" NOT NULL DEFAULT 'NONE',
    "audio_status" "AudioStatus" NOT NULL DEFAULT 'TEXT_ONLY',
    "voice_name" VARCHAR(100),
    "background_music" VARCHAR(100),
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "listen_count" INTEGER NOT NULL DEFAULT 0,
    "reject_reason" VARCHAR(500),
    "published_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "search_vector" tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('simple', immutable_unaccent(lower(coalesce("title", '')))), 'A') ||
        setweight(to_tsvector('simple', immutable_unaccent(lower(coalesce("summary", '')))), 'B')
    ) STORED,
    "author_id" UUID NOT NULL,
    "narrator_id" UUID,
    "reviewer_id" UUID,
    "category_id" UUID,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_contents" (
    "post_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "timestamps" JSONB,
    "word_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "post_contents_pkey" PRIMARY KEY ("post_id")
);

-- CreateTable
CREATE TABLE "playlists" (
    "id" UUID NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "description" VARCHAR(500),
    "cover_url" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "owner_id" UUID NOT NULL,

    CONSTRAINT "playlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playlist_items" (
    "playlist_id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "added_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "playlist_items_pkey" PRIMARY KEY ("playlist_id","post_id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" UUID NOT NULL,
    "content" VARCHAR(2000) NOT NULL,
    "status" "CommentStatus" NOT NULL DEFAULT 'VISIBLE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "post_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "parent_id" UUID,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_rooms" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "slug" VARCHAR(170) NOT NULL,
    "description" VARCHAR(500),
    "cover_url" TEXT,
    "status" "LiveRoomStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduled_at" TIMESTAMPTZ(3),
    "started_at" TIMESTAMPTZ(3),
    "ended_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "host_id" UUID NOT NULL,
    "current_post_id" UUID,

    CONSTRAINT "live_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_sort_order_idx" ON "categories"("sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "posts_slug_key" ON "posts"("slug");

-- CreateIndex
CREATE INDEX "posts_status_published_at_idx" ON "posts"("status", "published_at" DESC);

-- CreateIndex
CREATE INDEX "posts_status_mood_tag_published_at_idx" ON "posts"("status", "mood_tag", "published_at" DESC);

-- CreateIndex
CREATE INDEX "posts_status_category_id_published_at_idx" ON "posts"("status", "category_id", "published_at" DESC);

-- CreateIndex
CREATE INDEX "posts_status_listen_count_idx" ON "posts"("status", "listen_count" DESC);

-- CreateIndex
CREATE INDEX "posts_status_view_count_idx" ON "posts"("status", "view_count" DESC);

-- CreateIndex
CREATE INDEX "posts_author_id_created_at_idx" ON "posts"("author_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "posts_narrator_id_idx" ON "posts"("narrator_id");

-- CreateIndex
CREATE INDEX "posts_reviewer_id_idx" ON "posts"("reviewer_id");

-- CreateIndex
CREATE INDEX "posts_status_created_at_idx" ON "posts"("status", "created_at");

-- CreateIndex
CREATE INDEX "posts_audio_status_status_idx" ON "posts"("audio_status", "status");

-- CreateIndex
CREATE INDEX "posts_search_vector_idx" ON "posts" USING GIN ("search_vector");

-- CreateIndex
CREATE INDEX "playlists_owner_id_created_at_idx" ON "playlists"("owner_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "playlists_is_public_created_at_idx" ON "playlists"("is_public", "created_at" DESC);

-- CreateIndex
CREATE INDEX "playlist_items_playlist_id_position_idx" ON "playlist_items"("playlist_id", "position");

-- CreateIndex
CREATE INDEX "playlist_items_post_id_idx" ON "playlist_items"("post_id");

-- CreateIndex
CREATE INDEX "comments_post_id_status_created_at_idx" ON "comments"("post_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "comments_parent_id_created_at_idx" ON "comments"("parent_id", "created_at");

-- CreateIndex
CREATE INDEX "comments_author_id_idx" ON "comments"("author_id");

-- CreateIndex
CREATE UNIQUE INDEX "live_rooms_slug_key" ON "live_rooms"("slug");

-- CreateIndex
CREATE INDEX "live_rooms_status_scheduled_at_idx" ON "live_rooms"("status", "scheduled_at");

-- CreateIndex
CREATE INDEX "live_rooms_host_id_idx" ON "live_rooms"("host_id");

-- CreateIndex
CREATE INDEX "live_rooms_current_post_id_idx" ON "live_rooms"("current_post_id");

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_narrator_id_fkey" FOREIGN KEY ("narrator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_contents" ADD CONSTRAINT "post_contents_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlist_items" ADD CONSTRAINT "playlist_items_playlist_id_fkey" FOREIGN KEY ("playlist_id") REFERENCES "playlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlist_items" ADD CONSTRAINT "playlist_items_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_rooms" ADD CONSTRAINT "live_rooms_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_rooms" ADD CONSTRAINT "live_rooms_current_post_id_fkey" FOREIGN KEY ("current_post_id") REFERENCES "posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Tìm kiếm gần đúng theo tiêu đề (ILIKE / similarity), không phân biệt dấu
CREATE INDEX "posts_title_trgm_idx" ON "posts" USING GIN (immutable_unaccent(lower("title")) gin_trgm_ops);

-- Carousel "Số Radio nổi bật" trên trang chủ: partial index rất nhỏ
CREATE INDEX "posts_featured_published_idx" ON "posts" ("published_at" DESC)
  WHERE "is_featured" = true AND "status" = 'PUBLISHED';
