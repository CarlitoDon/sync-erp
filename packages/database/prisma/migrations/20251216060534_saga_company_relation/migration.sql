-- AddForeignKey
ALTER TABLE "SagaLog" ADD CONSTRAINT "SagaLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
