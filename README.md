# Brackets / Productivity / Project Files Search
Search within your Project Files. Folder and file names are considered. 

## Commands
ALT+s - start searching in Project Files.
ALT+c - continue searching in Project Files.
ALT+x - clean Project Files search query.

ESC while focused on search field cleans the field.

## Search
Separate search chunks by space (works as AND), ! before a search chunk works as NOT for a chunk. / - is a directory separator.

## Example
"controller main" - controller AND main.
"!cache controller main" - NOT cache AND controller AND main.
"!cache/ controller/ main" - NOT cache (directory) AND controller (directory) AND main.
"!cache/controller controller/ main" - NOT cache/controller (directory) AND controller (directory) AND main.