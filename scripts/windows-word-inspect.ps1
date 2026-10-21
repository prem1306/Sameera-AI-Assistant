function Invoke-WordDuplicateInspection($task) {
  $word = $null; $doc = $null
  try {
    # Never attach to the user's existing Word instance or unsaved document.
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $word.AutomationSecurity = 3
    $word.Options.UpdateLinksAtOpen = $false
    $doc = $word.Documents.Open($task.path, $false, $true, $false, 'sameera-no-password', 'sameera-no-password')
    if ($doc.Content.Text.Length -gt 1000000) { throw 'Document exceeds inspection limit.' }
    $text = "word/document.xml`n" + $doc.Content.Text.Replace([char]7, [char]32)
    foreach ($kind in @(2,3,4,5,6,7,8,9,10,11)) {
      try { $story = $doc.StoryRanges.Item($kind); $index = 0
        while ($story) { $text += "`nlegacy-story-$kind-$index`n" + $story.Text; $story = $story.NextStoryRange; $index++ }
      } catch { }
    }
    @{ success = $true; text = $text }
  } finally {
    if ($doc) { $doc.Close(0); [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($doc) }
    if ($word) { $word.Quit(0); [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($word) }
  }
}
