$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Security\Microsoft.PowerShell.Security.psd1') -Force
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$request = [Console]::In.ReadToEnd() | ConvertFrom-Json
if ($request.operation -eq 'protect') {
  $value = ConvertTo-SecureString -String $request.value -AsPlainText -Force | ConvertFrom-SecureString
} elseif ($request.operation -eq 'unprotect') {
  $secure = ConvertTo-SecureString -String $request.value
  $value = (New-Object System.Net.NetworkCredential('', $secure)).Password
} else { throw 'Unsupported credential operation' }
@{ value = $value } | ConvertTo-Json -Compress
