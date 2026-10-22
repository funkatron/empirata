# Publish Empirata on GitHub Pages

**Expected address:** `https://funkatron.github.io/empirata/` after GitHub Pages is configured.

1. Create a **public** GitHub repository named `empirata` under `funkatron`. Initialize with a README, leaving the default branch as `main`.
2. Commit the contents of this project repository (source files and `.github/workflows/pages.yml`) to `main`.
3. Under GitHub **Settings → Pages**, choose **Source: GitHub Actions**.
4. Open the **Actions** tab and check the **Test and publish Empirata** workflow. Use **Run workflow** if the earlier automatic run failed before Pages was enabled.
5. Open `https://funkatron.github.io/empirata/`.

No local server is needed. The workflow builds and publishes changes whenever `main` is updated.

## One-file alternative for iPad-only setup

The accompanying `empirata-v0.2-single-file.html` is self-contained. In an empty repo, upload it as `index.html` through **Add file → Upload files**, commit, then enable Pages at **Settings → Pages → Deploy from a branch → main → /(root)**. This path requires no GitHub Actions or Node.js setup. Don't use both publishing methods for the same repository.

**Note:** The static app's test scenarios are incomplete and must be clearly labeled as such.
