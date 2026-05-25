-- Drop discount_percentage column from promotions_active
ALTER TABLE "promotions_active" DROP COLUMN "discount_percentage";

-- Drop promotion_percentages table
DROP TABLE "promotion_percentages";
