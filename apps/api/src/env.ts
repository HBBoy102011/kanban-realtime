import "dotenv/config";

// API_PORT (not PORT): some environments predefine PORT, which would clash.
const parsedPort = Number.parseInt(process.env.API_PORT ?? "", 10);
const parsedAccessTtl = Number.parseInt(process.env.ACCESS_TOKEN_TTL ?? "", 10);

export const env = {
  port: Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 8787,
  // Short values are useful for manual reconnect checks.
  accessTokenTtl: Number.isFinite(parsedAccessTtl) && parsedAccessTtl > 0 ? parsedAccessTtl : 15 * 60,
  accessSecret: process.env.JWT_ACCESS_SECRET ?? "dev-access-secret-change-me",
  refreshSecret: process.env.JWT_REFRESH_SECRET ?? "dev-refresh-secret-change-me",
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  isProd: process.env.NODE_ENV === "production",
};
