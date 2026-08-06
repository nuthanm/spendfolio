@echo off
cd /d "d:\My work\spendfolio"
call npm run db:migrate -- --skip-generate
