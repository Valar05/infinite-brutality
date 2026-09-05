param(
  [Parameter(Mandatory=$true)][string]$WorkspaceRoot,
  [switch]$Probe
)
$ErrorActionPreference='Stop'
$TaskName='FleshpunkMazeOvernight'
$Runner=Join-Path $WorkspaceRoot 'tools\fleshpunk-lineart-training\cauldron\run-overnight.ps1'
$Bundle=Join-Path $WorkspaceRoot 'assets\training\fleshpunk\lineart-v1'
if(-not(Test-Path $Runner)){throw "runner missing: $Runner"}
if(-not(Test-Path (Join-Path $Bundle 'selected'))){throw "selected bundle missing: $Bundle"}
$Task=Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
$Arguments='-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "'+$Runner+'" -BundleRoot "'+$Bundle+'"'
$Action=New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $Arguments
Set-ScheduledTask -TaskName $TaskName -Action $Action | Out-Null
if($Probe){& $Runner -BundleRoot $Bundle}
$Current=Get-ScheduledTask -TaskName $TaskName
$StatePath=Join-Path $env:LOCALAPPDATA 'FleshpunkCauldron\state\latest.json'
[ordered]@{
 schema='FLESHPUNK TASK CONFIG RECEIPT 1'
 task=$TaskName
 state=[string]$Current.State
 execute=$Current.Actions[0].Execute
 arguments=$Current.Actions[0].Arguments
 nextRun=(Get-ScheduledTaskInfo -TaskName $TaskName).NextRunTime.ToUniversalTime().ToString('o')
 probeState=if(Test-Path $StatePath){Get-Content $StatePath -Raw|ConvertFrom-Json}else{$null}
}|ConvertTo-Json -Depth 8 -Compress
