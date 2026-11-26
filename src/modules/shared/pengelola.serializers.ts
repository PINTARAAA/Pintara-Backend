import { monthStart } from '../../common/utils';

/**
 * Serializer Data Master, Manajemen Akun, dan Laporan Keuangan.
 *
 * Bentuk respons mengikuti tipe frontend di `src/types/*`:
 * data-master, manajemen-akun, dan keuangan. Tidak ada pembungkus tambahan.
 */

export const DISTRICTS = [
  'Arosbaya',
  'Bangkalan',
  'Burneh',
  'Kamal',
  'Socah',
] as const;

export const accountStatus = (isActive: boolean) =>
  isActive ? 'aktif' : 'nonaktif';

export const pickupMethod = (honorMethod?: string | null) =>
  honorMethod === 'tunai' ? 'Tunai di LBB' : 'Transfer bank';

/** Metode pembayaran tersimpan → label kontrak frontend. */
export const paymentMethodOut = (method?: string | null) => {
  if (method === 'Virtual Account BCA' || method === 'VA BCA') return 'VA BCA';
  return method ?? '';
};

export function deriveDistrict(address?: string | null): string {
  if (!address) return 'Bangkalan';
  const found = DISTRICTS.find((district) =>
    address.toLowerCase().includes(district.toLowerCase()),
  );
  return found ?? 'Bangkalan';
}

export function tutorStats(tutor: any) {
  const pairs: any[] = tutor?.pairs ?? [];
  const activeStudents = new Set(
    pairs.map((pair) => pair.studentId).filter(Boolean),
  ).size;
  const activeSchedules = pairs.reduce(
    (sum, pair) => sum + (pair.sessions?.length ?? 0),
    0,
  );
  return { activeStudents, activeSchedules };
}

export function serializeTutor(tutor: any) {
  const stats = tutorStats(tutor);
  return {
    id: tutor.id,
    name: tutor.user?.name ?? '',
    phone: tutor.user?.whatsapp ?? '',
    email: tutor.user?.email ?? '',
    education: tutor.education ?? '',
    subjects: tutor.subjects ?? [],
    levels: tutor.levels ?? [],
    days: tutor.days ?? [],
    from: tutor.availableFrom ?? '15.00',
    until: tutor.availableUntil ?? '21.00',
    address: tutor.address ?? '',
    district: tutor.district ?? deriveDistrict(tutor.address),
    rate: tutor.ratePerSession ?? null,
    pickup: pickupMethod(tutor.honorMethod),
    joinedAt: tutor.user?.createdAt ?? tutor.createdAt,
    activeStudents: stats.activeStudents,
    activeSchedules: stats.activeSchedules,
    status: accountStatus(tutor.isActive),
  };
}

export function serializeTutorRow(tutor: any) {
  return {
    id: tutor.id,
    name: tutor.user?.name ?? '',
    subjects: tutor.subjects ?? [],
    levels: tutor.levels ?? [],
    district: tutor.district ?? deriveDistrict(tutor.address),
    rate: tutor.ratePerSession ?? null,
    status: accountStatus(tutor.isActive),
  };
}

export const gradeLabel = (grade?: string | null, level?: string | null) =>
  [grade, level].filter(Boolean).join(' ').trim();

export function serializeStudent(student: any) {
  const pairs: any[] = student.pairs ?? [];
  const lessons = pairs.flatMap((pair: any) =>
    (pair.sessions ?? []).map((session: any) => ({
      subject: session.subject,
      day: session.day,
      from: session.startTime,
      until: session.endTime,
      tutorName: pair.tutor?.user?.name ?? '',
    })),
  );
  return {
    id: student.id,
    name: student.name,
    grade: gradeLabel(student.grade, student.level),
    school: student.school ?? '',
    address: student.address ?? '',
    district: student.district ?? deriveDistrict(student.address),
    subjects: student.subjects ?? [],
    needs: student.needs ?? '',
    guardian: {
      name: student.parent?.name ?? '',
      phone: student.parent?.whatsapp ?? '',
      accountActive: student.parent?.isActive ?? true,
      linkedStudents: student.parent?._count?.students ?? 1,
    },
    lessons,
    status: accountStatus(student.isActive),
    ...(student.endedAt ? { endedAt: student.endedAt } : {}),
  };
}

export function serializeStudentRow(student: any) {
  const tutorNames = [
    ...new Set(
      (student.pairs ?? [])
        .map((pair: any) => pair.tutor?.user?.name)
        .filter(Boolean),
    ),
  ] as string[];
  return {
    id: student.id,
    name: student.name,
    grade: gradeLabel(student.grade, student.level),
    subjects: student.subjects ?? [],
    status: accountStatus(student.isActive),
    ...(student.endedAt ? { endedAt: student.endedAt } : {}),
    tutorNames,
  };
}

export function linkedStudent(student: any) {
  return {
    id: student.id,
    name: student.name,
    grade: gradeLabel(student.grade, student.level),
    status: accountStatus(student.isActive),
  };
}

export function serializeAccount(user: any, studentIds: string[]) {
  return {
    id: user.id,
    role: user.role,
    name: user.name,
    email: user.email ?? '',
    username: user.username,
    phone: user.whatsapp ?? '',
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt ?? null,
    status: accountStatus(user.isActive),
    studentIds,
  };
}

export function serializeAccountRow(user: any, studentIds: string[]) {
  return {
    id: user.id,
    role: user.role,
    name: user.name,
    email: user.email ?? '',
    status: accountStatus(user.isActive),
    students: studentIds.length,
  };
}

export function serializeAccountDetail(user: any, students: any[]) {
  return {
    ...serializeAccount(
      user,
      students.map((student) => student.id),
    ),
    students: students.map(linkedStudent),
  };
}

export function serializeBillPayment(payment: any) {
  return {
    id: payment.externalId ?? payment.id,
    amount: payment.amount,
    method: paymentMethodOut(payment.method),
    status: payment.status,
    createdAt: payment.createdAt,
    ...(payment.manual ? { manual: payment.manual } : {}),
  };
}

export function serializeStudentBill(bill: any) {
  return {
    id: bill.id,
    number: bill.number,
    studentName: bill.student?.name ?? '',
    guardianName: bill.student?.parent?.name ?? '',
    period: monthStart(bill.period),
    dueDate: bill.dueDate,
    items: (bill.items ?? []).map((item: any) => ({
      subject: item.subject,
      sessions: item.sessions,
      unitPrice: item.unitPrice,
    })),
    payments: (bill.payments ?? []).map(serializeBillPayment),
  };
}

export const billTotal = (bill: any) =>
  (bill.items ?? []).reduce(
    (sum: number, item: any) => sum + item.sessions * item.unitPrice,
    0,
  );

export const billPaid = (bill: any) =>
  (bill.payments ?? [])
    .filter((payment: any) => payment.status === 'berhasil')
    .reduce((sum: number, payment: any) => sum + payment.amount, 0);

export function billStatus(bill: any) {
  const total = bill.total ?? billTotal(bill);
  const paid = bill.paid ?? billPaid(bill);
  if (paid >= total) return 'lunas';
  return paid > 0 ? 'sebagian' : 'belum_bayar';
}