# Script para criar ZIP limpo do projeto ACADIA
Write-Host "A criar ZIP limpo do projeto ACADIA..."

# Criar pasta temporária para arquivos limpos
$tempFolder = "..\acadia-temp"
if (Test-Path $tempFolder) {
    Remove-Item $tempFolder -Recurse -Force
}
New-Item -ItemType Directory -Path $tempFolder

# Copiar arquivos essenciais (excluindo pastas pesadas)
$excludeFolders = @("node_modules", ".git", "dist", ".wrangler")
$sourceFiles = Get-ChildItem -Path "." -File | Where-Object { $_.DirectoryName -notmatch ($excludeFolders -join '|') }

foreach ($file in $sourceFiles) {
    $relativePath = $file.FullName.Replace((Get-Location).Path, "").TrimStart('\')
    $targetPath = Join-Path $tempFolder $relativePath
    $targetDir = Split-Path $targetPath -Parent
    
    if (-not (Test-Path $targetDir)) {
        New-Item -ItemType Directory -Path $targetDir -Force
    }
    
    Copy-Item $file.FullName $targetPath
}

# Copiar pastas essenciais (excluindo as pesadas)
$essentialFolders = @("src", "supabase", "public", "components", "lib", "routes")
foreach ($folder in $essentialFolders) {
    if (Test-Path $folder) {
        $targetPath = Join-Path $tempFolder $folder
        Copy-Item $folder $targetPath -Recurse -Force
    }
}

# Criar ZIP
$zipPath = "..\acadia-projeto-limpo.zip"
Compress-Archive -Path "$tempFolder\*" -DestinationPath $zipPath -Force

# Verificar resultado
if (Test-Path $zipPath) {
    $fileInfo = Get-Item $zipPath
    $sizeMB = [math]::Round($fileInfo.Length / 1MB, 2)
    Write-Host "✅ ZIP criado com sucesso!"
    Write-Host "📁 Tamanho: $sizeMB MB"
    Write-Host "📍 Local: $(Get-Location)\..\acadia-projeto-limpo.zip"
} else {
    Write-Host "❌ Falha ao criar ZIP"
}

# Limpar pasta temporária
Remove-Item $tempFolder -Recurse -Force

Write-Host "🧹 Limpeza concluída!"
