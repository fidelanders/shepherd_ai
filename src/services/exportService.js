'use strict';

const fs = require('fs');
const path = require('path');

const EXPORT_DIR = path.join(process.cwd(), 'exports');

class ExportService {
  constructor() {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
  }

  async exportFormat(results, format, jobId) {
    const ext = this.getExtension(format);
    const filePath = path.join(EXPORT_DIR, `${jobId}_${format}.${ext}`);

    switch (format) {
      case 'txt':  await this._exportTxt(results, filePath);  break;
      case 'srt':  await this._exportSrt(results, filePath);  break;
      case 'docx': await this._exportDocx(results, filePath); break;
      case 'json': await this._exportJson(results, filePath); break;
      default:     await this._exportTxt(results, filePath);
    }

    return filePath;
  }

  getExtension(format) {
    return { txt: 'txt', srt: 'srt', docx: 'docx', json: 'json' }[format] ?? 'txt';
  }

  // ─── TXT ─────────────────────────────────────────────────────

  async _exportTxt(results, filePath) {
    const hr = '='.repeat(60);
    const hasTranscript = results.transcript && results.transcript.trim().length > 0;
    const hasInsights   = results.summary || results.questions?.length || results.newsletter;

    const lines = [
      'SERMON TRANSCRIPT',
      hr,
      `File:       ${results.fileName || 'Unknown'}`,
      `Duration:   ${results.duration || 'N/A'}`,
      `Word count: ${results.wordCount ?? 'N/A'}`,
      `Confidence: ${results.confidence != null ? `${results.confidence.toFixed(1)}%` : 'N/A'}`,
      hr,
      '',
      'TRANSCRIPT',
      '-'.repeat(60),
      hasTranscript
        ? results.transcript
        : '⚠  No transcript available — transcription failed. Check server logs for details.',
      '',
      hr,
      '',
    ];

    if (results.summary) {
      lines.push('SUMMARY', '-'.repeat(60), results.summary, '');
    }

    if (results.verses?.length) {
      lines.push('BIBLE VERSES REFERENCED', '-'.repeat(60));
      results.verses.forEach(v => lines.push(`• ${v.ref} (${v.trans || 'ESV'}) @ ${v.time}`));
      lines.push('');
    }

    if (results.questions?.length) {
      lines.push('DISCUSSION QUESTIONS', '-'.repeat(60));
      results.questions.forEach((q, i) => lines.push(`${i + 1}. ${q}`));
      lines.push('');
    }

    if (results.newsletter) {
      lines.push('NEWSLETTER BLURB', '-'.repeat(60), results.newsletter, '');
    }

    if (!hasInsights) {
      lines.push(
        'AI INSIGHTS',
        '-'.repeat(60),
        '⚠  AI insights were not generated.',
        '   Fix: add GEMINI_API_KEY to .env and ensure transcription succeeds.',
        ''
      );
    }

    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
  }

  // ─── SRT ─────────────────────────────────────────────────────

  async _exportSrt(results, filePath) {
    const segments = results.segments || [];
    const content = segments
      .map((seg, i) =>
        [
          `${i + 1}`,
          `${this._srtTime(seg.start)} --> ${this._srtTime(seg.end)}`,
          seg.speaker ? `[${seg.speaker}] ${seg.text}` : seg.text,
          '',
        ].join('\n')
      )
      .join('\n');

    fs.writeFileSync(filePath, content, 'utf8');
  }

  _srtTime(seconds) {
    if (typeof seconds !== 'number' || isNaN(seconds)) return '00:00:00,000';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.round((seconds % 1) * 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
  }

  // ─── DOCX ─────────────────────────────────────────────────────

  async _exportDocx(results, filePath) {
    // Lazy-require so the server still starts even if `docx` is not installed
    let docxLib;
    try {
      docxLib = require('docx');
    } catch {
      console.warn('[ExportService] `docx` package not installed — falling back to TXT');
      return this._exportTxt(results, filePath.replace('.docx', '.txt'));
    }

    const {
      Document, Packer, Paragraph, TextRun, HeadingLevel,
      AlignmentType, BorderStyle, Table, TableRow, TableCell,
      WidthType, ShadingType,
    } = docxLib;

    const heading = (text, level = HeadingLevel.HEADING_1) =>
      new Paragraph({ text, heading: level, spacing: { before: 300, after: 120 } });

    const body = (text, opts = {}) =>
      new Paragraph({ children: [new TextRun({ text: text || '', size: 22, ...opts })], spacing: { after: 100 } });

    const hr = () =>
      new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC' } },
        spacing: { after: 200 },
      });

    const children = [
      new Paragraph({
        children: [new TextRun({ text: 'Sermon Transcript', bold: true, size: 36, color: '1e3a5f' })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      }),
      hr(),

      // Meta table
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          ['File', results.fileName || 'Unknown'],
          ['Duration', results.duration || 'N/A'],
          ['Word count', String(results.wordCount ?? 'N/A')],
          ['Confidence', results.confidence != null ? `${results.confidence.toFixed(1)}%` : 'N/A'],
        ].map(([k, v]) =>
          new TableRow({
            children: [
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: k, bold: true, size: 20 })] })],
                shading: { type: ShadingType.SOLID, color: 'F0F4F8' },
                width: { size: 30, type: WidthType.PERCENTAGE },
              }),
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: v, size: 20 })] })],
                width: { size: 70, type: WidthType.PERCENTAGE },
              }),
            ],
          })
        ),
      }),

      hr(),
      heading('Transcript'),
      body(results.transcript || ''),
      hr(),

      heading('Summary'),
      body(results.summary || ''),
      hr(),
    ];

    if (results.verses?.length) {
      children.push(heading('Bible Verses Referenced'));
      results.verses.forEach(v =>
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `${v.ref}`, bold: true, size: 22 }),
              new TextRun({ text: ` (${v.trans || 'ESV'}) @ ${v.time}`, size: 22, color: '666666' }),
              v.text ? new TextRun({ text: `\n"${v.text}"`, size: 20, italics: true, color: '444444' }) : new TextRun(''),
            ],
            spacing: { after: 120 },
          })
        )
      );
      children.push(hr());
    }

    if (results.questions?.length) {
      children.push(heading('Discussion Questions'));
      results.questions.forEach((q, i) =>
        children.push(body(`${i + 1}. ${q}`))
      );
      children.push(hr());
    }

    if (results.newsletter) {
      children.push(heading('Newsletter Blurb'));
      children.push(body(results.newsletter));
      children.push(hr());
    }

    if (results.chapters?.length) {
      children.push(heading('Sermon Chapters'));
      results.chapters.forEach(ch => {
        children.push(new Paragraph({
          children: [
            new TextRun({ text: `${ch.label}`, bold: true, size: 22 }),
            new TextRun({ text: `  ${ch.start} – ${ch.end}`, size: 20, color: '888888' }),
          ],
          spacing: { after: 60 },
        }));
        children.push(body(ch.summary || '', { color: '555555' }));
      });
    }

    const doc = new Document({ sections: [{ children }] });
    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(filePath, buffer);
  }

  // ─── JSON ─────────────────────────────────────────────────────

  async _exportJson(results, filePath) {
    fs.writeFileSync(filePath, JSON.stringify(results, null, 2), 'utf8');
  }
}

module.exports = ExportService;
