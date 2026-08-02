import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

interface CertificateInput {
  studentName: string;
  courseTitle: string;
  completionDate: Date;
}

export async function generateCertificatePdf(input: CertificateInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([842, 595]); // A4 landscape in points
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const bodyFont = await doc.embedFont(StandardFonts.Helvetica);

  page.drawText('Certificado de finalizacion', {
    x: 180,
    y: 420,
    size: 28,
    font,
    color: rgb(0.1, 0.1, 0.1),
  });

  page.drawText(input.studentName, {
    x: 180,
    y: 340,
    size: 22,
    font,
    color: rgb(0.05, 0.3, 0.6),
  });

  page.drawText(`completo el curso "${input.courseTitle}"`, {
    x: 180,
    y: 300,
    size: 16,
    font: bodyFont,
  });

  page.drawText(input.completionDate.toISOString().slice(0, 10), {
    x: 180,
    y: 260,
    size: 12,
    font: bodyFont,
  });

  return doc.save();
}
