# Uploading from iPhone

GitHub's browser uploader works best with extracted files rather than a ZIP archive.

1. Save the ZIP in the iPhone Files app.
2. Tap the ZIP once to extract the `Luna-v2-GitHub` folder.
3. Open GitHub in Safari and request the desktop website if controls are hidden.
4. Create a new repository named `luna-v2` and do not add a starter README.
5. Open the repository, choose **Add file → Upload files**, then choose files from the extracted folder.
6. Upload the root files first, then create/upload the `frontend` and `netlify/functions` folders if Safari does not preserve folders.
7. Commit directly to `main`.
8. In Netlify, choose **Add new project → Import an existing project → GitHub**, then select `luna-v2`.
9. Add `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` under Netlify environment variables, then redeploy.
