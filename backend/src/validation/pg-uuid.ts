/** Alineado con Postgres UUID hex (incluye seeds demo que no son RFC v4 “perfectos”). */
export const PG_UUID_HEX_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
