#!/bin/bash

# Fix all remaining supabaseClient references
echo "🔧 Fixing supabaseClient references..."

# List of files to fix
files=(
  "blog/blogScheduler.js"
  "cron/cleanupInactive.js"
  "cron/dispatcher.js"
  "cron/reminderScheduler.js"
  "routes/rewardsRoutes.js"
  "routes/verificationRoutes.js"
  "scripts/run-dispatcher-check.js"
  "services/aiService.js"
  "services/rewardsService.js"
  "utils/permissions.js"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "  Fixing $file..."
    sed -i '' "s|const { supabase } = require('../services/supabaseClient');|const db = require('../services/db');|g" "$file"
    sed -i '' "s|const { supabase } = require('./supabaseClient');|const db = require('./db');|g" "$file"
  fi
done

echo "✅ All supabaseClient imports replaced with db!"
