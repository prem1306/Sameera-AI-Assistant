# Sameera Windows actions

Run `npm run dev` on this Windows computer, refresh the app, and start a new call.

Examples:

- “Open Chrome and go to YouTube.”
- “Open VS Code.”
- “Open Notepad and organize these meeting notes: [details].”
- “Find the official video for [title] and open it in Chrome.”
- “Set the speaker volume to 35 percent.”
- “Reduce brightness by 10 percentage points.”
- “Look for Report.docx in my Documents folder.”
- “Open C:\Users\PremSai\Documents\Report.docx in Word.”
- “In that document, replace every occurrence of draft with final.”
- “Create a folder called Research in [exact parent path].”
- “Rename [exact file path] to [new filename].”

The assistant must ask when an amount, location, matching file/video, replacement scope, missing parent folder, or destination conflict is unresolved. Dependent actions in the same tool batch stop after such a question. Existing text files require a current version hash, and edits preserve an undo copy alongside the original. Word text changes use the installed Word application and preserve surrounding formatting; unsaved changes and protected documents cause a pause.

Supported operations: file/folder listing and bounded name searches, small UTF-8 text files, exact text replacements, new folders, copies, moves, renames, Recycle Bin deletion, opening supported files, Chrome URLs, default audio-output volume, compatible-display brightness, and Word read/replace/append. Arbitrary shell commands, credentials, Windows/program folders, application data, links/junctions, permanent deletion, and unspecified fallbacks are unavailable.

The server binds only to 127.0.0.1. Host/origin checks and a per-server browser-session token protect the action endpoint. Keep it local; do not expose this process through a public tunnel. Model interpretation is still fallible: use exact names, paths, text, and amounts for commands that change files.

## Notepad and applications

Ask “Open OBS Studio,” “Open Calculator,” or “Close Chrome.” `openApplication` discovers Start menu shortcuts, registered executables and Windows Store apps. `listApplications` can search installed names; ambiguous results return a choice instead of guessing. Portable applications can be opened using an exact absolute local `.exe` path supplied by you. Commands and extra executable arguments are not accepted.

`listRunningApplications` returns visible application processes and window titles. `closeApplication` sends the normal close request to the chosen process's main window and checks for exit. If several instances match, specify a window or explicitly ask for all matching instances. A selected process ID must include the returned start time, so an old selection cannot target a reused ID. Save dialogs, remaining windows, apps that minimize to the tray, elevated apps, and apps that refuse to exit may need your interaction. Pending closes are reported as pending; there is no force-kill, automatic retry or save-dialog dismissal. Background services, the Windows shell and Sameera itself are excluded.

`notepadDraft` creates a unique UTF-8 working file under `.sameera-drafts`, verifies the exact bytes, and launches Notepad with that file. It does not type into or overwrite an existing window. The working draft persists locally; saving a permanent copy needs your destination instruction. Save manual Notepad changes before asking Sameera to read them. Text-delivery verification does not guarantee that speech was interpreted correctly; ask for a read-back when names or numbers matter.

## Gmail in Chrome

Open Sameera's **Gmail** button for setup. In Chrome, visit `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select this project's `chrome-extension` folder. Open the extension popup and connect using Sameera's pairing code. Leave exactly one signed-in Gmail inbox tab open and reload it after installing the extension. The code changes on server restart. The browser token cannot execute Windows actions.

Ask “Draft an email to [exact address] about [purpose/details].” Sameera opens a separate compose tab and verifies sender, recipient, subject, and plain-text body. Drafting does not send. When you ask to send, a preview appears in Sameera with **Approve and send**. Clicking it gives one permission for that exact draft, expiring in five minutes. Any body/subject/recipient/account discrepancy stops sending. Duplicate approvals, old drafts, disconnected/restarted bridges, and uncertain results cannot trigger automatic retries. A spoken “yes” does not release a send.

This first bridge version supports Gmail's English interface, a single recipient and signed-in account, and plain text without attachments/CC/BCC. Signatures or changed page layouts cause a pause. It does not read inbox mail. Chrome must remain open; initial extension installation and pairing are manual browser steps. Gmail selectors need a real signed-in browser verification before production use; mocked tests verify the approval gate without sending any actual email.
