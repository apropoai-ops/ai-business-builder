import type { GatewayDriver } from "@/lib/gateways/types";
import { growDriver } from "@/lib/gateways/providers/grow";
import { cardcomDriver } from "@/lib/gateways/providers/cardcom";
import { tranzilaDriver } from "@/lib/gateways/providers/tranzila";
import { payplusDriver } from "@/lib/gateways/providers/payplus";
import { pelecardDriver } from "@/lib/gateways/providers/pelecard";
import { icreditDriver } from "@/lib/gateways/providers/icredit";
import { demoDriver } from "@/lib/gateways/providers/demo";

/**
 * Registry of all supported merchant payment gateways. Display order = the
 * order shown on the "ספקי סליקה" connect page.
 */
export const GATEWAYS: GatewayDriver[] = [
  growDriver,
  cardcomDriver,
  tranzilaDriver,
  payplusDriver,
  pelecardDriver,
  icreditDriver,
  demoDriver,
];

export const GATEWAY_KEYS = GATEWAYS.map((g) => g.key);

export function getGateway(key: string): GatewayDriver | undefined {
  return GATEWAYS.find((g) => g.key === key);
}

/** Public (no-secrets) metadata for rendering the connect UI. */
export function listGatewayMeta() {
  return GATEWAYS.map((g) => ({
    key: g.key,
    label: g.label,
    description: g.description,
    docsUrl: g.docsUrl,
    credentialFields: g.credentialFields,
  }));
}

export type GatewayMeta = ReturnType<typeof listGatewayMeta>[number];
