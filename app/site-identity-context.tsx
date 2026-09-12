"use client";

import { createContext, useContext, type ReactNode } from "react";
import { siteIdentities, type SiteIdentity } from "./site-identity";

const SiteIdentityContext = createContext<SiteIdentity>(siteIdentities["airchurch.net"]);
export function SiteIdentityProvider({ identity, children }: { identity: SiteIdentity; children: ReactNode }) {
  return <SiteIdentityContext.Provider value={identity}>{children}</SiteIdentityContext.Provider>;
}
export function useSiteIdentity() { return useContext(SiteIdentityContext); }
