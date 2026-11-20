import { z } from "zod";

export const CRM_PROJECTS_ENV_NAME = "FRONTIER_PIXEL_CRM_CONVEX_URL";
export const CRM_PROJECT_IMAGES_V3_REQUIRED_ENV_NAME =
  "CRM_PROJECT_IMAGES_V3_REQUIRED";
export const CRM_PROJECTS_TENANT_SLUG = "shed210";

export type CrmProjectsEnv = {
  FRONTIER_PIXEL_CRM_CONVEX_URL?: string;
  CRM_PROJECT_IMAGES_V3_REQUIRED?: string;
  [name: string]: string | undefined;
};

const crmProjectsUrlSchema = z
  .string()
  .trim()
  .min(1, `${CRM_PROJECTS_ENV_NAME} is not configured`)
  .url(`${CRM_PROJECTS_ENV_NAME} must be a valid HTTPS URL`)
  .transform((value, context) => {
    const url = new URL(value);
    const isHttpsOrigin =
      url.protocol === "https:" &&
      url.username === "" &&
      url.password === "" &&
      url.port === "" &&
      (url.pathname === "" || url.pathname === "/") &&
      url.search === "" &&
      url.hash === "";

    if (!isHttpsOrigin) {
      context.addIssue({
        code: "custom",
        message: `${CRM_PROJECTS_ENV_NAME} must be an HTTPS origin without credentials, a port, path, query, or fragment`,
      });
      return z.NEVER;
    }

    return url.origin;
  });

export type CrmProjectImageRemotePattern = {
  protocol: "https";
  hostname: string;
  port: "";
  pathname: "/**";
};

export function parseCrmProjectsUrl(value: string | undefined): string {
  if (!value?.trim()) {
    throw new Error(`${CRM_PROJECTS_ENV_NAME} is not configured`);
  }
  return crmProjectsUrlSchema.parse(value);
}

export function getCrmProjectsUrl(
  env: CrmProjectsEnv = process.env
): string {
  return parseCrmProjectsUrl(env[CRM_PROJECTS_ENV_NAME]);
}

export function getCrmProjectImageRemotePattern(
  env: CrmProjectsEnv = process.env
): CrmProjectImageRemotePattern | null {
  const configuredUrl = env[CRM_PROJECTS_ENV_NAME]?.trim();
  if (!configuredUrl) return null;

  const url = new URL(parseCrmProjectsUrl(configuredUrl));
  return {
    protocol: "https",
    hostname: url.hostname,
    port: "",
    pathname: "/**",
  };
}

export function areCrmProjectImagesV3Required(
  env: CrmProjectsEnv = process.env
): boolean {
  const value = env[CRM_PROJECT_IMAGES_V3_REQUIRED_ENV_NAME]?.trim();
  if (!value || value === "false") return false;
  if (value === "true") return true;
  throw new Error(
    `${CRM_PROJECT_IMAGES_V3_REQUIRED_ENV_NAME} must be exactly "true" or "false"`
  );
}
