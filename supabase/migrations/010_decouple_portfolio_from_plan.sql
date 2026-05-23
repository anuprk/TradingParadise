-- Make portfolio independent of plan
ALTER TABLE portfolios ALTER COLUMN plan_id DROP NOT NULL;
ALTER TABLE portfolios DROP CONSTRAINT IF EXISTS portfolios_plan_id_fkey;
