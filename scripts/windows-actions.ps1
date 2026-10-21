$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
$task = [Console]::In.ReadToEnd() | ConvertFrom-Json
function Ask([string]$question) { return @{ success = $false; needsClarification = $true; question = $question; instruction = 'Ask the user and wait. Do not execute further dependent steps.' } }
. (Join-Path $PSScriptRoot 'windows-apps.ps1')
. (Join-Path $PSScriptRoot 'windows-word.ps1')
. (Join-Path $PSScriptRoot 'windows-notepad.ps1')
. (Join-Path $PSScriptRoot 'windows-word-inspect.ps1')

try {
  $result = switch ($task.action) {
    { $_ -in @('openApplication','closeApplication','listApplications','listRunningApplications') } { Invoke-AppAction $task }
    'wordFingerprint' { @{ success = $true; version = Get-WordLiveVersion $task.path } }
    'wordInspectDuplicate' { Invoke-WordDuplicateInspection $task }
    'notepadOpen' { Invoke-NotepadAction $task }
    'status' {
      $volume = $null
      try { Add-Type -Path (Join-Path $PSScriptRoot 'WindowsAudio.cs'); $volume = [Math]::Round([Sameera.WindowsAudio]::GetVolume() * 100) } catch { }
      $brightness = $null
      try { $brightness = (Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightness -ErrorAction Stop | Where-Object Active | Select-Object -First 1).CurrentBrightness } catch { }
      @{ success = $true; platform = 'Windows'; volume = $volume; brightness = $brightness; home = $env:USERPROFILE; desktop = [Environment]::GetFolderPath('Desktop'); documents = [Environment]::GetFolderPath('MyDocuments'); actions = @('openApplication','closeApplication','listApplications','listRunningApplications','notepadDraft','wordDraft','listFolder','findFile','readText','writeText','replaceText','createFolder','move','copy','rename','recycle','openFile','openChrome','volume','brightness','wordRead','wordReplace','wordAppend','wordSave') }
    }
    'openChrome' {
      $chromePaths = @((Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'), (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'), (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe'))
      $chrome = $chromePaths | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
      if (!$chrome) { Ask 'Chrome is not installed at a known location. Would you like to use another browser, or provide its location?' }
      else { Start-Process -FilePath $chrome -ArgumentList @('--new-tab', ('"' + $task.url + '"')); @{ success = $true; browser = 'Chrome'; url = $task.url; message = 'Sent the exact URL to Chrome. Playback may require a user gesture.' } }
    }
    'openFile' {
      Start-Process -FilePath $task.path
      @{ success = $true; path = $task.path; message = 'Opened using its Windows application.' }
    }
    'recycle' {
      if ($task.expectedHash) {
        if ((Get-FileHash -LiteralPath $task.path -Algorithm SHA256).Hash -ine $task.expectedHash) { throw 'Approved file changed. Scan again.' }
        foreach ($keeper in $task.keepers) {
          if ((Get-FileHash -LiteralPath $keeper.path -Algorithm SHA256).Hash -ine $keeper.hash) { throw 'Keeper changed. Scan again.' }
        }
      }
      Add-Type -AssemblyName Microsoft.VisualBasic
      if (Test-Path -LiteralPath $task.path -PathType Container) {
        [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($task.path, 'OnlyErrorDialogs', 'SendToRecycleBin', 'ThrowException')
      } else {
        [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($task.path, 'OnlyErrorDialogs', 'SendToRecycleBin', 'ThrowException')
      }
      @{ success = $true; path = $task.path; message = 'Moved to the Recycle Bin.' }
    }
    'brightness' {
      $monitors = @(Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightness -ErrorAction SilentlyContinue | Where-Object Active)
      $controls = @(Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightnessMethods -ErrorAction SilentlyContinue | Where-Object Active)
      if ($monitors.Count -ne 1 -or $controls.Count -ne 1) { Ask 'Windows does not expose exactly one controllable display. Which display do you mean? External monitors may require their own brightness controls.' }
      else {
        $current = [int]$monitors[0].CurrentBrightness
        $value = if ($null -ne $task.percent) { [int]$task.percent } else { $current + [int]$task.delta }
        if ($value -lt 0 -or $value -gt 100) { Ask 'That change would exceed the 0–100 brightness range. What exact brightness should I use?' }
        else {
          Invoke-CimMethod -InputObject $controls[0] -MethodName WmiSetBrightness -Arguments @{ Timeout = [uint32]1; Brightness = [byte]$value } | Out-Null
          $verified = [int](Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightness | Where-Object Active | Select-Object -First 1).CurrentBrightness
          @{ success = ($verified -eq $value); previous = $current; brightness = $verified }
        }
      }
    }
    'volume' {
      Add-Type -Path (Join-Path $PSScriptRoot 'WindowsAudio.cs')
      $current = [Math]::Round([Sameera.WindowsAudio]::GetVolume() * 100)
      $value = if ($null -ne $task.percent) { [double]$task.percent } else { $current + [double]$task.delta }
      if ($value -lt 0 -or $value -gt 100) { Ask 'That change would exceed the 0–100 volume range. What exact volume should I use?' }
      else {
        [Sameera.WindowsAudio]::SetVolume([single]($value / 100))
        $verified = [Math]::Round([Sameera.WindowsAudio]::GetVolume() * 100)
        @{ success = ([Math]::Abs($verified - $value) -lt 1); previous = $current; volume = $verified }
      }
    }
    { $_ -in @('wordDraft','wordOpen','wordRead','wordReplace','wordAppend','wordSave') } { Invoke-WordAction $task }
    default { Ask 'That Windows operation is not supported. What supported action would you like?' }
  }
  $result | ConvertTo-Json -Depth 8 -Compress
} catch {
  (Ask $_.Exception.Message) | ConvertTo-Json -Depth 8 -Compress
}
