$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$request = [Console]::In.ReadToEnd() | ConvertFrom-Json
$root = [IO.Path]::GetFullPath($request.root).TrimEnd('\') + '\'
$rootDirectory = $root.TrimEnd('\')
if ((Get-Item -LiteralPath $rootDirectory -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Managed runtime root cannot be a link or junction.' }
$zip = [IO.Path]::GetFullPath($request.zip)
$destination = [IO.Path]::GetFullPath($request.destination).TrimEnd('\') + '\'
if (!$zip.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) -or !$destination.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) { throw 'Package paths must remain inside the managed local runtime.' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::OpenRead($zip)
try {
  foreach ($entry in $archive.Entries) {
    $target = [IO.Path]::GetFullPath((Join-Path $destination $entry.FullName))
    if (!$target.StartsWith($destination, [StringComparison]::OrdinalIgnoreCase) -or $entry.FullName.Contains(':') -or (($entry.ExternalAttributes -shr 16) -band 0xF000) -eq 0xA000) { throw 'Unsafe package entry.' }
    $cursor = $target
    while ($cursor.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) {
      if ((Test-Path -LiteralPath $cursor) -and ((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Package destination contains a link or junction.' }
      $cursor = [IO.Path]::GetDirectoryName($cursor)
      if (!$cursor) { break }
    }
    if ($entry.Length -gt 4000000000) { throw 'Package entry too large.' }
  }
  [IO.Directory]::CreateDirectory($destination) | Out-Null
  foreach ($entry in $archive.Entries) {
    $target = [IO.Path]::GetFullPath((Join-Path $destination $entry.FullName))
    if ($entry.FullName.EndsWith('/') -or $entry.FullName.EndsWith('\')) { [IO.Directory]::CreateDirectory($target) | Out-Null; continue }
    [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($target)) | Out-Null
    [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $target, $true)
  }
} finally { $archive.Dispose() }
@{ success = $true } | ConvertTo-Json -Compress
