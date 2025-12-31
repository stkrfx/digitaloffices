-- 1. Enable PostGIS (Just in case it wasn't enabled before)
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Create the Spatial Index
-- This allows "Find Expert Near Me" to work instantly.
CREATE INDEX "expert_geo_index" 
  ON "Expert" 
  USING GIST ( ST_SetSRID(ST_MakePoint(longitude, latitude), 4326) );