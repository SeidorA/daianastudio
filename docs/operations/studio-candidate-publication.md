# Publish a Studio candidate from the dedicated branch

Studio candidate publication lives only on `ci/studio-candidate-publish`. A reviewed control-file change selects one exact commit from `origin/feat/daiana-313`; the resulting `repository@sha256:...` reference is authoritative.

## Bootstrap safety

The setup PR adds this guide, `.github/workflows/studio-candidate-publish.yml`, and `.github/workflows/studio-candidate-validate.yml`, but it does **not** add `.github/studio-candidate/source.sha`.

The publisher listens only for a push to `ci/studio-candidate-publish` that changes that exact control path. The `pull_request_target` validator runs base-branch-trusted logic, reads proposed paths and control bytes only through the GitHub API, and never checks out or executes PR content. Merging the three bootstrap files therefore cannot trigger publication.

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

`ci/studio-candidate-publish` is a publication boundary. Stage 1 protects bootstrap while the validation workflow is not yet present on the base branch:

-   Require pull requests with zero approvals only for bootstrap.
-   Dismiss stale reviews, require conversation resolution, and enforce the rules for administrators.
-   Disallow direct and force pushes and branch deletion.
-   Do not require a status check that does not yet exist on the base branch.

Immediately after the setup PR merges, move to stage 2:

-   Require the stable `Studio candidate validation` check and one approval from a maintainer other than the author.
-   Dismiss stale approvals and require approval after the latest push.
-   Keep conversation resolution and administrator enforcement enabled.
-   Keep direct pushes, force pushes, and branch deletion disabled.
