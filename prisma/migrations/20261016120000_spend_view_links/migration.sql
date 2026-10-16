-- CreateTable
CREATE TABLE "spend_view_links" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "lastViewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spend_view_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spend_view_sessions" (
    "tokenHash" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spend_view_sessions_pkey" PRIMARY KEY ("tokenHash")
);

-- CreateIndex
CREATE UNIQUE INDEX "spend_view_links_tokenHash_key" ON "spend_view_links"("tokenHash");

-- CreateIndex
CREATE INDEX "spend_view_links_userId_idx" ON "spend_view_links"("userId");

-- One active link per user. Revoked rows keep a timestamp, so they fall outside this index.
CREATE UNIQUE INDEX "spend_view_links_active_user_idx" ON "spend_view_links"("userId") WHERE "revokedAt" IS NULL;

-- CreateIndex
CREATE INDEX "spend_view_sessions_linkId_idx" ON "spend_view_sessions"("linkId");

-- AddForeignKey
ALTER TABLE "spend_view_links" ADD CONSTRAINT "spend_view_links_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spend_view_sessions" ADD CONSTRAINT "spend_view_sessions_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "spend_view_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;
