# Remote AppErrorLog pulls land here (JSONL).
# Auto-sync:
#   1) GitHub Action pulls from Render hourly (+ on main push) and commits here
#   2) Cursor sessionStart hook copies this file from origin when remote changes
# Manual: LOG_EXPORT_SECRET=... npm run logs:pull
