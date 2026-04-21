/**
 * Nimbus CLI config paths
 */
import { homedir } from "node:os";
import { join } from "node:path";

export const NIMBUS_DIR = join(homedir(), ".nimbus");
export const CONFIG_PATH = join(NIMBUS_DIR, "config.json");
export const CREDS_PATH = join(NIMBUS_DIR, "credentials.json");
