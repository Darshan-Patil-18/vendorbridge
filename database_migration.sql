-- VendorBridge Database Migration
-- Run this SQL in your Supabase SQL Editor

-- 1. Add user_id column to vendors table (links vendor card to their login account)
ALTER TABLE vendors 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_vendors_user_id ON vendors(user_id);

-- 2. Add selected_vendor_user_ids column to rfqs table (stores user IDs of selected vendors)
ALTER TABLE rfqs 
ADD COLUMN IF NOT EXISTS selected_vendor_user_ids uuid[];

-- Add index for better query performance with array contains operations
CREATE INDEX IF NOT EXISTS idx_rfqs_vendor_user_ids ON rfqs USING GIN(selected_vendor_user_ids);

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'vendors' 
AND column_name = 'user_id';

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'rfqs' 
AND column_name = 'selected_vendor_user_ids';
