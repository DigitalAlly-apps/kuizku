#!/bin/bash
URL="https://xqfpgpbwtffzsbdlokfg.supabase.co/rest/v1"
KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxZnBncGJ3dGZmenNiZGxva2ZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyODA2MjAsImV4cCI6MjA5Mjg1NjYyMH0.oA_f2cmRA0iKGxM3V4-ru1oyH0Z44oKJ2Lo5PEvwVdA"

for t in teachers exams questions preloaded_students submissions student_answers bank_questions workspaces workspace_members plans subscriptions usage_counters; do
  echo "===== $t ====="
  curl -s "$URL/$t?select=*&limit=50" -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
  echo ""
done
