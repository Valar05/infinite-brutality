param(
  [Parameter(Mandatory=$true)][string]$BundleRoot
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$CleanRoot = Join-Path $env:LOCALAPPDATA 'FleshpunkCauldron'
$ReceiptRoot = Join-Path $CleanRoot 'receipts'
$Incoming = Join-Path $BundleRoot 'p0'
$RasterRoot = Join-Path $CleanRoot 'dataset\p0-lineart'
$LegacyLora = Join-Path $env:LOCALAPPDATA 'VeniceImageBridge\ComfyUI\models\loras\drw_fleshpunk_v1.safetensors'
$CleanLora = Join-Path $CleanRoot 'models\loras\drw_fleshpunk_v1.safetensors'
$InkscapeRoot = Join-Path $env:LOCALAPPDATA 'Programs\Inkscape'
$InkscapeExe = Join-Path $InkscapeRoot 'bin\inkscape.com'
$Installer = Join-Path $env:TEMP 'inkscape-1.4.2-official-x64.exe'
$InstallerUrl = 'https://media.inkscape.org/dl/resources/file/inkscape-1.4.2_2025-05-13_f4327f4-x64.exe'
$InstallerExpectedSha256 = '55b0ab13bb3ef77fb9cff80e6cbe02913d6149e60ef4e9d86534ba3208a99bba'
$Started = (Get-Date).ToUniversalTime().ToString('o')
New-Item -ItemType Directory -Force -Path $ReceiptRoot,(Split-Path $CleanLora),$RasterRoot | Out-Null
if (-not (Test-Path $Incoming)) { throw "missing bundled P0 SVG directory: $Incoming" }
if (-not (Test-Path $LegacyLora)) { throw 'permitted LoRA extraction missing; poisoned runtime must not be queried or repaired' }
$SourceHash = (Get-FileHash -Algorithm SHA256 $LegacyLora).Hash.ToLowerInvariant()
Copy-Item -LiteralPath $LegacyLora -Destination $CleanLora -Force
$CleanHash = (Get-FileHash -Algorithm SHA256 $CleanLora).Hash.ToLowerInvariant()
if ($SourceHash -ne $CleanHash) { Remove-Item -LiteralPath $CleanLora -Force; throw 'LoRA hash mismatch after quarantine extraction' }
if (-not (Test-Path $InkscapeExe)) {
  & curl.exe -L --fail --silent --show-error --retry 3 --continue-at - --output $Installer $InstallerUrl
  if ($LASTEXITCODE -ne 0) { throw "official Inkscape download failed: curl exit $LASTEXITCODE" }
  $InstallerHash = (Get-FileHash -Algorithm SHA256 $Installer).Hash.ToLowerInvariant()
  $Signature = Get-AuthenticodeSignature -FilePath $Installer
  if ($InstallerHash -ne $InstallerExpectedSha256) { throw "official Inkscape hash rejected: $InstallerHash" }
  if ($Signature.SignerCertificate.Subject -notmatch 'Inkscape') { throw "official Inkscape signer rejected: $($Signature.SignerCertificate.Subject)" }
  $proc = Start-Process -FilePath $Installer -ArgumentList '/S',("/D=$InkscapeRoot") -PassThru -Wait
  if ($proc.ExitCode -ne 0) { throw "official Inkscape installer exited $($proc.ExitCode), sha256 $InstallerHash" }
} else { $InstallerHash = 'already-installed' }
if (-not (Test-Path $InkscapeExe)) {
  $machine = 'C:\Program Files\Inkscape\bin\inkscape.com'
  if (Test-Path $machine) { $InkscapeExe = $machine } else { throw 'Inkscape installation completed without a callable inkscape.com' }
}
$Rendered = @()
Get-ChildItem -LiteralPath $Incoming -Filter '*.svg' | Sort-Object Name | ForEach-Object {
  $out = Join-Path $RasterRoot ($_.BaseName + '.png')
  & $InkscapeExe $_.FullName '--export-background=#ffffff' '--export-background-opacity=255' '--export-width=1200' '--export-filename' $out
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path $out)) { throw "Inkscape failed for $($_.Name)" }
  $Rendered += [ordered]@{name=(Split-Path $out -Leaf);bytes=(Get-Item $out).Length;sha256=(Get-FileHash -Algorithm SHA256 $out).Hash.ToLowerInvariant()}
}
if ($Rendered.Count -ne 8) { throw "expected eight P0 raster canaries, found $($Rendered.Count)" }
$Receipt = [ordered]@{
  schema='FLESHPUNK CAULDRON LINEART BOOTSTRAP 1'; started_at=$Started; finished_at=(Get-Date).ToUniversalTime().ToString('o')
  host=$env:COMPUTERNAME; clean_root=$CleanRoot; quarantine_runtime_used=$false
  lora=[ordered]@{source_name='drw_fleshpunk_v1.safetensors';source_sha256=$SourceHash;clean_sha256=$CleanHash;hash_match=($SourceHash -eq $CleanHash)}
  inkscape=[ordered]@{path=$InkscapeExe;version=((& $InkscapeExe --version) | Out-String).Trim();installer_sha256=$InstallerHash;source=$InstallerUrl}
  rendered=$Rendered; visual_acceptance=$false
}
$ReceiptPath = Join-Path $ReceiptRoot 'lineart-bootstrap-latest.json'
$Receipt | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $ReceiptPath -Encoding utf8
$Receipt | ConvertTo-Json -Depth 8 -Compress
