-- DropForeignKey
ALTER TABLE "cohorts" DROP CONSTRAINT "cohorts_managerId_fkey";

-- DropForeignKey
ALTER TABLE "courses" DROP CONSTRAINT "courses_managerId_fkey";

-- AddForeignKey
ALTER TABLE "cohorts" ADD CONSTRAINT "cohorts_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
