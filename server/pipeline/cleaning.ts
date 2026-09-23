import type { CleaningResult, CleanedLead, OriginalLead } from '../types/pipeline';
import { isEmail } from '../utils/validation';

const fields = ['name', 'email', 'phone', 'location', 'education', 'experience', 'germanLevel', 'leadSource', 'lastContacted', 'conversation'];
const spaced = (value: string) => value.trim().replace(/\s+/g, ' ');

// Ordered dataset contract: only valid normalized contacts match earlier successful rows.
// Names never establish duplicates. No rows are discarded.
export function cleanLead(original: OriginalLead, previous: CleaningResult[] = []): CleaningResult {
  const lead = structuredClone(original) as CleanedLead;
  const validation: CleaningResult['validation'] = { missingFields: [], invalidFields: [], warnings: [] };
  for (const field of fields) {
    const value = original[field];
    if (value !== undefined && value !== null && typeof value !== 'string') throw new Error('Invalid source field type');
    lead[field] = value == null || !value.trim() ? null : field === 'conversation' ? value.trim() : spaced(value);
    if (lead[field] === null) validation.missingFields.push(field);
  }
  if (lead.email) {
    lead.email = lead.email.toLowerCase();
    if (!isEmail(lead.email)) validation.invalidFields.push('email');
  }
  if (lead.phone) {
    // Remove only visual separators. Never infer a country code or strip unknown letters.
    const normalized = lead.phone.replace(/[\s().-]/g, '');
    if (/^\+?[0-9]{7,15}$/.test(normalized)) lead.phone = normalized;
    else validation.invalidFields.push('phone');
  }
  if (lead.germanLevel) {
    const normalized = lead.germanLevel.replace(/\s/g, '').toUpperCase();
    if (/^[ABC][12]$/.test(normalized)) lead.germanLevel = normalized;
    else if (!/^(none|beginner)$/i.test(lead.germanLevel)) validation.invalidFields.push('germanLevel');
  }
  // Preserve ambiguous experience verbatim after whitespace normalization; flag obvious negatives.
  if (lead.experience && /^-\d/.test(lead.experience)) validation.invalidFields.push('experience');
  if (validation.missingFields.includes('germanLevel')) validation.warnings.push('German proficiency was not provided.');
  for (const field of validation.invalidFields) validation.warnings.push(`Invalid ${field}; source value retained without guessing.`);
  const match = previous.find(item =>
    (lead.email && !validation.invalidFields.includes('email') && !item.validation.invalidFields.includes('email') && item.lead.email === lead.email) ||
    (lead.phone && !validation.invalidFields.includes('phone') && !item.validation.invalidFields.includes('phone') && item.lead.phone === lead.phone));
  const result: CleaningResult = { lead, validation, duplicateStatus: match ? 'Duplicate' : 'Unique' };
  if (match) {
    result.duplicateOfLeadId = match.lead.id;
    const emailMatch = lead.email && !validation.invalidFields.includes('email') && !match.validation.invalidFields.includes('email') && match.lead.email === lead.email;
    result.duplicateReason = emailMatch ? 'Normalized email exact match' : 'Normalized phone exact match';
  }
  return result;
}
