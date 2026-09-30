import { readAuthConfig, requireSameOrigin, requireUser } from "./auth-core";
import { authStore } from "./auth-store";
export const authConfig = readAuthConfig();
export const requireAuthentication = requireUser(authConfig, authStore);
export const sameOrigin = requireSameOrigin(authConfig);
export { authStore };
