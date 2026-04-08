# ✝ Parish Liturgy Video Reviewer

A lightweight, single-page web tool for reviewing daily parish liturgy videos.

## Features

- **Video Player** — Load Dropbox video links directly in the browser
- **Timestamped Remarks** — Add remarks tied to specific video timestamps
- **One-Click Copy** — Copy all remarks formatted for WhatsApp
- **Transcript Trimmer** — Extract homily sections from full transcripts using:
  - Text markers (e.g., "the gospel of the lord" → "our father who art in heaven")
  - Line number ranges
  - Manual text selection

## Usage

1. Paste a **Dropbox video link** and click **Load Video**
2. While reviewing, type remarks and click **Add** (or press `Ctrl+Enter`)
3. Click **📋 Copy to WhatsApp** to share remarks
4. Paste a transcript in the **Transcript Trimmer** and extract the homily

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl + Enter` | Add remark (when typing in remark box) |
| `Ctrl + T` | Grab current video timestamp |

## Deployment

This is a static single-file app. No build tools or server needed.

Hosted via [GitHub Pages](https://pages.github.com/).

## License

MIT
