import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

interface HelmetOptions {
  contentSecurityPolicy?: boolean | Record<string, unknown>;
  crossOriginEmbedderPolicy?: boolean | { policy?: string };
  crossOriginOpenerPolicy?: boolean | { policy?: string };
  crossOriginResourcePolicy?: boolean | { policy?: string };
  originAgentCluster?: boolean;
  referrerPolicy?: boolean | { policy?: string | string[] };
  strictTransportSecurity?: boolean | { maxAge?: number; includeSubDomains?: boolean; preload?: boolean };
  xContentTypeOptions?: boolean;
  xDnsPrefetchControl?: boolean | { allow?: boolean };
  xDownloadOptions?: boolean;
  xFrameOptions?: boolean | { action?: string };
  xPermittedCrossDomainPolicies?: boolean | { permittedPolicies?: string };
  xPoweredBy?: boolean;
  xXssProtection?: boolean;
}

type HelmetMiddleware = (req: unknown, res: unknown, next: (err?: unknown) => void) => void;

const helmet = require("helmet") as (options?: HelmetOptions) => HelmetMiddleware;

export default helmet;
