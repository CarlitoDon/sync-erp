# Hostinger SSH Host-Key Rotation Runbook

Document update: 2026-08-13. This is a design/procedure document, not a
provider/OOB verification record or live-deployment evidence.

This runbook covers rotation of the Hostinger server's SSH host identity used by
GitHub Actions. It is a procedure, not evidence that a rotation has happened.
No current fingerprint, public-key line, private key, secret value, owner, date,
provider ticket, or live deployment result is recorded here.

## Scope and safety boundary

The server host key and the deploy authentication key are different things:

- The server host key identifies the remote Hostinger endpoint. The active
  Hostinger workflows declare `HOSTINGER_SSH_KNOWN_HOSTS` as a required
  design/input contract only for the pinning helper until provider/OOB
  verification and live deployment evidence exist. A missing or invalid input
  fails closed. This runbook does not assert that the secret is configured,
  that its value is provider/OOB-approved, or that a live deployment consumed
  it.
- `HOSTINGER_SSH_KEY` and its passphrase authenticate the deployment client.
  Rotate them only through a separately approved credential procedure; do not
  substitute an authentication-key rotation for host-identity verification.

Never put host-key lines, fingerprints, private keys, passphrases, or decoded
secret values in Git, issues, pull requests, audit documents, workflow output,
or deployment artifacts. Use the approved GitHub secret/secret-manager path and
ephemeral runner files only.

## Current evidence boundary

[PR #84](https://github.com/CarlitoDon/sync-erp/pull/84) contains the CICD-003
code remediation at the observed head `e1f377361271450a789884554ef7ffbd665e6c71`.
The [CI/CD run #31693634711](https://github.com/CarlitoDon/sync-erp/actions/runs/31693634711)
passed its repository quality jobs, including the `Test Hostinger SSH pinning`
step in the [Quality Gates (API) job](https://github.com/CarlitoDon/sync-erp/actions/runs/31693634711/job/94426318093).
The [Playwright E2E run #31693634657](https://github.com/CarlitoDon/sync-erp/actions/runs/31693634657)
also passed. The API and web deploy jobs in the PR CI run were skipped.

This evidence proves repository/CI behavior only. The
`HOSTINGER_SSH_KNOWN_HOSTS` reference is still only a design/required-input
contract: this evidence does not prove that the secret exists, contains the
provider-approved key, or was used successfully against Hostinger.
Provider/OOB verification, a live SSH connection, a deployment, rollback, and
production closure remain separate gates.

## Preconditions

Before changing the secret:

1. Confirm the exact target hostname or address and SSH port. The checked-in
   deployment contract uses port `65002`; do not silently change the target or
   port as part of a key rotation.
2. Obtain the replacement host public key from an authoritative Hostinger
   provider channel or an approved out-of-band console. Verify the key and its
   fingerprint through an independent provider/OOB channel. DNS resolution,
   `ssh-keyscan` from a runner, or a first interactive connection is not an
   authority for accepting a replacement key.
3. Confirm that an authorized platform operator has approved the maintenance
   window and that an independent reviewer can check the target, port, and
   provider/OOB evidence. Record the actual provider reference privately; do
   not copy key material into this repository.
4. Check that no deployment or rollback transaction is in progress for the
   same Hostinger environment. If one is active, wait for it or follow the
   incident/change procedure rather than changing its trust input mid-run.

## Rotation procedure

### 1. Compare the old and replacement identities

Use the approved secret-management interface to inspect metadata or a redacted
comparison only. This step still treats `HOSTINGER_SSH_KNOWN_HOSTS` as a
design/required-input contract; do not print or copy its current value. Confirm
with the provider/OOB evidence:

- exact Hostinger target and port `65002`;
- the replacement public-key algorithm and fingerprint;
- why the change is required, such as provider replacement or a documented
  server rebuild; and
- whether the old identity is still valid during a controlled transition or
  has been retired.

If the provider/OOB identity, target, or reason is unclear, stop. Do not bypass
the mismatch to keep a deployment moving.

### 2. Prepare and validate a candidate outside Git

Prepare the complete reviewed OpenSSH `known_hosts` content through the
approved secret manager. The target entry must be an exact host/port record for
the verified endpoint, not a wildcard, negated entry, opportunistic scan, or
unreviewed first-connection result. If a transition temporarily permits more
than one verified key, document that exception privately and remove the retired
key as soon as the provider confirms it is no longer valid.

Validate the candidate in an ephemeral `RUNNER_TEMP` file using the existing
[`hostinger-ssh-pinning.sh`](../../scripts/hostinger-ssh-pinning.sh) helper or
the equivalent CI path. Validation must fail closed when the content is blank,
malformed, lacks an exact host/port pin, or contains an invalid host key. Keep
the file mode restricted, suppress all key/fingerprint output, and delete the
file after validation. Never paste the candidate into a shell command, commit,
log, artifact, or chat transcript.

The active Hostinger endpoint presents host certificates ahead of its raw host
keys during default OpenSSH negotiation. The workflows therefore require the
provider/OOB-verified raw `ssh-ed25519` key and explicitly set
`HostKeyAlgorithms=ssh-ed25519`. Keep the secret and this negotiation constraint
aligned; changing either requires a new provider/OOB verification and review.

### 3. Replace the Actions secret

Through the approved GitHub secret or secret-manager interface, replace the
value for the `HOSTINGER_SSH_KNOWN_HOSTS` required workflow input with the
provider/OOB-verified candidate. Until this external activation step and a
live deployment are separately evidenced, the name remains only a
design/required-input contract.

- Replace the whole reviewed value; do not edit a tracked file or workflow.
- Do not change `HOSTINGER_SSH_KEY` unless the separate authentication-key
  procedure is approved.
- Do not store the candidate in `.env`, an Actions variable intended for plain
  text, a deployment archive, or any repository documentation.
- Preserve the secret-update audit record and provider/OOB reference without
  exposing the value.

### 4. Perform a controlled read-only connection

After the secret update, run the normal pinning helper in the approved staging
or maintenance context and perform only a read-only SSH probe before allowing
any transfer or remote mutation. The connection must use the generated
temporary file and options equivalent to:

```text
ssh -p 65002 \
  -o HostKeyAlgorithms=ssh-ed25519 \
  -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile=<ephemeral-reviewed-known-hosts-file> \
  -o GlobalKnownHostsFile=none \
  <user>@<provider-verified-host> true
```

Do not replace `yes` with `no`, use `/dev/null` as the known-hosts file, or run
`ssh-keyscan` to make a failing probe pass. A mismatch is a stop condition.
The probe and its result must be recorded as a run reference and exit status,
not as key material.

### 5. Resume deployment only with explicit authorization

A successful read-only probe permits the separately authorized staging or
rollback workflow to proceed. It does not authorize production deployment by
itself. Capture the actual workflow/run reference, target environment, exact
release identity, health/readiness result, and rollback result when those
operations are approved. If the workflow is not run, record deployment and
rollback as unproven.

## Failure and rollback handling

- **Host-key mismatch:** stop the workflow and re-run provider/OOB verification.
  Never disable strict checking or accept a new key from the runner's network
  view.
- **Wrong secret or malformed content:** restore the last provider-confirmed
  value only if the old host identity is still confirmed valid. Otherwise keep
  the deployment blocked until a new provider/OOB-approved value is available.
- **Unexpected provider change:** hold deployment, obtain an authoritative
  explanation and replacement identity, and repeat the review. Do not treat a
  successful TCP connection as proof of the right host.
- **Authentication-key exposure:** follow the separate credential containment
  process to revoke/replace `HOSTINGER_SSH_KEY` and its passphrase. Do not put
  either value in this runbook or Git history.

## Evidence record (values excluded)

Record the following in the approved change/incident system, using the actual
non-secret fields and references at the time of the change:

- target and port;
- provider/OOB verification reference and independent review reference;
- secret-update audit reference;
- validation and read-only probe run references and results;
- subsequent staging deployment and rollback references, if authorized; and
- confirmation that no host-key line, fingerprint, private key, passphrase, or
  decoded secret was committed, logged, or retained in an artifact.

The [CICD-003 risk entry](../audits/2026-08-09-full-repository-audit/RISK-REGISTER.md)
remains open until the live/provider gates above are evidenced. The existing
CI checks and [PR #84](https://github.com/CarlitoDon/sync-erp/pull/84) are not
production-closure evidence.
