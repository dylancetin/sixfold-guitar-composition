import { createRequire } from 'node:module';
import PDFDocument from 'pdfkit';
import SVGtoPDF from 'svg-to-pdfkit';
import type { NotationLayout } from './alpha-tab';
import { checkAbort, requireAdapter } from './errors';
import { pdfLayoutQuery } from './pdf-settings';
import type { PdfLayoutSettings } from './pdf-settings';
import type { AdapterProjection } from '../domain';

export type PdfPageSize = 'A4' | 'LETTER';
export type PdfPagination = { scale: number; pages: { number: number; width: number; height: number; systems: number[] }[] };

/** Complete-system pagination, explicit Bravura embedding and one global SVG scale (U02). */
export async function encodePdf(layout: NotationLayout, caption: string, size: PdfPageSize = 'A4', signal?: AbortSignal, display: { layout?: PdfLayoutSettings | undefined; title?: string | undefined; form?: AdapterProjection['form'] } = {}): Promise<{ bytes: Uint8Array; pagination: PdfPagination }> {
  checkAbort(signal);
  const require = createRequire(import.meta.url);
  const fontPath = require.resolve('@coderline/alphatab/font/Bravura.otf');
  const doc = new PDFDocument({ size, margin: 0, autoFirstPage: false, compress: true, info: { Title: display.title ?? 'Solo guitar arrangement', Subject: caption, ...(display.layout ? { Keywords: pdfLayoutQuery(display.layout) } : {}) } });
  const chunks: Buffer[] = [];
  const done = new Promise<Uint8Array>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk)); doc.on('error', reject);
    doc.on('end', () => resolve(new Uint8Array(Buffer.concat(chunks))));
  });
  doc.registerFont('alphaTab', fontPath);
  const pages: PdfPagination['pages'] = [];
  const warnings: string[] = [];
  let y = 40;
  let contentTop = 40;
  const addPage = () => {
    doc.addPage({ size, margin: 0 });
    pages.push({ number: pages.length + 1, width: doc.page.width, height: doc.page.height, systems: [] });
    doc.font('Helvetica').fontSize(7).fillColor('#333333').text(caption, 28, 15, { width: doc.page.width - 56, height: 20, lineBreak: true });
    const frets = display.layout?.fretMode === 'absolute' ? 'absolute neck TAB' : 'capo-relative TAB';
    const labels = display.layout?.showMeasureLabels ? display.form === 'folded-linear-repeats' ? ' | S=written bar; repeats show total passes' : ' | S=original bar, P=pass' : '';
    doc.text(`${size} - ${pages.length}${labels} | ${frets}; written = sounding + 12`, 28, doc.page.height - 22, { lineBreak: false });
    y = 40;
    if (display.layout) {
      const { spacing, barsPerRow, scale, showFingerNumbers, noteNames, staves } = display.layout;
      doc.text(`PDF layout: ${spacing} spacing | ${barsPerRow} bars per row | size ${Math.round(scale * 100)}% | ${showFingerNumbers ? 'finger numbers on' : 'finger numbers off'}${noteNames && staves !== 'tab' ? ' | note names in noteheads' : ''}`, 28, 37, { lineBreak: false });
      y = 54;
      if (display.title) {
        // The engraving's single-line title can overflow at large notation
        // sizes. Typeset it separately with real wrapping, never clip it.
        doc.font('Helvetica').fontSize(16).text(display.title, 28, y, { width: doc.page.width - 56 });
        y = doc.y + 10;
      }
    }
    contentTop = y;
  };
  try {
    addPage();
    const scale = (doc.page.width - 56) / layout.width;
    for (const fragment of layout.fragments) {
      checkAbort(signal);
      const height = fragment.height * scale, labelHeight = fragment.system === null ? 0 : 11;
      requireAdapter(height + labelHeight <= Math.min(doc.page.height - 80, doc.page.height - 34 - contentTop), 'Over-height complete system: choose a wider page/less dense layout; refusing clipping');
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
