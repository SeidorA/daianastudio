# Publish a Studio candidate from the dedicated branch

Studio candidate publication lives only on `ci/studio-candidate-publish`. A reviewed control-file change selects one exact commit from `origin/feat/daiana-313`; the resulting `repository@sha256:...` reference is authoritative.

## Bootstrap safety

The setup PR adds this guide and `.github/workflows/studio-candidate-publish.yml`, but it does **not** add `.github/studio-candidate/source.sha`.

The workflow listens only for a push to `ci/studio-candidate-publish` that changes that exact control path. Merging the setup PR changes only the workflow and this guide, so bootstrap cannot trigger a build or publication.

## Publish a candidate

1. Fetch `origin/ci/studio-candidate-publish` and create a short-lived `ci/` branch from it.
2. Choose a full source commit that is already an ancestor of `origin/feat/daiana-313`.
3. Write exactly the lowercase 40-hex SHA followed by one newline to `.github/studio-candidate/source.sha`.
4. Open a PR targeting `ci/studio-candidate-publish`, not `main`, and obtain the required review.
5. Merge the PR. The resulting push starts one publication attempt.
6. Read the workflow summary and retain the `repository@sha256:...` digest reference as the candidate identity.

Example preparation and local validation:

```bash
git fetch origin ci/studio-candidate-publish feat/daiana-313
git switch --create ci/publish-studio-candidate origin/ci/studio-candidate-publish

source_sha=$(git rev-parse origin/feat/daiana-313)
git merge-base --is-ancestor "$source_sha" origin/feat/daiana-313
mkdir -p .github/studio-candidate
printf '%s\n' "$source_sha" > .github/studio-candidate/source.sha
test "$(wc -c < .github/studio-candidate/source.sha | tr -d ' ')" -eq 41
```

The workflow revalidates the exact bytes and ancestry after merge. It then checks out and cleans the selected source, builds the root `Dockerfile` for `linux/amd64` and `linux/arm64`, and publishes one attempt-scoped convenience tag:

```text
candidate-<source-sha>-run-<github-run-id>-attempt-<github-run-attempt>
```

The tag is a convenience locator, not authority. Automation and deployment records must use the verified digest reference from the workflow summary. The workflow never writes `latest`, release, or stable tags.

## Failure behavior

Publication fails closed when any of these checks fail:

-   The control file is missing, is a symlink, lacks one final newline, or contains bytes other than one lowercase 40-hex SHA and that newline.
-   The SHA does not identify a fetched commit or is not an ancestor of `origin/feat/daiana-313`.
-   The exact source checkout is dirty or lacks the root Docker build context.
-   Docker Hub credentials are unavailable or publication fails.
-   The returned digest is malformed, registry bytes do not hash to that digest, required OCI index annotations differ, or the runnable platforms are not exactly `linux/amd64` and `linux/arm64`.

## Rollback and recovery

Before merge, close the publication PR or correct its control file. No push reaches the dedicated branch, so no build starts.

After merge, do not rewrite or delete the attempt tag and do not treat it as rollback authority. If a candidate must be withdrawn, mark its immutable digest as rejected in the consuming system. A reviewed control-file PR selecting a known-good source creates a new attempt and a new digest; it does not mutate the rejected publication.

To retire the control plane, merge a separately reviewed PR that removes the workflow. Removing the workflow does not match the control-file path and therefore does not publish.

## Required branch protection

`ci/studio-candidate-publish` is a publication boundary and must be protected before the first control-file PR merges. Configure repository rules to:

-   Require pull requests and at least one approval from a maintainer other than the author.
-   Dismiss stale approvals and require approval after the latest push.
-   Require conversation resolution and all applicable PR checks.
-   Restrict direct pushes to the dedicated branch and disallow force pushes and deletion.
-   Apply the rules to administrators and any automation identity that does not need to merge reviewed publication PRs.

The repository currently has no protection or ruleset covering this branch. Its existing `Node CI` and `Test Docker Build` pull-request filters also use `'*'`, which does not match a slash-containing base branch. Before requiring those checks, explicitly include `ci/studio-candidate-publish` in their non-publishing PR triggers and confirm the check names on a test PR.

Until protection and substantive PR checks are configured, maintainers must treat publication as blocked even though the workflow exists.
