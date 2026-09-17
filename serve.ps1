# Minimal static file server for local development. Optional.
#
# The app runs fine opened straight from disk, with or without Firebase -
# Firebase Auth and Firestore were both verified working from a file:// URL.
# Serving over http://localhost is still closer to how the app will actually
# be hosted, and avoids file:// restrictions if this ever grows ES modules, a
# service worker, or OAuth sign-in popups.
#
# Usage:   powershell -ExecutionPolicy Bypass -File serve.ps1
#          powershell -ExecutionPolicy Bypass -File serve.ps1 -Port 3000
# Stop:    Ctrl+C

param(
  [int]$Port = 8080,
  [string]$Root = $PSScriptRoot
)

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.svg'  = 'image/svg+xml'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.ico'  = 'image/x-icon'
  '.webmanifest' = 'application/manifest+json'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")

try {
  $listener.Start()
} catch {
  Write-Host "Could not listen on port $Port. Is something already using it?" -ForegroundColor Red
  Write-Host "Try: powershell -ExecutionPolicy Bypass -File serve.ps1 -Port 3000"
  exit 1
}

Write-Host ""
Write-Host "  LifeLink is being served from $Root" -ForegroundColor Green
Write-Host "  Open  http://localhost:$Port/" -ForegroundColor Cyan
Write-Host "  Tests http://localhost:$Port/tests.html" -ForegroundColor DarkCyan
Write-Host "  Ctrl+C to stop."
Write-Host ""

while ($listener.IsListening) {
  try {
    $context = $listener.GetContext()
  } catch {
    break
  }

  $path = [System.Uri]::UnescapeDataString($context.Request.Url.AbsolutePath)
  if ($path -eq '/') { $path = '/index.html' }

  # Keep requests inside the served folder.
  $full = Join-Path $Root ($path.TrimStart('/') -replace '/', '\')
  $resolvedRoot = [System.IO.Path]::GetFullPath($Root)
  $resolved = [System.IO.Path]::GetFullPath($full)

  if (-not $resolved.StartsWith($resolvedRoot) -or -not (Test-Path $resolved -PathType Leaf)) {
    $context.Response.StatusCode = 404
    $bytes = [System.Text.Encoding]::UTF8.GetBytes('404 - not found')
    $context.Response.ContentType = 'text/plain; charset=utf-8'
  } else {
    $ext = [System.IO.Path]::GetExtension($resolved).ToLower()
    $context.Response.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
    $bytes = [System.IO.File]::ReadAllBytes($resolved)
    # Development server: never let a stale file linger in the browser cache.
    $context.Response.Headers.Add('Cache-Control', 'no-store')
  }

  $context.Response.ContentLength64 = $bytes.Length
  try {
    $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  } catch {}
  $context.Response.OutputStream.Close()

  Write-Host ("  {0}  {1}" -f $context.Response.StatusCode, $path) -ForegroundColor DarkGray
}

$listener.Stop()
