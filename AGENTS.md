# Code organization

Keep Sameera features separated by responsibility so faults are easy to locate. Word and Notepad behavior must remain in their own TypeScript and native Windows modules. Shared dispatchers should route actions and handle common concerns, rather than contain application-specific implementations.

Follow the module map in `CODE_STRUCTURE.md`. When adding a native module, include it in the desktop build and packaged-file checks. Verify affected behavior through the existing tests and appropriate native checks.
