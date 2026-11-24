-- CreateEnum
CREATE TYPE "NarrationStatus" AS ENUM ('CLAIMED', 'SUBMITTED', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- AlterTable
ALTER TABLE "live_rooms" ADD COLUMN     "playlist_id" UUID;

-- CreateTable
CREATE TABLE "narration_claims" (
    "id" UUID NOT NULL,
    "status" "NarrationStatus" NOT NULL DEFAULT 'CLAIMED',
    "audio_url" TEXT,
    "duration" INTEGER,
    "note" VARCHAR(500),
    "reject_reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "post_id" UUID NOT NULL,
    "narrator_id" UUID NOT NULL,

    CONSTRAINT "narration_claims_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "narration_claims_status_updated_at_idx" ON "narration_claims"("status", "updated_at");

-- CreateIndex
CREATE INDEX "narration_claims_narrator_id_created_at_idx" ON "narration_claims"("narrator_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "narration_claims_post_id_narrator_id_key" ON "narration_claims"("post_id", "narrator_id");

-- CreateIndex
CREATE INDEX "live_rooms_playlist_id_idx" ON "live_rooms"("playlist_id");

-- AddForeignKey
ALTER TABLE "live_rooms" ADD CONSTRAINT "live_rooms_playlist_id_fkey" FOREIGN KEY ("playlist_id") REFERENCES "playlists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "narration_claims" ADD CONSTRAINT "narration_claims_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "narration_claims" ADD CONSTRAINT "narration_claims_narrator_id_fkey" FOREIGN KEY ("narrator_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
