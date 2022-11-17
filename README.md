# acos-webdev

A content type for [Acos-servers](https://github.com/acos-server/acos-server)
that provides common features for instrumenting elements and actions in a web
browser as well as implementing feedback to the student.

All `acos-webdev-*` packages depend on this.

### Tools

A Node.js command line script `extract_log.js` extracts collected data from the
given time period. The content type stores session logs as complete, partly
overlapping histories at the points where the saving is triggered. This script
removes the overlapping data and holds on to the last and longest log for each
session.
