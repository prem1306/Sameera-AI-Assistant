$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '..\scripts\windows-apps.ps1')
function Assert($condition, [string]$message) { if (!$condition) { throw $message } }
$catalog = @(
  @{ appId = 'a'; name = 'Visual Studio Code'; target = 'C:\Programs\Code.exe' },
  @{ appId = 'b'; name = 'Adobe Photoshop'; target = 'C:\Programs\Photoshop.exe' },
  @{ appId = 'c'; name = 'Adobe Acrobat'; target = 'C:\Programs\Acrobat.exe' },
  @{ appId = 'd'; name = 'Google Chrome'; target = 'C:\Programs\chrome.exe' }
)
Assert ((@(Match-Applications $catalog 'VS Code' '')).Count -eq 1) 'VS Code alias should match the installed app.'
Assert ((@(Match-Applications $catalog 'Adobe' '')).Count -eq 2) 'Duplicate partial names must remain ambiguous.'
Assert ((@(Match-Applications $catalog 'Chrome' '')).Count -eq 1) 'Chrome alias should resolve.'
Assert ((@(Match-Applications $catalog 'Adobe*' '')).Count -eq 2) 'Matching must treat user names as text, not wildcard code.'
Assert ((@(Match-Applications $catalog '' 'c'))[0].name -eq 'Adobe Acrobat') 'Selected IDs must identify the exact app.'
Assert ((@(Match-Applications $catalog 'Missing' '')).Count -eq 0) 'Missing apps must not select a fallback.'
$mock = [PSCustomObject]@{ Id = 42; requests = 0; exits = $false }
$mock | Add-Member ScriptMethod CloseMainWindow { $this.requests++; return $true }
$mock | Add-Member ScriptMethod WaitForExit { param($milliseconds); return $this.exits }
$pending = Request-AppClose $mock
Assert ($pending.requested -and !$pending.closed) 'A save prompt must leave close pending.'
Assert ($mock.requests -eq 1) 'A pending close must not be automatically retried.'
$mock.exits = $true
$closed = Request-AppClose $mock
Assert ($closed.closed) 'Confirmed process exit should report closed.'
function Ask([string]$question) { @{ success = $false; needsClarification = $true; question = $question } }
function Get-ApplicationCatalog { $catalog }
function Get-AppWindows { @{ processId = 100; application = 'notepad'; title = 'Chrome notes - Notepad'; startedAt = '2026-01-01T00:00:00.0000000Z' } }
$unrelated = Invoke-AppAction ([PSCustomObject]@{ action = 'closeApplication'; application = 'Chrome' })
Assert (!$unrelated.success -and !$unrelated.closeRequested) 'An editor document mentioning Chrome must never match a request to close the Chrome app.'
$empty = Invoke-AppAction ([PSCustomObject]@{ action = 'closeApplication'; application = '*'; allInstances = $true })
Assert $empty.needsClarification 'Wildcard-only close commands must not target every app.'
$stale = Invoke-AppAction ([PSCustomObject]@{ action = 'closeApplication'; processId = 100; startedAt = 'wrong' })
Assert $stale.needsClarification 'A stale process selection must not close a new process.'
Write-Output 'Windows app matching and graceful-close tests passed (no real apps opened or closed).'
