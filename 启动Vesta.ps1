$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    $runtimePackages = Get-AppxPackage -Name 'OpenAI.CodexPrimaryRuntime*' | Sort-Object Version -Descending
    $runtimePath = $runtimePackages | Select-Object -First 1 -ExpandProperty InstallLocation
    if ($runtimePath) {
        $env:PATH = "$runtimePath\dependencies\node\bin;$runtimePath\dependencies\bin\fallback;$env:PATH"
    }
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw '请安装 Node.js 24 LTS，并重新打开 PowerShell。' }
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) { throw '请先安装 pnpm，然后重新打开 PowerShell。' }
if (-not (Test-Path -LiteralPath 'node_modules')) {
    pnpm install --frozen-lockfile
    if ($LASTEXITCODE -ne 0) { throw '依赖安装失败，请检查网络后重试。' }
}
pnpm build
if ($LASTEXITCODE -ne 0) { throw '编译失败，请查看以上错误。' }
Write-Host 'Vesta 本地地址：http://127.0.0.1:3100。按 Ctrl+C 停止，数据会保留。'
pnpm local
