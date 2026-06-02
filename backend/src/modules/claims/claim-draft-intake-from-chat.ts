import type { Message } from '../conversations/message.entity';
import type { ClaimIntakeFieldKey } from './claim-intake-config.entity';

const PG_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CLAIM_TYPES = ['AUTO', 'HOGAR', 'VIDA', 'OTRO'] as const;

export function resolvePromptedFieldKey(messages: Message[]): ClaimIntakeFieldKey | null {
  const outbound = [...messages]
    .reverse()
    .filter((m) => m.direction === 'OUTBOUND' && m.senderType === 'AI');
  for (const m of outbound) {
    const raw = m.rawPayload;
    if (raw?.kind === 'CLAIM_INTAKE_PROMPT' && typeof raw.fieldKey === 'string') {
      return raw.fieldKey as ClaimIntakeFieldKey;
    }
  }
  return null;
}

export function parseInboundForField(fieldKey: ClaimIntakeFieldKey, text: string): string | null {
  const t = text.trim();
  if (!t) return null;

  switch (fieldKey) {
    case 'customerId':
    case 'policyId': {
      const match = t.match(PG_UUID_RE);
      return match ? match[0] : null;
    }
    case 'type': {
      const upper = t.toUpperCase();
      if ((CLAIM_TYPES as readonly string[]).includes(upper)) return upper;
      // AUTO first so "robo de auto" matches AUTO before the HOGAR robo rule
      if (/auto|choque|accidente|veh[ií]culo|colisi[oó]n|automovilístico/i.test(t)) return 'AUTO';
      if (/hogar|incendio|casa|vivienda|robo|granizo|inundaci[oó]n|ca[ñn]er[ií]a|ca[ñn]o|pérdida.*agua|agua.*da[ñn]|techo|lluvia/i.test(t)) return 'HOGAR';
      if (/vida|fallec|inci[oó]/i.test(t)) return 'VIDA';
      return 'OTRO';
    }
    case 'eventDatetime': {
      return parseDateTimeLoose(t);
    }
    case 'eventLocation': {
      // Short answers (≤80 chars) are direct replies to "¿Dónde fue?" — return verbatim
      if (t.length <= 80) return t.length >= 2 ? t : null;
      // Longer free-form text: try to extract "en [lugar]" substring
      const m = t.match(/\ben\s+(?:el\s+|la\s+|los\s+|las\s+|un\s+|una\s+)?(.{3,70})(?:[,.]|$)/i);
      return m ? m[1].trim() : t.slice(0, 100);
    }
    case 'narrative':
      return t.length >= 3 ? t : null;
    default:
      return t;
  }
}

function parseDateTimeLoose(text: string): string | null {
  const iso = text.match(
    /\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2})?(?:[Zz]|[+-]\d{2}:?\d{2})?)?/,
  );
  if (iso) {
    const d = new Date(iso[0].replace(' ', 'T'));
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }

  const local = text.match(
    /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})(?:[^\d]+(\d{1,2}):(\d{2}))?/,
  );
  if (local) {
    const day = Number(local[1]);
    const month = Number(local[2]) - 1;
    let year = Number(local[3]);
    if (year < 100) year += 2000;
    const hour = local[4] ? Number(local[4]) : 12;
    const minute = local[5] ? Number(local[5]) : 0;
    const d = new Date(year, month, day, hour, minute);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  return null;
}
