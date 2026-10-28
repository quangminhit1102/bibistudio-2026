# cPanel Artifact Deploy

## Catalogue images

Catalogue originals live in `public/catalogue`. The 29 asset descriptors in
`src/assets/catalogue` must reference `/catalogue/<original_filename>` rather than
Lovable-only `/__l5e/assets-v1/` routes. Catalogue data resolves these URLs using
the build base path, including `/~vhplasti/` for the temporary cPanel URL.

All npm build commands run `npm run validate:catalogue` first, offline. Missing
files, unresolved Lovable URLs, and invalid image signatures stop the build.
The validator checks file signatures; it is not a full image decoder.

If new Lovable catalogue descriptors are introduced, run `npm run localize:catalogue`
once while connected to the network. The command validates every download before
writing images and updating descriptor URLs. Commit the images and descriptor
changes together, then rebuild. Existing localized images do not require downloads.

Run `npm run test:catalogue` for the regression tests. Deploying through cPanel
still requires publishing the build branch and deploying its HEAD commit.

This project keeps Lovable/source code on the normal development branch and publishes cPanel from an artifact-only branch.

## Temporary cPanel URL

Use this while the site is opened at:

```text
http://h217103.tino.org/~vhplasti/
```

Create or update the local artifact branch:

```sh
npm run deploy:cpanel:temp
```

Push the artifact branch to GitHub:

```sh
npm run deploy:cpanel:temp:push
```

This publishes branch:

```text
deploy/cpanel-temp
```

## Production Domain

Use this after `bibistudio.vn` points directly at the cPanel document root:

```sh
npm run deploy:cpanel:prod:push
```

To prepare a local artifact without pushing, use `npm run deploy:cpanel:prod` instead.

If an artifact was already committed locally and the next build has no changes,
the script skips pushing. Publish that existing commit explicitly:

```sh
git -C .deploy-artifacts/deploy-cpanel-prod push -u origin deploy/cpanel-prod
```

For the temporary branch, use `.deploy-artifacts/deploy-cpanel-temp` and
`deploy/cpanel-temp` in the same command.

This publishes branch:

```text
deploy/cpanel-prod
```

## cPanel Setup

In cPanel, open **Files > Git Version Control** and clone the artifact branch, not the source branch.

Recommended repository path:

```text
/home/vhplasti/repositories/bibistudio-cpanel
```

Temporary URL branch:

```text
deploy/cpanel-temp
```

Production branch:

```text
deploy/cpanel-prod
```

The deploy branch contains `.cpanel.yml`, which copies the static artifact files into the matching document root.

Temporary branch:

```text
/home/vhplasti/public_html/
```

Production branch:

```text
/home/vhplasti/bibistudio.vn/
```

After pushing an artifact branch, use cPanel **Update from Remote** and then **Deploy HEAD Commit**.

## Notes

- Do not point cPanel Git Version Control at `main`; it contains source code, not the cPanel-ready artifact.
- The temporary URL build uses `/~vhplasti/` as its base path.
- The production build uses `/` as its base path.
- Generated folders such as `dist-cpanel` and `.deploy-artifacts` are ignored by git.
