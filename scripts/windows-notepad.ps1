function Invoke-NotepadAction($task) {
  switch ($task.action) {
    'notepadOpen' {
      Start-Process -FilePath (Join-Path $env:WINDIR 'System32\notepad.exe') -ArgumentList ('"' + $task.path + '"')
      @{ success = $true; application = 'Notepad'; message = 'Opened the verified note draft in Notepad.' }
    }
    default { Ask 'That Notepad operation is not supported.' }
  }
}
