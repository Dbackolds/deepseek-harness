# Session maintenance

- Preserve provenance when optimizing [format snapshots](session-format/README.md): only artifacts fully validated and deeply frozen by the format module may bypass repeated snapshot work. External frozen objects still require validation and detachment.
- Keep historical [JSONL migration](session-persistence-jsonl/README.md) serialized within each backend instance and run catalog computation in its owned worker. Waiters retain independent cancellation and resolve the current generation again after the owner settles; disposal waits for migration and thread exit. Never reuse a stale physical snapshot or weaken cross-process publication checks.
