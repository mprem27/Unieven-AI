# Database and media storage

You may keep MongoDB Atlas or operate MongoDB Community yourself. Self-hosted Community has no database license fee for this deployment, with MongoDB's SSPL terms applying. It is not unlimited free storage or free hosting. Capacity is the disk you provide, minus the operating system, images, database indexes/journal, uploaded files, logs and recovery headroom. Budget separately for encrypted backups outside the server. A free-tier hosted database has provider limits; a new provider is not activated by this package.

## Fresh self-hosted installation

Use a maintained server with enough RAM and monitored, durable disk. Start with a capacity estimate from expected students, document sizes, media retention and backup history. Video uploads can consume space much faster than academic records. The app accepts a maximum 25 MB per media upload; this is not a per-user total quota. Add and test quotas/retention if exposing uploads widely. The single MongoDB container below is a single point of failure; this example does not configure a replica set, encrypted database files or unattended backups. Use encrypted host storage and tested external backups. A production replica set on separate failure domains is a separate operational deployment.

For a fresh checkout with **no existing private files**, generate distinct random credentials and persistent encryption keys without printing them:

```sh
node scripts/prepare-self-hosted.mjs --origin=https://campus.your-college.edu
```

This creates `.private/campus.env`, `.private/academic.env`, `.private/mongo.env` and `.env.production`. It refuses to overwrite any existing configuration. It does not start services or create a hosted account. Restrict private-file permissions, especially NTFS ACLs on Windows; Node's Unix mode flags do not set Windows ACLs. Configure real SMTP/Brevo in `campus.env`, set your real certificate directory in `.env.production`, and follow the HTTPS/network steps in [deployment.md](deployment.md). The script creates a private academic bootstrap administrator with a random password; campus staff accounts still need provisioning through the existing procedure. Do not share these files.

```sh
node scripts/production-check.mjs --self-hosted
docker compose --env-file .env.production -f compose.production.yaml -f compose.mongo.yaml config --quiet
docker compose --env-file .env.production -f compose.production.yaml -f compose.mongo.yaml up -d --build --scale campus=3
docker compose --env-file .env.production -f compose.production.yaml -f compose.mongo.yaml ps
node scripts/production-check.mjs --self-hosted --url=https://campus.your-college.edu
```

All later commands for this stack must include both `-f` files. MongoDB's data volume is `mongo-data`; the campus files live in `campus-media`. Compose adds the project-name prefix to actual volume names. The initializer creates separate `readWrite` users scoped to `unieve_campus_v1` and `unieve_campus_attendance_v1`; the applications do not use the database root account. MongoDB has no published host port and is reachable only through its private Docker network. This same-host configuration uses authenticated MongoDB over that restricted bridge. If database traffic crosses a host or untrusted network, configure MongoDB TLS, private network access, verified certificates and appropriate firewall rules first.

The initializer runs **only on an empty data directory**. Editing passwords in `.private/mongo.env` does not change existing database accounts. Rotate accounts through authenticated database administration, update both application URIs securely and restart affected clients. Keep root credentials distinct from application credentials. Never publish port 27017 or give a campus application the root account.

## Existing Atlas deployment or stored data

Keep the Windows PowerShell/Atlas flow if it already meets your needs. For an existing installation, do not run the fresh-configuration generator in order to migrate: preserve every encryption key and both database names. Schedule a maintenance window; export both databases from Atlas with MongoDB Database Tools, create application users on the target, restore the databases/indexes, securely update the two private connection URIs and verify counts and authorized sample records. Preserve original backup copies and test rollback before opening access. URI passwords containing reserved characters must be percent encoded. Leave Atlas certificate verification enabled during export.

The optional MongoDB overlay reads root and scoped-user passwords from `.private/mongo.env`. When configuring it manually, supply `MONGO_INITDB_ROOT_USERNAME`, `MONGO_INITDB_ROOT_PASSWORD`, `MONGO_CAMPUS_USER`, `MONGO_CAMPUS_PASSWORD`, `MONGO_ACADEMIC_USER` and `MONGO_ACADEMIC_PASSWORD`; use separate randomly generated passwords of at least 32 characters. Campus must connect with its scoped user to `unieve_campus_v1` and academic with its own user to `unieve_campus_attendance_v1`, using the same database for each user's `authSource`. Do not enter real connection URIs in shell commands, screenshots, tickets or source files.

## Backups and restoration

Set a retention schedule and recovery-point/recovery-time targets appropriate for student records. Keep at least one encrypted copy on separate storage and restrict who can restore it. Back up both databases, media/private-proof bytes, configuration and original encryption keys. Monitor successful backup completion and available space. The existence of a volume or a backup file does not prove recoverability.

For the optional standalone MongoDB, take a consistent maintenance backup: stop the proxy and campus replicas to stop new writes, stop the academic worker and allow any database operations to finish, then use an authenticated `mongodump` against the running database and copy an archive to restricted backup storage. Pass database credentials through a protected MongoDB Tools configuration file or a secure prompt supported by the installed tool; do not put passwords/URIs on the command line. Use `mongorestore` against an isolated target to validate the archive, indexes and application behavior. A live standalone dump is not guaranteed to be a consistent snapshot across collections; a properly operated replica set with an appropriate oplog-aware backup method is needed for that workflow.

Back up media and private form proofs during the same write pause, so database references and files represent the same application state. A raw copy of a running MongoDB data directory is not a safe database backup. If using filesystem snapshots, use MongoDB's documented consistency procedure. Restore into new volumes first; never test restoration over the only production copy. Verify login, representative source records, media ownership/privacy and private proof access after restoration. Resume the stack only after verification. Do not delete volumes as part of routine upgrades.

## Several application hosts

The local store writes file bytes below `CAMPUS_MEDIA_DIR`, while metadata and authorization live in MongoDB. Every campus replica must read the same bytes for a given stored key, including private form proofs. Docker named volumes work across containers on one host; identically named volumes on different hosts contain different files.

A real multi-host deployment needs a shared object-storage adapter with authorization retained in the API (including range reads and private proofs), or a private shared filesystem with tested permissions, locking, durability and backups. There is no implemented cloud-object-store switch in V1.7. Never expose a shared bucket/directory publicly to work around missing files. Storing only database metadata in a common MongoDB does not share uploaded bytes.

Keep the academic service private and single-process until its pending AMS verification clients and routing are redesigned. Sharing campus sessions and rate counters is implemented; that does not distribute these upstream HTTP clients. Application hosts also need a private database network with TLS, consistent keys, versioned releases, job coordination, common rate limits and tested health/failover behavior. The supplied Compose example supports campus replicas on one host. It does not establish multi-host availability or production throughput.
