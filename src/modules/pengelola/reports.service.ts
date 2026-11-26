import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { billStatus, serializeStudentBill } from '../shared/pengelola.serializers';
import { monthEnd, monthKey, monthStart } from '../../common/utils';

export type ReportType = 'ringkasan' | 'tagihan' | 'honor' | 'lengkap';
export type ReportFormat = 'pdf' | 'xlsx';

export interface ReportFileResult {
  name: string;
  size: number;
  buffer: Buffer;
  mime: string;
}

const rupiah = (value: number) =>
  `Rp${Math.round(value).toLocaleString('id-ID')}`;

const monthLabel = (date: Date) =>
  date
    .toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })
    .replace(/\s+/g, ' ');

const fileLabel = (date: Date) => {
  const month = date
    .toLocaleDateString('en-US', { month: 'short' })
    .replace(/^./, (c) => c.toUpperCase());
  return `${month}${date.getFullYear()}`;
};

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(
    month: Date,
    type: ReportType,
    format: ReportFormat,
  ): Promise<ReportFileResult> {
    const data = await this.collect(month, type);
    const name = `Laporan_Keuangan_${fileLabel(month)}.${format}`;
    if (format === 'xlsx') {
      const buffer = await this.buildXlsx(data, type);
      return {
        name,
        size: buffer.length,
        buffer,
        mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
    }
    const buffer = await this.buildPdf(data, type);
    return { name, size: buffer.length, buffer, mime: 'application/pdf' };
  }

  private async collect(month: Date, type: ReportType) {
    const active = monthStart(month);
    const bills = await this.prisma.bill.findMany({
      where: { period: { gte: active, lte: monthEnd(active) } },
      include: {
        items: true,
        payments: true,
        student: { include: { parent: true } },
      },
      orderBy: { number: 'asc' },
    });

    const recap = await this.prisma.honorRecap.findUnique({
      where: { month: monthKey(active) },
      include: { lines: { include: { payment: true } } },
    });

    const billRows = bills.map((bill) => {
      const serialized = serializeStudentBill(bill);
      const total = bill.total;
      const paid = bill.paid;
      return {
        number: serialized.number,
        studentName: serialized.studentName,
        guardianName: serialized.guardianName,
        total,
        paid,
        remaining: Math.max(total - paid, 0),
        status: billStatus(bill),
      };
    });

    const successful = bills.flatMap((bill) =>
      bill.payments.filter((payment) => payment.status === 'berhasil'),
    );
    const failed = bills.flatMap((bill) =>
      bill.payments.filter((payment) => payment.status !== 'berhasil'),
    );

    const honorLines = (recap?.lines ?? []).map((line) => ({
      name: line.name,
      shortName: line.shortName,
      sessions: line.sessions,
      total: line.total,
      method: line.method,
      paid: line.payment?.amount ?? 0,
    }));

    const billsTotal = billRows.reduce((sum, row) => sum + row.total, 0);
    const honorTotal = honorLines.reduce((sum, row) => sum + row.total, 0);
    const honorPaid = honorLines.reduce(
      (sum, row) => sum + Math.min(row.paid, row.total),
      0,
    );

    return {
      month: active,
      label: monthLabel(active),
      type,
      summary: {
        billsTotal,
        billsCount: billRows.length,
        lunas: billRows.filter((row) => row.status === 'lunas').length,
        sebagian: billRows.filter((row) => row.status === 'sebagian').length,
        belum: billRows.filter((row) => row.status === 'belum_bayar').length,
        received: successful.reduce((sum, payment) => sum + payment.amount, 0),
        transactions: successful.length,
        failed: failed.length,
        honorTotal,
        honorSessions: honorLines.reduce((sum, row) => sum + row.sessions, 0),
        honorTutors: honorLines.length,
        honorCalculated: Boolean(recap),
        honorPaid,
        institutionShare: billsTotal - honorTotal,
      },
      bills: billRows,
      honors: honorLines,
    };
  }

  private async buildPdf(
    data: Awaited<ReturnType<ReportsService['collect']>>,
    type: ReportType,
  ): Promise<Buffer> {
    const doc = new PDFDocument({ margin: 42, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk as Buffer));
    const done = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    doc.fontSize(18).text('Laporan Keuangan PINTARA', { align: 'left' });
    doc.moveDown(0.25);
    doc.fontSize(10).fillColor('#555555');
    doc.text(`Periode: ${data.label}`);
    doc.text(`Jenis: ${reportTypeLabel(type)}`);
    doc.text(`Dibuat: ${new Date().toLocaleString('id-ID')}`);
    doc.moveDown(0.8);
    doc.fillColor('#000000');

    doc.fontSize(13).text('Ringkasan');
    doc.moveDown(0.3);
    doc.fontSize(10);
    const s = data.summary;
    doc.text(`Total tagihan siswa     : ${rupiah(s.billsTotal)} (${s.billsCount} tagihan)`);
    doc.text(`Sudah diterima          : ${rupiah(s.received)} (${s.transactions} transaksi)`);
    doc.text(`Transaksi gagal         : ${s.failed}`);
    doc.text(`Status tagihan          : ${s.lunas} lunas, ${s.sebagian} sebagian, ${s.belum} belum bayar`);
    doc.text(
      `Honor tutor             : ${rupiah(s.honorTotal)} (${s.honorSessions} sesi, ${s.honorTutors} tutor, ${s.honorCalculated ? 'sudah dihitung' : 'estimasi'})`,
    );
    doc.text(`Honor sudah dibayar     : ${rupiah(s.honorPaid)}`);
    doc.text(`Bagian lembaga          : ${rupiah(s.institutionShare)}`);
    doc.moveDown(0.8);

    if (type === 'tagihan' || type === 'lengkap') {
      doc.fontSize(13).text('Tagihan & Pembayaran Siswa');
      doc.moveDown(0.3);
      doc.fontSize(9);
      doc.text('No. Tagihan | Siswa | Total | Dibayar | Sisa | Status');
      doc.moveTo(42, doc.y).lineTo(553, doc.y).strokeColor('#cccccc').stroke();
      doc.moveDown(0.2);
      for (const row of data.bills) {
        doc.text(
          `${row.number} | ${row.studentName} | ${rupiah(row.total)} | ${rupiah(row.paid)} | ${rupiah(row.remaining)} | ${statusLabel(row.status)}`,
        );
      }
      doc.moveDown(0.8);
    }

    if (type === 'honor' || type === 'lengkap') {
      doc.fontSize(13).text('Honor & Pembayaran Tutor');
      doc.moveDown(0.3);
      doc.fontSize(9);
      doc.text('Tutor | Sesi | Total | Metode | Dibayar');
      doc.moveTo(42, doc.y).lineTo(553, doc.y).strokeColor('#cccccc').stroke();
      doc.moveDown(0.2);
      for (const row of data.honors) {
        doc.text(
          `${row.name} | ${row.sessions} | ${rupiah(row.total)} | ${row.method} | ${rupiah(row.paid)}`,
        );
      }
    }

    doc.end();
    return done;
  }

  private async buildXlsx(
    data: Awaited<ReturnType<ReportsService['collect']>>,
    type: ReportType,
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'PINTARA';
    workbook.created = new Date();

    const summary = workbook.addWorksheet('Ringkasan');
    summary.columns = [
      { header: 'Keterangan', key: 'label', width: 34 },
      { header: 'Nilai', key: 'value', width: 24 },
    ];
    const s = data.summary;
    summary.addRows([
      { label: 'Periode', value: data.label },
      { label: 'Jenis laporan', value: reportTypeLabel(type) },
      { label: 'Total tagihan siswa', value: s.billsTotal },
      { label: 'Jumlah tagihan', value: s.billsCount },
      { label: 'Tagihan lunas', value: s.lunas },
      { label: 'Tagihan sebagian', value: s.sebagian },
      { label: 'Tagihan belum bayar', value: s.belum },
      { label: 'Pembayaran diterima', value: s.received },
      { label: 'Transaksi berhasil', value: s.transactions },
      { label: 'Transaksi gagal', value: s.failed },
      { label: 'Total honor tutor', value: s.honorTotal },
      { label: 'Sesi honor', value: s.honorSessions },
      { label: 'Tutor honor', value: s.honorTutors },
      { label: 'Honor sudah dibayar', value: s.honorPaid },
      { label: 'Bagian lembaga', value: s.institutionShare },
    ]);
    summary.getRow(1).font = { bold: true };

    if (type === 'tagihan' || type === 'lengkap') {
      const sheet = workbook.addWorksheet('Tagihan');
      sheet.columns = [
        { header: 'No. Tagihan', key: 'number', width: 22 },
        { header: 'Siswa', key: 'studentName', width: 22 },
        { header: 'Wali', key: 'guardianName', width: 22 },
        { header: 'Total', key: 'total', width: 14 },
        { header: 'Dibayar', key: 'paid', width: 14 },
        { header: 'Sisa', key: 'remaining', width: 14 },
        { header: 'Status', key: 'status', width: 14 },
      ];
      sheet.addRows(
        data.bills.map((row) => ({
          ...row,
          status: statusLabel(row.status),
        })),
      );
      sheet.getRow(1).font = { bold: true };
      sheet.getColumn('total').numFmt = '#,##0';
      sheet.getColumn('paid').numFmt = '#,##0';
      sheet.getColumn('remaining').numFmt = '#,##0';
    }

    if (type === 'honor' || type === 'lengkap') {
      const sheet = workbook.addWorksheet('Honor');
      sheet.columns = [
        { header: 'Tutor', key: 'name', width: 26 },
        { header: 'Sesi', key: 'sessions', width: 10 },
        { header: 'Total', key: 'total', width: 14 },
        { header: 'Metode', key: 'method', width: 14 },
        { header: 'Dibayar', key: 'paid', width: 14 },
      ];
      sheet.addRows(data.honors);
      sheet.getRow(1).font = { bold: true };
      sheet.getColumn('total').numFmt = '#,##0';
      sheet.getColumn('paid').numFmt = '#,##0';
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }
}

function reportTypeLabel(type: ReportType) {
  switch (type) {
    case 'ringkasan':
      return 'Ringkasan keuangan';
    case 'tagihan':
      return 'Tagihan & pembayaran siswa';
    case 'honor':
      return 'Honor & pembayaran tutor';
    default:
      return 'Lengkap (semua rincian)';
  }
}

function statusLabel(status: string) {
  if (status === 'lunas') return 'Lunas';
  if (status === 'sebagian') return 'Sebagian';
  return 'Belum Bayar';
}