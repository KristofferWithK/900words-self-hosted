This directory contains the Swift wrapper source from Google's
`google-ai-edge/LiteRT-LM` repository at release `v0.16.0`, revision
`924e79c91542761242244e4f1651851f822e4cbb`.

It is vendored because the upstream tag includes missing Android Git LFS
objects, which prevents Swift Package Manager from checking out the repository
even though an iOS build does not use those files. The matching official Apple
binary is fetched directly from the v0.16.0 GitHub release and pinned by the
checksum published in that revision's `Package.swift`.

The source is licensed under Apache License 2.0. See `LICENSE` in this directory.
