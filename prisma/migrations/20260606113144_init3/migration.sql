-- Conditionally drop foreign keys (ignore if they don't exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'cohorts_managerId_fkey'
  ) THEN
    ALTER TABLE "cohorts" DROP CONSTRAINT "cohorts_managerId_fkey";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'courses_managerId_fkey'
  ) THEN
    ALTER TABLE "courses" DROP CONSTRAINT "courses_managerId_fkey";
  END IF;
END $$;

-- AddForeignKey
ALTER TABLE "cohorts" ADD CONSTRAINT "cohorts_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

