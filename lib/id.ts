import { randomUUID } from "node:crypto";
export const id = (prefix: string) => prefix + "_" + randomUUID().replaceAll("-", "").slice(0, 12);