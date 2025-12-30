-- 1. Enable PostGIS Extension (Idempotent)
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Add Columns (Standard Prisma behavior)
ALTER TABLE "ExpertProfile" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "ExpertProfile" ADD COLUMN "longitude" DOUBLE PRECISION;

-- 3. GOLD STANDARD: Add a Spatial Index (GiST)
-- This allows instant searching even with millions of experts.
-- We index the "Point" representation of the lat/long.
CREATE INDEX "expert_geo_index" 
  ON "ExpertProfile" 
  USING GIST ( ST_SetSRID(ST_MakePoint(longitude, latitude), 4326) );