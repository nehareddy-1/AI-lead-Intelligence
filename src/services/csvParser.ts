import { RawLead, ProcessedLead } from '../types/lead';

/**
 * Standard RFC 4180 CSV parser supporting multiline fields, quotes, and escaped quotes.
 */
export function parseCSV(csvText: string): { headers: string[]; rows: RawLead[]; error?: string } {
  try {
    const text = csvText.trim();
    if (!text) {
      return { headers: [], rows: [], error: 'The uploaded file is empty.' };
    }

    const lines: string[][] = [];
    let currentLine: string[] = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          currentField += '"';
          i++;
        } else {
          // Toggle quote mode
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        currentLine.push(currentField.trim());
        currentField = '';
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++; // skip \n
        }
        currentLine.push(currentField.trim());
        if (currentLine.some((f) => f.length > 0)) {
          lines.push(currentLine);
        }
        currentLine = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }

    // Flush last field if any
    if (currentField.length > 0 || currentLine.length > 0) {
      currentLine.push(currentField.trim());
      if (currentLine.some((f) => f.length > 0)) {
        lines.push(currentLine);
      }
    }

    if (lines.length < 2) {
      return { headers: [], rows: [], error: 'CSV must contain at least a header row and one lead record.' };
    }

    const rawHeaders = lines[0];
    const headers = rawHeaders.map((h) => h.trim());

    // Map common header variations to canonical fields
    const headerMap: Record<string, keyof RawLead> = {};
    headers.forEach((h, idx) => {
      const lower = h.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (lower.includes('name') || lower === 'fullname') headerMap[idx] = 'name';
      else if (lower.includes('phone') || lower.includes('mobile') || lower.includes('contact')) headerMap[idx] = 'phone';
      else if (lower.includes('email') || lower.includes('mail')) headerMap[idx] = 'email';
      else if (lower.includes('location') || lower.includes('city') || lower.includes('state')) headerMap[idx] = 'location';
      else if (lower.includes('education') || lower.includes('degree') || lower.includes('qualification')) headerMap[idx] = 'education';
      else if (lower.includes('experience') || lower.includes('exp') || lower.includes('workexp')) headerMap[idx] = 'experience';
      else if (lower.includes('german') || lower.includes('language') || lower.includes('proficiency')) headerMap[idx] = 'germanLevel';
      else if (lower.includes('source') || lower.includes('channel')) headerMap[idx] = 'leadSource';
      else if (lower.includes('contacted') || lower.includes('date')) headerMap[idx] = 'lastContacted';
      else if (lower.includes('conversation') || lower.includes('note') || lower.includes('message') || lower.includes('query')) headerMap[idx] = 'conversation';
      else headerMap[idx] = `col_${idx}` as any;
    });

    const rows: RawLead[] = [];
    for (let r = 1; r < lines.length; r++) {
      const rowValues = lines[r];
      // Skip empty lines
      if (rowValues.length === 1 && !rowValues[0]) continue;

      const lead: RawLead = {
        id: `L${String(r).padStart(3, '0')}`,
        name: 'Unknown Lead',
      };

      rowValues.forEach((val, cIdx) => {
        const key = headerMap[cIdx];
        if (key) {
          (lead as any)[key] = val;
        }
      });

      // Default name fallback if absent
      if (!lead.name || lead.name.trim() === '') {
        lead.name = `Lead ${lead.id}`;
      }

      rows.push(lead);
    }

    return { headers, rows };
  } catch (err: any) {
    return { headers: [], rows: [], error: `Failed to parse CSV file: ${err.message || 'Unknown error'}` };
  }
}

/**
 * Scan leads for missing critical values and duplicates
 */
export function analyzeDataset(leads: RawLead[]) {
  let missingCount = 0;
  const phoneMap = new Map<string, number>();
  const emailMap = new Map<string, number>();

  leads.forEach((l) => {
    // Missing check on key fields
    if (!l.education || !l.education.trim()) missingCount++;
    if (!l.experience || !l.experience.trim()) missingCount++;
    if (!l.germanLevel || !l.germanLevel.trim()) missingCount++;
    if (!l.conversation || !l.conversation.trim()) missingCount++;

    const normPhone = (l.phone || '').replace(/[^0-9]/g, '');
    const normEmail = (l.email || '').trim().toLowerCase();

    if (normPhone.length > 5) {
      phoneMap.set(normPhone, (phoneMap.get(normPhone) || 0) + 1);
    }
    if (normEmail.length > 3) {
      emailMap.set(normEmail, (emailMap.get(normEmail) || 0) + 1);
    }
  });

  let duplicateCount = 0;
  leads.forEach((l) => {
    const normPhone = (l.phone || '').replace(/[^0-9]/g, '');
    const normEmail = (l.email || '').trim().toLowerCase();
    const isDup = (normPhone && (phoneMap.get(normPhone) || 0) > 1) || (normEmail && (emailMap.get(normEmail) || 0) > 1);
    if (isDup) {
      duplicateCount++;
    }
  });

  return {
    missingCount,
    duplicateCount,
  };
}

/**
 * Escape field for CSV
 */
function escapeCSVField(val: any): string {
  if (val === null || val === undefined) return '""';
  if (Array.isArray(val)) {
    val = val.join('; ');
  }
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Generate CSV text with all 24 required fields
 */
export function generateProcessedCSV(leads: ProcessedLead[]): string {
  const headers = [
    'Lead ID',
    'Name',
    'Phone',
    'Email',
    'Location',
    'Education',
    'Experience',
    'German Level',
    'Original Conversation',
    'Duplicate Status',
    'Relevant',
    'Relevance Reason',
    'Confidence',
    'Profile',
    'Intent',
    'Needs',
    'Objections',
    'Missing Information',
    'Potential Opportunity',
    'Priority Score',
    'Priority',
    'Recommended Next Action',
    'Personalized Outreach',
    'QC Status',
    'QC Reason',
    'Evaluation Score',
    'Evaluation Status',
    'Evaluation Issues',
    'Run ID',
    'Prompt Versions',
  ];

  const rows = leads.map((lead) => {
    const evalScore = lead.evaluatorReport ? `${lead.evaluatorReport.weightedScore}%` : 'N/A';
    const evalStatus = lead.evaluatorReport ? lead.evaluatorReport.finalDecision : lead.qcStatus;
    const evalIssues = lead.evaluatorReport?.allIssues && lead.evaluatorReport.allIssues.length > 0
      ? lead.evaluatorReport.allIssues.join('; ')
      : 'None';
    const runId = lead.runId || 'RUN-2026-001';

    // Extract prompt versions from events if present
    const classifyVer = lead.executionEvents?.find((e) => e.component === 'classification')?.promptVersion || 'v1';
    const enrichVer = lead.executionEvents?.find((e) => e.component === 'enrichment')?.promptVersion || 'v1';
    const outreachVer = lead.executionEvents?.find((e) => e.component === 'outreach')?.promptVersion || 'v1';
    const evaluatorVer = lead.executionEvents?.find((e) => e.component === 'evaluator')?.promptVersion || 'v1';
    const promptVersions = `Classify:${classifyVer} Enrich:${enrichVer} Outreach:${outreachVer} Eval:${evaluatorVer}`;

    return [
      escapeCSVField(lead.id),
      escapeCSVField(lead.name),
      escapeCSVField(lead.phone || ''),
      escapeCSVField(lead.email || ''),
      escapeCSVField(lead.location || ''),
      escapeCSVField(lead.education || ''),
      escapeCSVField(lead.experience || ''),
      escapeCSVField(lead.germanLevel || ''),
      escapeCSVField(lead.conversation || ''),
      escapeCSVField(lead.duplicateStatus || 'None'),
      escapeCSVField(lead.relevant),
      escapeCSVField(lead.relevanceReason),
      escapeCSVField(`${lead.confidence}%`),
      escapeCSVField(lead.profile),
      escapeCSVField(lead.intent),
      escapeCSVField(lead.potentialNeeds),
      escapeCSVField(lead.objections),
      escapeCSVField(lead.missingInformation),
      escapeCSVField(lead.potentialOpportunity),
      escapeCSVField(lead.priorityScore),
      escapeCSVField(lead.priority),
      escapeCSVField(lead.recommendedNextAction),
      escapeCSVField(lead.personalizedOutreach),
      escapeCSVField(lead.qcStatus),
      escapeCSVField(lead.qcReason),
      escapeCSVField(evalScore),
      escapeCSVField(evalStatus),
      escapeCSVField(evalIssues),
      escapeCSVField(runId),
      escapeCSVField(promptVersions),
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
}

/**
 * Triggers browser download of text/CSV
 */
export function triggerDownload(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
