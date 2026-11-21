-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Lesson" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "topicId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "hook" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "takeaway1" TEXT NOT NULL,
    "takeaway2" TEXT NOT NULL,
    "takeaway3" TEXT NOT NULL,
    "actionText" TEXT NOT NULL,
    "readTimeMinutes" INTEGER NOT NULL,
    "readTimeOverride" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT NOT NULL DEFAULT '',
    "editorNotes" TEXT NOT NULL DEFAULT '',
    "rightsBasis" TEXT,
    "requiresSources" BOOLEAN NOT NULL DEFAULT true,
    "isRepeatable" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedAt" DATETIME,
    "scheduledAt" DATETIME,
    "approvedAt" DATETIME,
    "approvedBy" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Lesson_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Lesson" ("actionText", "approvedAt", "approvedBy", "body", "createdAt", "createdBy", "hook", "id", "isRepeatable", "publishedAt", "readTimeMinutes", "readTimeOverride", "requiresSources", "rightsBasis", "scheduledAt", "status", "tags", "takeaway1", "takeaway2", "takeaway3", "title", "topicId", "updatedAt", "updatedBy") SELECT "actionText", "approvedAt", "approvedBy", "body", "createdAt", "createdBy", "hook", "id", "isRepeatable", "publishedAt", "readTimeMinutes", "readTimeOverride", "requiresSources", "rightsBasis", "scheduledAt", "status", "tags", "takeaway1", "takeaway2", "takeaway3", "title", "topicId", "updatedAt", "updatedBy" FROM "Lesson";
DROP TABLE "Lesson";
ALTER TABLE "new_Lesson" RENAME TO "Lesson";
CREATE INDEX "Lesson_topicId_status_publishedAt_idx" ON "Lesson"("topicId", "status", "publishedAt");
CREATE INDEX "Lesson_status_scheduledAt_idx" ON "Lesson"("status", "scheduledAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
