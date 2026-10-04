/**
 * caseReport.ts — Government-style PDF report generator
 * Uses browser's native print-to-PDF. Zero external dependencies.
 */

export interface ReportComplaint {
  id: string;
  tracking_id?: string | null;
  title: string;
  type: string;
  description: string;
  priority: string;
  status: string;
  location_address?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  evidence_note?: string | null;
  routed_to?: string | null;
  created_at: string;
  updated_at?: string | null;
  reporter_username?: string | null;
  reporter_full_name?: string | null;
  reporter_email?: string | null;
  images?: { image_url: string; file_name?: string }[];
  history?: {
    action: string;
    old_status?: string | null;
    new_status?: string | null;
    note?: string | null;
    actor_username?: string | null;
    created_at: string;
  }[];
}

const STATUS_LABELS: Record<string, string> = {
  submitted:    'Submitted',
  active:       'Submitted',
  under_review: 'Under Review',
  assigned:     'Assigned to Officer',
  in_progress:  'In Progress',
  resolved:     'Resolved',
  rejected:     'Rejected / Closed',
};

const ROUTE_LABELS: Record<string, string> = {
  police:          'Police Department',
  traffic_officer: 'Traffic Management',
  fire_service:    'Fire Service',
  emergency:       'Emergency Response',
  municipal:       'Municipal / Civic Department',
};

const PRIORITY_COLORS: Record<string, string> = {
  high:   '#ef4444',
  medium: '#f59e0b',
  low:    '#22c55e',
};

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

function fmtDateShort(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

export function generateCaseReportHTML(c: ReportComplaint, citizenView = true): string {
  const priorityColor = PRIORITY_COLORS[c.priority] || '#f59e0b';
  const statusLabel   = STATUS_LABELS[c.status] || c.status.replace(/_/g, ' ');
  const routeLabel    = c.routed_to ? (ROUTE_LABELS[c.routed_to] || c.routed_to) : 'Pending Review';
  const reportDate    = fmtDate(new Date().toISOString());
  const filedDate     = fmtDate(c.created_at);

  const historyRows = (c.history || []).map((h, i) => `
    <tr style="background:${i%2===0?'#f8fafc':'#ffffff'}">
      <td style="padding:8px 12px;font-size:11px;color:#374151;border-bottom:1px solid #e5e7eb;">
        ${fmtDateShort(h.created_at)}
      </td>
      <td style="padding:8px 12px;font-size:11px;color:#374151;border-bottom:1px solid #e5e7eb;text-transform:capitalize;">
        ${h.action.replace(/_/g,' ')}${h.new_status ? ' → ' + (STATUS_LABELS[h.new_status] || h.new_status.replace(/_/g,' ')) : ''}
      </td>
      <td style="padding:8px 12px;font-size:11px;color:#374151;border-bottom:1px solid #e5e7eb;">
        ${h.note || '—'}
      </td>
      <td style="padding:8px 12px;font-size:11px;color:#374151;border-bottom:1px solid #e5e7eb;">
        ${h.actor_username || 'System'}
      </td>
    </tr>
  `).join('');

  const imagesSection = (c.images || []).filter(img => img.image_url.startsWith('data:image')).length > 0
    ? `<div style="margin-top:24px;">
        <h3 style="font-size:13px;font-weight:700;color:#1e293b;margin:0 0 12px;padding-bottom:6px;border-bottom:2px solid #e2e8f0;text-transform:uppercase;letter-spacing:0.5px;">
          Evidence Attachments
        </h3>
        <div style="display:flex;gap:12px;flex-wrap:wrap;">
          ${(c.images || []).filter(img => img.image_url.startsWith('data:image')).map(img => `
            <div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;text-align:center;">
              <img src="${img.image_url}" style="max-width:160px;max-height:120px;object-fit:cover;display:block;" alt="Evidence"/>
              <p style="font-size:9px;color:#6b7280;padding:4px 6px;margin:0;border-top:1px solid #f1f5f9;">${img.file_name || 'Evidence'}</p>
            </div>
          `).join('')}
        </div>
      </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>SmartCity Case Report — ${c.tracking_id || c.id}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',Arial,sans-serif; background:#ffffff; color:#1e293b; font-size:13px; }
  @media print {
    body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .no-print { display:none !important; }
    @page { margin:15mm 12mm; size:A4 portrait; }
  }
  .page { max-width:800px; margin:0 auto; padding:32px 40px 48px; }
  .watermark {
    position:fixed; top:50%; left:50%;
    transform:translate(-50%,-50%) rotate(-30deg);
    font-size:80px; font-weight:900; color:rgba(0,0,0,0.04);
    white-space:nowrap; pointer-events:none; z-index:0;
    letter-spacing:4px;
  }
</style>
</head>
<body>
<div class="watermark">SMART CITY</div>
<div class="page">

  <!-- Header -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0f172a;padding-bottom:20px;margin-bottom:24px;">
    <div>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
        <div style="width:40px;height:40px;background:linear-gradient(135deg,#22d3ee,#22c55e);border-radius:8px;display:flex;align-items:center;justify-content:center;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
            <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4"/>
          </svg>
        </div>
        <div>
          <div style="font-size:20px;font-weight:900;color:#0f172a;letter-spacing:-0.5px;">SmartCity</div>
          <div style="font-size:10px;color:#64748b;margin-top:1px;">Integrated Urban Management Platform</div>
        </div>
      </div>
      <div style="font-size:10px;color:#94a3b8;margin-top:4px;">Government of India · Smart Cities Mission</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Case Report</div>
      <div style="font-size:22px;font-weight:900;color:#0f172a;font-family:monospace;letter-spacing:1px;">${c.tracking_id || 'ID-' + c.id.slice(0, 8).toUpperCase()}</div>
      <div style="font-size:10px;color:#94a3b8;margin-top:4px;">Generated: ${reportDate}</div>
    </div>
  </div>

  <!-- Status banner -->
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid ${priorityColor};border-radius:6px;padding:14px 18px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:center;">
    <div>
      <div style="font-size:16px;font-weight:800;color:#0f172a;">${c.title}</div>
      <div style="font-size:11px;color:#64748b;margin-top:3px;">${c.type}</div>
    </div>
    <div style="text-align:right;">
      <div style="display:inline-block;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;background:${
        c.status === 'resolved' ? '#dcfce7' : c.status === 'rejected' ? '#fee2e2' :
        c.status === 'in_progress' || c.status === 'assigned' ? '#ede9fe' : '#fef9c3'
      };color:${
        c.status === 'resolved' ? '#15803d' : c.status === 'rejected' ? '#dc2626' :
        c.status === 'in_progress' || c.status === 'assigned' ? '#6d28d9' : '#a16207'
      };text-transform:uppercase;letter-spacing:0.5px;">${statusLabel}</div>
      <div style="font-size:10px;color:#94a3b8;margin-top:4px;">
        Priority: <strong style="color:${priorityColor};text-transform:capitalize;">${c.priority}</strong>
      </div>
    </div>
  </div>

  <!-- Case Details Grid -->
  <h3 style="font-size:13px;font-weight:700;color:#1e293b;margin:0 0 12px;padding-bottom:6px;border-bottom:2px solid #e2e8f0;text-transform:uppercase;letter-spacing:0.5px;">
    Case Information
  </h3>
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
    <tr>
      <td style="padding:8px 12px;font-size:11px;font-weight:600;color:#64748b;width:35%;background:#f8fafc;border:1px solid #e2e8f0;">Tracking ID</td>
      <td style="padding:8px 12px;font-size:12px;color:#0f172a;font-family:monospace;font-weight:700;border:1px solid #e2e8f0;">${c.tracking_id || '—'}</td>
      <td style="padding:8px 12px;font-size:11px;font-weight:600;color:#64748b;width:25%;background:#f8fafc;border:1px solid #e2e8f0;">Filed On</td>
      <td style="padding:8px 12px;font-size:11px;color:#0f172a;border:1px solid #e2e8f0;">${filedDate}</td>
    </tr>
    <tr>
      <td style="padding:8px 12px;font-size:11px;font-weight:600;color:#64748b;background:#f8fafc;border:1px solid #e2e8f0;">Complaint Type</td>
      <td style="padding:8px 12px;font-size:11px;color:#0f172a;border:1px solid #e2e8f0;">${c.type}</td>
      <td style="padding:8px 12px;font-size:11px;font-weight:600;color:#64748b;background:#f8fafc;border:1px solid #e2e8f0;">Assigned To</td>
      <td style="padding:8px 12px;font-size:11px;color:#0f172a;border:1px solid #e2e8f0;">${routeLabel}</td>
    </tr>
    <tr>
      <td style="padding:8px 12px;font-size:11px;font-weight:600;color:#64748b;background:#f8fafc;border:1px solid #e2e8f0;">Current Status</td>
      <td style="padding:8px 12px;font-size:11px;color:#0f172a;border:1px solid #e2e8f0;">${statusLabel}</td>
      <td style="padding:8px 12px;font-size:11px;font-weight:600;color:#64748b;background:#f8fafc;border:1px solid #e2e8f0;">Last Updated</td>
      <td style="padding:8px 12px;font-size:11px;color:#0f172a;border:1px solid #e2e8f0;">${c.updated_at ? fmtDate(c.updated_at) : '—'}</td>
    </tr>
    <tr>
      <td style="padding:8px 12px;font-size:11px;font-weight:600;color:#64748b;background:#f8fafc;border:1px solid #e2e8f0;">Location</td>
      <td colspan="3" style="padding:8px 12px;font-size:11px;color:#0f172a;border:1px solid #e2e8f0;">
        ${c.location_address || 'Not specified'}
        ${c.location_lat ? `<br/><span style="font-size:10px;color:#94a3b8;">${c.location_lat.toFixed(6)}, ${c.location_lng?.toFixed(6)}</span>` : ''}
      </td>
    </tr>
    ${citizenView ? '' : `
    <tr>
      <td style="padding:8px 12px;font-size:11px;font-weight:600;color:#64748b;background:#f8fafc;border:1px solid #e2e8f0;">Reported By</td>
      <td colspan="3" style="padding:8px 12px;font-size:11px;color:#0f172a;border:1px solid #e2e8f0;">
        ${c.reporter_full_name || c.reporter_username || 'Unknown'}
        ${c.reporter_email ? ` &lt;${c.reporter_email}&gt;` : ''}
      </td>
    </tr>
    `}
  </table>

  <!-- Description -->
  <h3 style="font-size:13px;font-weight:700;color:#1e293b;margin:0 0 12px;padding-bottom:6px;border-bottom:2px solid #e2e8f0;text-transform:uppercase;letter-spacing:0.5px;">
    Complaint Description
  </h3>
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:14px 18px;margin-bottom:24px;line-height:1.7;font-size:12px;color:#374151;">
    ${c.description.replace(/\n/g, '<br/>')}
  </div>

  ${c.evidence_note ? `
  <!-- Evidence Note -->
  <h3 style="font-size:13px;font-weight:700;color:#1e293b;margin:0 0 12px;padding-bottom:6px;border-bottom:2px solid #e2e8f0;text-transform:uppercase;letter-spacing:0.5px;">
    Evidence Note
  </h3>
  <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:12px 16px;margin-bottom:24px;font-size:12px;color:#166534;line-height:1.6;">
    ${c.evidence_note.replace(/\n/g, '<br/>')}
  </div>
  ` : ''}

  ${(c.history || []).length > 0 ? `
  <!-- Activity Timeline -->
  <h3 style="font-size:13px;font-weight:700;color:#1e293b;margin:0 0 12px;padding-bottom:6px;border-bottom:2px solid #e2e8f0;text-transform:uppercase;letter-spacing:0.5px;">
    Case Activity & History
  </h3>
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:11px;">
    <thead>
      <tr style="background:#0f172a;color:white;">
        <th style="padding:8px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;border:1px solid #1e293b;">Date / Time</th>
        <th style="padding:8px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;border:1px solid #1e293b;">Action</th>
        <th style="padding:8px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;border:1px solid #1e293b;">Note</th>
        <th style="padding:8px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;border:1px solid #1e293b;">By</th>
      </tr>
    </thead>
    <tbody>
      ${historyRows}
    </tbody>
  </table>
  ` : ''}

  ${imagesSection}

  <!-- Legal Notice -->
  <div style="margin-top:32px;padding:14px 18px;background:#fefce8;border:1px solid #fde68a;border-radius:6px;">
    <div style="font-size:11px;font-weight:700;color:#92400e;margin-bottom:6px;">⚠ Legal Notice</div>
    <div style="font-size:10px;color:#78350f;line-height:1.6;">
      This document is an official record generated by the SmartCity Integrated Urban Management Platform. 
      Case ID ${c.tracking_id || c.id} has been registered with the municipal authorities. 
      Submitting false or fabricated information constitutes an offence under the Bharatiya Nyaya Sanhita (BNS) and relevant IT Act provisions. 
      All data is processed in accordance with applicable data protection laws.
    </div>
  </div>

  <!-- Footer -->
  <div style="margin-top:32px;padding-top:16px;border-top:2px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">
    <div style="font-size:10px;color:#94a3b8;">
      <strong>SmartCity Dashboard</strong> · Integrated Urban Management Platform<br/>
      Report generated: ${reportDate} · This is a computer-generated report
    </div>
    <div style="text-align:right;font-size:10px;color:#94a3b8;">
      <div style="font-size:16px;font-weight:900;color:#cbd5e1;font-family:monospace;">${c.tracking_id || c.id.slice(0, 8).toUpperCase()}</div>
      <div style="margin-top:2px;">OFFICIAL RECORD</div>
    </div>
  </div>

</div>
</body>
</html>`;
}

export function printCaseReport(c: ReportComplaint, citizenView = true): void {
  const html = generateCaseReportHTML(c, citizenView);
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) {
    alert('Pop-up blocked. Please allow pop-ups for this site to download the report.');
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  // Small delay so browser fully renders before print dialog
  setTimeout(() => {
    win.focus();
    win.print();
  }, 600);
}
