/**
 * Pure-JS PDF 1.4 Invoice Generator for S C Courier Service
 * Generates a crisp, multi-column vector PDF document buffer with zero external dependencies.
 */

function escapePdfText(str) {
  return String(str == null ? '' : str)
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function formatLkr(num) {
  const val = Number(num || 0);
  return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function truncateStr(str, maxLen) {
  const s = String(str || '');
  return s.length > maxLen ? s.slice(0, maxLen - 2) + '..' : s;
}

function wrapTextLines(str, maxChars) {
  const clean = String(str == null ? '' : str).replace(/\s+/g, ' ').trim();
  if (!clean) return ['-'];
  const words = clean.split(' ');
  const lines = [];
  let current = '';

  for (const word of words) {
    if (!current) {
      if (word.length > maxChars) {
        for (let i = 0; i < word.length; i += maxChars) {
          lines.push(word.slice(i, i + maxChars));
        }
        current = lines.pop() || '';
      } else {
        current = word;
      }
    } else if (current.length + 1 + word.length <= maxChars) {
      current += ' ' + word;
    } else {
      lines.push(current);
      if (word.length > maxChars) {
        for (let i = 0; i < word.length; i += maxChars) {
          lines.push(word.slice(i, i + maxChars));
        }
        current = lines.pop() || '';
      } else {
        current = word;
      }
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Generates a complete PDF Buffer for a Personal or Corporate Invoice
 * @param {Object} invoice - Normalized invoice object
 * @returns {Buffer} PDF 1.4 binary buffer
 */
function generateInvoicePdfBuffer(invoice) {
  const pageWidth = 595.28; // A4 width in pt
  const pageHeight = 841.89; // A4 height in pt
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;

  const ops = [];

  // Helper drawing functions
  const drawRect = (x, yTop, w, h, fillRgb, strokeRgb) => {
    const pdfY = pageHeight - yTop - h;
    ops.push('q');
    if (fillRgb) {
      ops.push(`${fillRgb[0]} ${fillRgb[1]} ${fillRgb[2]} rg`);
    }
    if (strokeRgb) {
      ops.push(`${strokeRgb[0]} ${strokeRgb[1]} ${strokeRgb[2]} RG`);
      ops.push('0.75 w');
    }
    const mode = fillRgb && strokeRgb ? 'B' : fillRgb ? 'f' : 'S';
    ops.push(`${x.toFixed(2)} ${pdfY.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re ${mode}`);
    ops.push('Q');
  };

  const drawLine = (x1, yTop1, x2, yTop2, strokeRgb = [0.85, 0.88, 0.92], lineWidth = 0.75) => {
    const py1 = pageHeight - yTop1;
    const py2 = pageHeight - yTop2;
    ops.push('q');
    ops.push(`${strokeRgb[0]} ${strokeRgb[1]} ${strokeRgb[2]} RG`);
    ops.push(`${lineWidth} w`);
    ops.push(`${x1.toFixed(2)} ${py1.toFixed(2)} m ${x2.toFixed(2)} ${py2.toFixed(2)} l S`);
    ops.push('Q');
  };

  const drawText = (text, x, yTop, fontSize = 10, bold = false, rgb = [0.1, 0.14, 0.2]) => {
    const py = pageHeight - yTop - fontSize * 0.8;
    const fontName = bold ? '/F2' : '/F1';
    ops.push('BT');
    ops.push(`${fontName} ${fontSize} Tf`);
    ops.push(`${rgb[0]} ${rgb[1]} ${rgb[2]} rg`);
    ops.push(`${x.toFixed(2)} ${py.toFixed(2)} Td`);
    ops.push(`(${escapePdfText(text)}) Tj`);
    ops.push('ET');
  };

  const drawRightText = (text, rightX, yTop, fontSize = 10, bold = false, rgb = [0.1, 0.14, 0.2]) => {
    const s = String(text == null ? '' : text);
    const approxWidth = s.length * fontSize * (bold ? 0.54 : 0.5);
    drawText(s, Math.max(margin, rightX - approxWidth), yTop, fontSize, bold, rgb);
  };

  // 1. Top Header Banner
  const isCorp = invoice.customer_type === 'Corporate';
  const bannerColor = isCorp ? [0.06, 0.09, 0.16] : [0.92, 0.35, 0.05];
  drawRect(0, 0, pageWidth, 105, bannerColor, null);

  drawText('S C COURIER SERVICE', margin, 22, 18, true, [1, 1, 1]);
  drawText('No. 425/A, Nasewana Waththa, Mandawala Road, Radawana, Sri Lanka', margin, 45, 9, false, [0.9, 0.93, 0.98]);
  drawText('Tel: 077-6719470 / 076-9772797  |  Email: sccourier369@gmail.com', margin, 59, 9, false, [0.9, 0.93, 0.98]);
  drawText(
    isCorp ? 'CONSOLIDATED CORPORATE SERVICE INVOICE' : 'PERSONAL COURIER DELIVERY INVOICE',
    margin,
    77,
    10,
    true,
    [0.98, 0.82, 0.45]
  );

  // Invoice Badge on Right of Banner
  drawRightText('INVOICE', pageWidth - margin, 22, 16, true, [1, 1, 1]);
  drawRightText(`#${invoice.invoice_number}`, pageWidth - margin, 43, 11, true, [0.98, 0.82, 0.45]);
  drawRightText(`Status: ${String(invoice.payment_status || 'Unpaid').toUpperCase()}`, pageWidth - margin, 60, 9.5, true, [0.85, 0.98, 0.9]);
  drawRightText(`Issued: ${invoice.issue_date || new Date().toISOString().split('T')[0]}`, pageWidth - margin, 76, 9, false, [0.9, 0.93, 0.98]);

  // 2. Billed To & Invoice Metadata Box
  let y = 118;
  drawRect(margin, y, contentWidth, 96, [0.97, 0.98, 0.99], [0.85, 0.88, 0.92]);
  drawLine(margin + contentWidth * 0.52, y, margin + contentWidth * 0.52, y + 96, [0.85, 0.88, 0.92]);

  // Left Column: Customer / Company & Department Details
  drawText('BILLED TO:', margin + 12, y + 8, 8.5, true, [0.4, 0.45, 0.55]);
  drawText(truncateStr(invoice.company_name || invoice.customer_name || 'Valued Customer', 45), margin + 12, y + 21, 11, true, [0.06, 0.09, 0.16]);
  if (isCorp) {
    const deptLabel = invoice.department_name || 'Operations Department';
    drawText(truncateStr(deptLabel, 45), margin + 12, y + 35, 9.5, true, [0.15, 0.35, 0.75]);
    const attnName = invoice.customer_name || 'Authorized Officer';
    drawText(`Attn: ${truncateStr(attnName, 44)}`, margin + 12, y + 49, 8.5, false, [0.2, 0.25, 0.32]);
    drawText(`Address: ${truncateStr(invoice.billing_address || 'Sri Lanka', 44)}`, margin + 12, y + 62, 8.5, false, [0.25, 0.3, 0.38]);
  } else {
    drawText(`Customer Type: Personal Delivery`, margin + 12, y + 36, 9, false, [0.25, 0.3, 0.38]);
    drawText(`Address: ${truncateStr(invoice.billing_address || 'Sri Lanka', 46)}`, margin + 12, y + 51, 8.5, false, [0.25, 0.3, 0.38]);
  }
  drawText(`Email: ${truncateStr(invoice.billing_email || invoice.customer_email || 'N/A', 30)} | Tel: ${invoice.customer_phone || 'N/A'}`, margin + 12, y + 76, 8, false, [0.25, 0.3, 0.38]);

  // Right Column: Invoice Summary Metadata
  const metaX = margin + contentWidth * 0.52 + 12;
  drawText('INVOICE & BILLING DETAILS:', metaX, y + 10, 8.5, true, [0.4, 0.45, 0.55]);
  drawText(`Invoice Number: ${invoice.invoice_number}`, metaX, y + 25, 9, true, [0.06, 0.09, 0.16]);
  drawText(`Billing Cycle: ${invoice.invoice_frequency || (isCorp ? 'Monthly' : 'Per Request')}`, metaX, y + 40, 9, false, [0.25, 0.3, 0.38]);
  drawText(`Billing Period: ${invoice.billing_period_label || invoice.issue_date || 'Single Shipment'}`, metaX, y + 55, 9, false, [0.25, 0.3, 0.38]);
  drawText(`Payment Terms: ${invoice.payment_terms || (isCorp ? 'Net 15 Days' : 'Due on Receipt')}`, metaX, y + 70, 9, false, [0.25, 0.3, 0.38]);

  y += 110;

  // 3. Shipments / Line Items Table Header
  drawRect(margin, y, contentWidth, 24, [0.06, 0.09, 0.16], null);
  drawText('#', margin + 6, y + 7, 8.5, true, [1, 1, 1]);
  drawText('Ref ID', margin + 22, y + 7, 8.5, true, [1, 1, 1]);
  drawText('Date', margin + 96, y + 7, 8.5, true, [1, 1, 1]);
  drawText('Pickup, Delivery & Description', margin + 148, y + 7, 8.5, true, [1, 1, 1]);
  drawText('Service / Rate Details', margin + 350, y + 7, 8.5, true, [1, 1, 1]);
  drawRightText('Charge (LKR)', pageWidth - margin - 8, y + 7, 8.5, true, [1, 1, 1]);

  y += 24;

  // 4. Table Rows (Multi-line wrapped so full description & details are always visible)
  const items = Array.isArray(invoice.line_items) ? invoice.line_items : [];
  const maxRows = Math.min(items.length, 14);

  for (let i = 0; i < maxRows; i++) {
    const item = items[i];

    // Wrap Ref ID (up to 16 chars per line)
    const refLines = wrapTextLines(item.ref_number || item.request_id || '-', 16);

    // Build full Pickup + Delivery/Description lines (up to 44 chars per line)
    const descLines = [];
    if (item.pickup_details && item.delivery_details) {
      const pickupWrapped = wrapTextLines(`Pickup: ${item.pickup_details}`, 44);
      const label = isCorp ? 'Description' : 'Dropoff';
      const deliveryWrapped = wrapTextLines(`${label}: ${item.delivery_details}`, 44);
      descLines.push(...pickupWrapped, ...deliveryWrapped);
    } else {
      const singleRoute = item.route_summary || item.delivery_details || item.pickup_details || 'Standard Courier Route';
      descLines.push(...wrapTextLines(singleRoute, 44));
    }

    // Build Service / Parcel + Distance & Rate lines (up to 22 chars per line)
    const rawService = String(item.parcel_or_vehicle || 'Courier');
    const serviceLines = [...wrapTextLines(rawService, 22)];
    if (item.distance_km && item.rate_lkr && !rawService.toLowerCase().includes('km')) {
      const basis = item.is_actual ? 'Actual' : (item.source_type === 'atr' ? 'Est.' : '');
      serviceLines.push(...wrapTextLines(`${item.distance_km} km @ LKR ${item.rate_lkr}/km${basis ? ` [${basis}]` : ''}`, 22));
    } else if (item.is_actual && rawService.toLowerCase().includes('km')) {
      serviceLines.push('[Actual Billed]');
    }

    const maxLinesInRow = Math.max(refLines.length, descLines.length, serviceLines.length, 1);
    const lineSpacing = 11;
    const rowHeight = Math.max(28, maxLinesInRow * lineSpacing + 10);

    // Stop if next row would overflow into the totals/footer region
    if (y + rowHeight > pageHeight - 165 && i > 0) {
      drawRect(margin, y, contentWidth, 20, [0.96, 0.97, 0.99], [0.9, 0.92, 0.95]);
      drawText(`+ ${items.length - i} additional shipment(s) included in consolidated total`, margin + 12, y + 5, 8.5, true, [0.4, 0.45, 0.55]);
      y += 20;
      break;
    }

    const bg = i % 2 === 0 ? [1, 1, 1] : [0.97, 0.98, 1.0];
    drawRect(margin, y, contentWidth, rowHeight, bg, [0.9, 0.92, 0.95]);

    const textStartY = y + 6;

    // Column 1: #
    drawText(String(i + 1), margin + 6, textStartY, 8, false, [0.2, 0.24, 0.3]);

    // Column 2: Ref ID
    refLines.forEach((line, idx) => {
      drawText(line, margin + 22, textStartY + idx * lineSpacing, 8, true, [0.06, 0.09, 0.16]);
    });

    // Column 3: Date
    drawText(truncateStr(item.shipment_date || '-', 10), margin + 96, textStartY, 8, false, [0.25, 0.3, 0.38]);

    // Column 4: Pickup, Delivery & Description (Multi-line)
    descLines.forEach((line, idx) => {
      const isHighlight = line.startsWith('Description:') || line.startsWith('Dropoff:');
      drawText(
        line,
        margin + 148,
        textStartY + idx * lineSpacing,
        8,
        isHighlight,
        isHighlight ? [0.08, 0.15, 0.28] : [0.22, 0.28, 0.36]
      );
    });

    // Column 5: Service / Rate Details (Multi-line)
    serviceLines.forEach((line, idx) => {
      drawText(line, margin + 350, textStartY + idx * lineSpacing, 8, idx === 0, [0.25, 0.3, 0.38]);
    });

    // Column 6: Charge (LKR)
    drawRightText(formatLkr(item.amount_lkr), pageWidth - margin - 8, textStartY, 8.5, true, [0.06, 0.09, 0.16]);

    y += rowHeight;
  }

  if (items.length > maxRows) {
    drawRect(margin, y, contentWidth, 20, [0.96, 0.97, 0.99], [0.9, 0.92, 0.95]);
    drawText(`+ ${items.length - maxRows} additional shipment(s) included in consolidated total`, margin + 12, y + 5, 8.5, true, [0.4, 0.45, 0.55]);
    y += 20;
  }

  y += 14;

  // 5. Totals & Summary Box
  const summaryWidth = 240;
  const summaryX = pageWidth - margin - summaryWidth;
  drawRect(summaryX, y, summaryWidth, 94, [0.97, 0.98, 0.99], [0.85, 0.88, 0.92]);

  drawText('Total Shipments:', summaryX + 12, y + 10, 9, false, [0.3, 0.35, 0.45]);
  drawRightText(String(invoice.total_shipments || items.length || 1), pageWidth - margin - 12, y + 10, 9, true, [0.1, 0.14, 0.2]);

  drawText('Subtotal (LKR):', summaryX + 12, y + 26, 9, false, [0.3, 0.35, 0.45]);
  drawRightText(`LKR ${formatLkr(invoice.subtotal ?? invoice.total_payable)}`, pageWidth - margin - 12, y + 26, 9, true, [0.1, 0.14, 0.2]);

  drawText('Tax / Additional (LKR):', summaryX + 12, y + 42, 9, false, [0.3, 0.35, 0.45]);
  drawRightText(`LKR ${formatLkr((Number(invoice.tax_amount || 0) + Number(invoice.additional_charges || 0)))}`, pageWidth - margin - 12, y + 42, 9, false, [0.1, 0.14, 0.2]);

  drawLine(summaryX + 10, y + 58, pageWidth - margin - 10, y + 58, [0.75, 0.8, 0.86], 1);

  drawRect(summaryX, y + 62, summaryWidth, 32, [0.06, 0.09, 0.16], null);
  drawText('FINAL TOTAL PAYABLE:', summaryX + 12, y + 73, 9.5, true, [1, 1, 1]);
  drawRightText(`LKR ${formatLkr(invoice.total_payable)}`, pageWidth - margin - 12, y + 73, 10.5, true, [0.98, 0.82, 0.45]);

  // Left side payment instructions
  drawText('PAYMENT & REMITTANCE NOTES:', margin, y + 8, 9, true, [0.06, 0.09, 0.16]);
  drawText(`1. Please quote Invoice #${invoice.invoice_number} with your payment.`, margin, y + 24, 8.5, false, [0.3, 0.35, 0.45]);
  drawText(`2. Payment Terms: ${invoice.payment_terms || (isCorp ? 'Net 15 Days' : 'Due on Receipt')}.`, margin, y + 38, 8.5, false, [0.3, 0.35, 0.45]);
  drawText(`3. Payment Status: ${invoice.payment_status || 'Unpaid'}.`, margin, y + 52, 8.5, true, [0.15, 0.2, 0.3]);
  drawText('4. For billing inquiries: 077-6719470 / 076-9772797', margin, y + 66, 8.5, false, [0.3, 0.35, 0.45]);

  // 6. Footer
  const footerY = pageHeight - 48;
  drawLine(margin, footerY - 8, pageWidth - margin, footerY - 8, [0.85, 0.88, 0.92], 0.75);
  drawText('Thank you for choosing S C Courier Service. This is an official computer-generated invoice.', margin, footerY, 8.5, false, [0.45, 0.5, 0.58]);
  drawRightText('S C Courier Service - Radawana, Sri Lanka', pageWidth - margin, footerY, 8.5, true, [0.35, 0.4, 0.48]);

  const contentStream = ops.join('\n');

  // Assemble PDF 1.4 objects
  const objects = [];
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  objects.push(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(2)} ${pageHeight.toFixed(2)}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n`
  );
  objects.push('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n');
  objects.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n');
  objects.push(
    `6 0 obj\n<< /Length ${Buffer.byteLength(contentStream, 'utf8')} >>\nstream\n${contentStream}\nendstream\nendobj\n`
  );

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += obj;
  }

  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, 'utf8');
}

module.exports = {
  generateInvoicePdfBuffer,
  formatLkr
};
