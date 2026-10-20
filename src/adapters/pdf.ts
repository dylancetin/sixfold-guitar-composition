import { createRequire } from 'node:module';
import PDFDocument from 'pdfkit';
import SVGtoPDF from 'svg-to-pdfkit';
import type { NotationLayout } from './alpha-tab';
import { checkAbort, requireAdapter } from './errors';

export type PdfPageSize = 'A4' | 'LETTER';
export type PdfPagination = { scale: number; pages: { number: number; width: number; height: number; systems: number[] }[] };

/** Complete-system pagination, explicit Bravura embedding and one global SVG scale (U02). */
export async function encodePdf(layout: NotationLayout, caption: string, size: PdfPageSize = 'A4', signal?: AbortSignal): Promise<{ bytes: Uint8Array; pagination: PdfPagination }> {
  checkAbort(signal);
  const require = createRequire(import.meta.url);
  const fontPath = require.resolve('@coderline/alphatab/font/Bravura.otf');
  const doc = new PDFDocument({ size, margin: 0, autoFirstPage: false, compress: true, info: { Title: 'Solo guitar arrangement', Subject: caption } });
  const chunks: Buffer[] = [];
  const done = new Promise<Uint8Array>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk)); doc.on('error', reject);
    doc.on('end', () => resolve(new Uint8Array(Buffer.concat(chunks))));
  });
  doc.registerFont('alphaTab', fontPath);
  const pages: PdfPagination['pages'] = [];
  const warnings: string[] = [];
  let y = 40;
  const addPage = () => {
    doc.addPage({ size, margin: 0 });
    pages.push({ number: pages.length + 1, width: doc.page.width, height: doc.page.height, systems: [] });
    doc.font('Helvetica').fontSize(7).fillColor('#333333').text(caption, 28, 15, { width: doc.page.width - 56, height: 20, lineBreak: true });
    doc.text(`${size} - ${pages.length} | S=original bar, P=pass | capo-relative TAB; written = sounding + 12`, 28, doc.page.height - 22, { lineBreak: false });
    y = 40;
  };
  try {
    addPage();
    const scale = (doc.page.width - 56) / layout.width;
    for (const fragment of layout.fragments) {
      checkAbort(signal);
      const height = fragment.height * scale, labelHeight = fragment.system === null ? 0 : 11;
      requireAdapter(height + labelHeight <= doc.page.height - 80, 'Over-height complete system: choose a wider page/less dense layout; refusing clipping');
      if (y + height + labelHeight > doc.page.height - 34) addPage();
      if (fragment.system !== null) {
        doc.font('Helvetica').fontSize(7).fillColor('#666666').text(`SYSTEM${String(fragment.system + 1).padStart(2, '0')}`, 28, y, { lineBreak: false });
        pages.at(-1)!.systems.push(fragment.system); y += labelHeight;
      }
      const x = 28 + fragment.x * scale;
      requireAdapter(x >= 27 && x + fragment.width * scale <= doc.page.width - 27, 'PDF horizontal overflow');
      doc.save().translate(x, y).scale(scale);
      SVGtoPDF(doc, fragment.svg, 0, 0, {
        assumePt: true, width: fragment.width, height: fragment.height,
        fontCallback: (family, bold, italic) => family === 'alphaTab' ? fontPath : bold ? italic ? 'Helvetica-BoldOblique' : 'Helvetica-Bold' : italic ? 'Helvetica-Oblique' : 'Helvetica',
        warningCallback: warning => warnings.push(warning),
      });
      doc.restore(); y += height;
    }
    requireAdapter(warnings.length === 0, `SVG to PDF warnings: ${warnings.join('; ')}`);
    requireAdapter(JSON.stringify(pages.flatMap(p => p.systems)) === JSON.stringify(layout.systems.map(s => s.index)), 'PDF missing complete system');
    doc.end();
    return { bytes: await done, pagination: { scale, pages } };
  } catch (error) {
    doc.end(); await done.catch(() => undefined); throw error;
  }
}
