/**
 * Persistencia de la API key de argenprovider por usuario final. Cada
 * plataforma inyecta su propia implementación (Prisma, Firestore, etc.) —
 * el SDK no asume ningún storage concreto.
 */
export interface KeyStore {
  get(externalId: string): Promise<string | null>;
  save(externalId: string, apiKey: string, meta: { providerUserId?: string }): Promise<void>;
  delete(externalId: string): Promise<void>;
}
