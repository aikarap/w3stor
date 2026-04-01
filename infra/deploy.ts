#!/usr/bin/env bun
/**
 * W3Stor Deploy Script
 *
 * Usage:
 *   bun infra/deploy.ts deploy              Full deploy (env + sync + build + migrate + restart)
 *   bun infra/deploy.ts restart [service]   Restart all or specific service
 *   bun infra/deploy.ts logs [service]      Tail logs (default: all)
 *   bun infra/deploy.ts status              Show service status
 *   bun infra/deploy.ts env                 Sync deploy.env to server only
 *   bun infra/deploy.ts scale <svc> <n>     Manual scale override
 */

const COMPOSE_FILE = "docker-compose.prod.yml";

function die(msg: string): never {
	console.error(`\x1b[31merror:\x1b[0m ${msg}`);
	process.exit(1);
}

function info(msg: string) {
	console.log(`\x1b[36m==>\x1b[0m ${msg}`);
}

function success(msg: string) {
	console.log(`\x1b[32m==>\x1b[0m ${msg}`);
}

async function loadDeployEnv(): Promise<{ host: string; remoteDir: string; envPath: string }> {
	const envPath = new URL("./deploy.env", import.meta.url).pathname;
	const file = Bun.file(envPath);

	if (!(await file.exists())) {
		die(`${envPath} not found. Copy deploy.env.example to deploy.env and fill in values.`);
	}

	const text = await file.text();
	const lines = text.split("\n");

	let host = "";
	let remoteDir = "/opt/w3stor";

	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed.startsWith("#") || !trimmed.includes("=")) continue;
		const [key, ...rest] = trimmed.split("=");
		const value = rest.join("=");
		if (key === "DEPLOY_HOST") host = value;
		if (key === "REMOTE_DIR") remoteDir = value;
	}

	if (!host) die("DEPLOY_HOST not set in deploy.env");
	return { host, remoteDir, envPath };
}

async function run(cmd: string[]): Promise<void> {
	console.log(`\x1b[90m$ ${cmd.join(" ")}\x1b[0m`);
	const proc = Bun.spawn(cmd, {
		stdout: "inherit",
		stderr: "inherit",
	});
	const code = await proc.exited;
	if (code !== 0) die(`Command failed with exit code ${code}`);
}

async function ssh(host: string, script: string): Promise<void> {
	console.log(`\x1b[90m$ ssh ${host} bash -s\x1b[0m`);
	const proc = Bun.spawn(["ssh", host, "bash", "-s"], {
		stdout: "inherit",
		stderr: "inherit",
		stdin: new TextEncoder().encode(script),
	});
	const code = await proc.exited;
	if (code !== 0) die(`SSH command failed with exit code ${code}`);
}

async function sshCmd(host: string, cmd: string): Promise<void> {
	await run(["ssh", host, cmd]);
}

// --- Commands ---

async function cmdEnv() {
	const { host, remoteDir, envPath } = await loadDeployEnv();
	info(`Syncing deploy.env → ${host}:${remoteDir}/.env.prod`);
	await run(["rsync", "-az", envPath, `${host}:${remoteDir}/.env.prod`]);
	success("ENV synced");
}

async function cmdDeploy() {
	const { host, remoteDir, envPath } = await loadDeployEnv();
	const repoRoot = new URL("..", import.meta.url).pathname;

	// 1. Sync env
	info(`Syncing deploy.env → ${host}:${remoteDir}/.env.prod`);
	await run(["rsync", "-az", envPath, `${host}:${remoteDir}/.env.prod`]);

	// 2. Sync project files
	info(`Syncing project to ${host}:${remoteDir}`);
	await run([
		"rsync", "-avz", "--delete",
		"--exclude=node_modules",
		"--exclude=.git",
		"--exclude=.next",
		"--exclude=.turbo",
		"--exclude=apps/web",
		"--exclude=.env",
		"--exclude=.env.prod",
		"--exclude=infra/deploy.env",
		repoRoot,
		`${host}:${remoteDir}/`,
	]);

	// 3. Build + migrate + restart on remote
	info("Building, migrating, and restarting on remote");
	const script = `
set -euo pipefail
cd ${remoteDir}

set -a && source .env.prod && set +a

echo "--- Building image (no cache) ---"
docker compose -f infra/${COMPOSE_FILE} build --no-cache api

echo "--- Running migrations ---"
docker compose -f infra/${COMPOSE_FILE} --profile migrate run --rm migrate

echo "--- Starting services ---"
docker compose -f infra/${COMPOSE_FILE} up -d --force-recreate --remove-orphans

echo "--- Waiting for API to start ---"
sleep 3

echo "--- Status ---"
docker compose -f infra/${COMPOSE_FILE} ps
docker compose -f infra/${COMPOSE_FILE} logs --tail=3 api
`;
	await ssh(host, script);
	success("Deploy complete!");
}

async function cmdRestart(service?: string) {
	const { host, remoteDir } = await loadDeployEnv();
	const target = service || "";
	info(`Restarting ${target || "all services"}`);
	await sshCmd(host, `cd ${remoteDir} && set -a && source .env.prod && set +a && docker compose -f infra/${COMPOSE_FILE} restart ${target}`);
	success("Restart complete");
}

async function cmdLogs(service?: string) {
	const { host, remoteDir } = await loadDeployEnv();
	const target = service || "";
	await run(["ssh", host, `cd ${remoteDir} && set -a && source .env.prod && set +a && docker compose -f infra/${COMPOSE_FILE} logs --tail=50 -f ${target}`]);
}

async function cmdStatus() {
	const { host, remoteDir } = await loadDeployEnv();
	await sshCmd(host, `cd ${remoteDir} && set -a && source .env.prod && set +a && docker compose -f infra/${COMPOSE_FILE} ps`);
}

async function cmdRebuild() {
	const { host, remoteDir, envPath } = await loadDeployEnv();

	// 1. Sync env
	info(`Syncing deploy.env → ${host}:${remoteDir}/.env.prod`);
	await run(["rsync", "-az", envPath, `${host}:${remoteDir}/.env.prod`]);

	// 2. Sync project files
	const repoRoot = new URL("..", import.meta.url).pathname;
	info(`Syncing project to ${host}:${remoteDir}`);
	await run([
		"rsync", "-avz", "--delete",
		"--exclude=node_modules",
		"--exclude=.git",
		"--exclude=.next",
		"--exclude=.turbo",
		"--exclude=apps/web",
		"--exclude=.env",
		"--exclude=.env.prod",
		"--exclude=infra/deploy.env",
		repoRoot,
		`${host}:${remoteDir}/`,
	]);

	// 3. Run rebuild script on remote
	info("Running rebuild on remote...");
	await sshCmd(host, `cd ${remoteDir} && bash infra/rebuild.sh`);
	success("Rebuild complete!");
}

async function cmdScale(service: string, count: string) {
	const { host, remoteDir } = await loadDeployEnv();
	const n = parseInt(count, 10);
	if (isNaN(n) || n < 0) die(`Invalid count: ${count}`);
	info(`Scaling ${service} to ${n}`);
	await sshCmd(host, `cd ${remoteDir} && set -a && source .env.prod && set +a && docker compose -f infra/${COMPOSE_FILE} up -d --scale ${service}=${n} --no-recreate ${service}`);
	success(`Scaled ${service} to ${n}`);
}

// --- CLI Router ---

const [command, ...args] = process.argv.slice(2);

switch (command) {
	case "deploy":
		await cmdDeploy();
		break;
	case "restart":
		await cmdRestart(args[0]);
		break;
	case "logs":
		await cmdLogs(args[0]);
		break;
	case "status":
		await cmdStatus();
		break;
	case "env":
		await cmdEnv();
		break;
	case "scale":
		if (args.length < 2) die("Usage: scale <service> <count>");
		await cmdScale(args[0], args[1]);
		break;
	case "rebuild":
		await cmdRebuild();
		break;
	default:
		console.log(`
W3Stor Deploy

Usage:
  bun infra/deploy.ts deploy              Full deploy (env + sync + build + migrate + restart)
  bun infra/deploy.ts rebuild             Tear down containers (keep volumes) + full rebuild
  bun infra/deploy.ts restart [service]   Restart all or specific service
  bun infra/deploy.ts logs [service]      Tail logs (default: all)
  bun infra/deploy.ts status              Show service status
  bun infra/deploy.ts env                 Sync deploy.env to server only
  bun infra/deploy.ts scale <svc> <n>     Manual scale override
`);
		if (command) die(`Unknown command: ${command}`);
}
