# 兜行一键部署 (Windows PowerShell)
$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)
node scripts/deploy.mjs @args
