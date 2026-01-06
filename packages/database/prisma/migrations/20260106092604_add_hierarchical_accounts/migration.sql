-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "isGroup" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parentId" TEXT;

-- CreateIndex
CREATE INDEX "Account_parentId_idx" ON "Account"("parentId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
