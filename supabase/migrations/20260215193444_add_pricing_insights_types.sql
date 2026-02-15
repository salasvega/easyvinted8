/*
  # Add Pricing Insights Types to Kelly Insights

  1. Changes
    - Add new insight types for Kelly Pricing feature:
      - `overpriced` - Article priced above market
      - `underpriced` - Article priced below market (opportunity)
      - `optimal_price` - Price is perfect
      - `price_test` - Suggestion to test different price
      - `bundle_opportunity` - Suggestion to create bundle
      - `psychological_pricing` - Suggestion for psychological pricing (19€ instead of 20€)

  2. Purpose
    - Extends kelly_insights table to support pricing assistance feature
    - Enables Kelly to provide intelligent pricing recommendations
*/

-- Drop the existing constraint
ALTER TABLE kelly_insights DROP CONSTRAINT IF EXISTS kelly_insights_type_check;

-- Add new constraint with pricing types
ALTER TABLE kelly_insights ADD CONSTRAINT kelly_insights_type_check
  CHECK (type IN (
    'ready_to_publish',
    'ready_to_list',
    'price_drop',
    'seasonal',
    'stale',
    'incomplete',
    'seo_optimization',
    'opportunity',
    'bundle',
    'overpriced',
    'underpriced',
    'optimal_price',
    'price_test',
    'bundle_opportunity',
    'psychological_pricing'
  ));
