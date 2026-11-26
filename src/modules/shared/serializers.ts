import { dayName, initials, monthStart } from '../../common/utils';

export function serializeAttendanceSession(session: any) {
  const record = session.attendance;
  const pair = session.pair;
  const tutorName = pair?.tutor?.user?.name ?? pair?.tutor?.name ?? 'Tutor';
  return {
    id: session.id,
    studentId: pair?.student?.id,
    studentName: pair?.student?.name,
    subject: session.subject,
    start: session.start,
    end: session.end,
    tutor: { name: tutorName, initials: initials(tutorName) },
    tutorAttendance: record?.tutorAttendance ?? 'Hadir',
    studentAttendance:
      record?.studentAttendance ??
      (record?.studentPresent === false ? 'Tidak hadir' : 'Hadir'),
    topic: record?.topic ?? '',
    notes: record?.notes ?? '',
    attachments: record?.attachmentName ? [record.attachmentName] : [],
    status: record?.validation ?? 'belum_divalidasi',
    ...(record?.cancelReason ? { cancelReason: record.cancelReason } : {}),
    ...(record?.validatedAt ? { validatedAt: record.validatedAt } : {}),
    ...(record?.objectionAt
      ? {
          objection: {
            reason: record.objectionReason ?? '',
            submittedAt: record.objectionAt,
          },
        }
      : {}),
    ...(record?.reviewSubmittedAt
      ? {
          review: {
            rating: record.reviewRating ?? 5,
            comment: record.reviewComment ?? '',
            submittedAt: record.reviewSubmittedAt,
          },
        }
      : {}),
  };
}

export function serializeTutorSession(session: any) {
  const record = session.attendance;
  const pair = session.pair;
  return {
    id: session.id,
    subject: session.subject,
    student: {
      name: pair?.student?.name ?? '',
      parentName: pair?.student?.parent?.name ?? '',
      parentSalutation: guessSalutation(
        pair?.student?.parent?.name,
        pair?.student?.salutation,
      ),
    },
    start: session.start,
    end: session.end,
    record: record
      ? {
          held: record.held,
          ...(record.actualStart ? { actualStart: record.actualStart } : {}),
          ...(record.actualEnd ? { actualEnd: record.actualEnd } : {}),
          ...(record.studentPresent !== null
            ? { studentPresent: record.studentPresent }
            : {}),
          ...(record.topic ? { topic: record.topic } : {}),
          ...(record.notes ? { notes: record.notes } : {}),
          ...(record.attachmentName
            ? {
                attachment: {
                  name: record.attachmentName,
                  size: record.attachmentSize ?? 0,
                },
              }
            : {}),
          ...(record.cancelReason ? { cancelReason: record.cancelReason } : {}),
          submittedAt: record.submittedAt,
          validation: record.validation,
          ...(record.objectionAt
            ? {
                objection: {
                  reason: record.objectionReason ?? '',
                  at: record.objectionAt,
                },
              }
            : {}),
          ...(record.validatedAt ? { validatedAt: record.validatedAt } : {}),
          ...(record.objectionCorrected !== null && record.objectionCorrected !== undefined
            ? {
                review: {
                  corrected: record.objectionCorrected,
                  note: record.objectionNote ?? '',
                  at: record.validatedAt ?? record.updatedAt,
                },
              }
            : {}),
          ...(record.finalizedAt ? { finalAt: record.finalizedAt } : {}),
        }
      : null,
  };
}

export function serializeRegistrationForWali(registration: any, contact: any) {
  const stage =
    registration.status === 'ditolak'
      ? 'ditolak'
      : registration.pair
        ? 'selesai'
        : registration.matchedTutorId
          ? 'pencocokan_tutor'
          : registration.status === 'terverifikasi'
            ? 'pencocokan_tutor'
            : 'menunggu_verifikasi';

  const firstSession = registration.pair?.lessons?.[0];
  return {
    id: registration.id,
    number: registration.number,
    studentName: registration.studentName,
    grade: `${registration.grade} ${registration.level}`,
    subjects: registration.subjects,
    days: registration.days,
    startTime: registration.startTime,
    stage,
    submittedAt: registration.submittedAt,
    ...(registration.verifiedAt ? { verifiedAt: registration.verifiedAt } : {}),
    ...(registration.matchedTutor
      ? {
          match: {
            tutorName: registration.matchedTutor.user?.name ?? '',
            matchedAt: registration.matchedAt,
          },
        }
      : {}),
    ...(firstSession
      ? {
          firstSession: {
            start: firstSession.start,
            confirmedAt: registration.matchedAt ?? firstSession.createdAt,
          },
        }
      : {}),
    ...(registration.rejectedAt
      ? {
          rejection: {
            reason: registration.rejectionMessage ?? '',
            rejectedAt: registration.rejectedAt,
          },
        }
      : {}),
  };
}

export function serializePengelolaRegistration(registration: any) {
  return {
    id: registration.id,
    number: registration.number,
    student: {
      name: registration.studentName,
      grade: registration.grade,
      level: registration.level,
      school: registration.school ?? '',
      address: registration.address ?? '',
    },
    parent: {
      name: registration.parentName,
      salutation: registration.parentSalutation ?? 'Bapak/Ibu',
      whatsapp: registration.parentWhatsapp ?? '',
      email: registration.parentEmail ?? registration.parent?.email ?? '',
    },
    needs: {
      subjects: registration.subjects,
      perWeek: registration.perWeek,
      days: registration.days,
      startTime: registration.startTime,
      ...(registration.notes ? { notes: registration.notes } : {}),
    },
    submittedAt: registration.submittedAt,
    status: registration.status,
    ...(registration.verifiedAt ? { verifiedAt: registration.verifiedAt } : {}),
    ...(registration.rejectedAt
      ? {
          rejection: {
            reason: registration.rejectionReason ?? 'lainnya',
            message: registration.rejectionMessage ?? '',
            at: registration.rejectedAt,
          },
        }
      : {}),
    ...(registration.matchedTutor
      ? {
          match: {
            tutorId: registration.matchedTutorId,
            tutorName: registration.matchedTutor.user?.name ?? '',
            at: registration.matchedAt,
          },
        }
      : {}),
    ...(registration.declinedTutorIds?.length
      ? { declinedTutorIds: registration.declinedTutorIds }
      : {}),
  };
}

export function serializeOffer(offer: any) {
  return {
    id: offer.id,
    registrationId: offer.registrationId,
    student: {
      name: offer.studentName,
      grade: offer.grade,
      level: offer.level,
    },
    tutor: {
      id: offer.tutorId,
      name: offer.tutor?.user?.name ?? '',
      shortName: offer.tutor?.shortName ?? '',
    },
    subjects: offer.subjects,
    schedule: offer.schedule,
    location: offer.location,
    distanceKm: offer.distanceKm,
    rate: offer.rate,
    ...(offer.message ? { message: offer.message } : {}),
    sentAt: offer.sentAt,
    status: offer.status,
    ...(offer.answeredAt ? { answeredAt: offer.answeredAt } : {}),
    ...(offer.declineReason
      ? {
          decline: {
            reason: offer.declineReason,
            ...(offer.declineNote ? { note: offer.declineNote } : {}),
          },
        }
      : {}),
  };
}

export function serializePair(pair: any) {
  return {
    id: pair.id,
    student: {
      name: pair.student?.name ?? '',
      grade: pair.student?.grade ?? '',
      level: pair.student?.level ?? '',
    },
    parentName: pair.student?.parent?.name ?? '',
    tutor: {
      id: pair.tutorId,
      name: pair.tutor?.user?.name ?? '',
      shortName: pair.tutor?.shortName ?? '',
    },
    subjects: pair.subjects,
    sessions: (pair.sessions ?? []).map((session: any) => ({
      subject: session.subject,
      day: session.day ?? dayName(session.dayOfWeek),
      start: session.startTime,
      end: session.endTime,
    })),
    effectiveFrom: pair.effectiveFrom,
    ...(pair.offerId ? { offerId: pair.offerId } : {}),
  };
}

export function serializeChangeRequest(request: any) {
  return {
    id: request.id,
    routineId: request.routineId ?? request.pair?.sessions?.[0]?.id ?? request.pairId,
    studentId: request.studentId,
    subject: request.subject,
    tutor: {
      name: request.tutor?.user?.name ?? '',
      shortName: request.tutor?.shortName ?? '',
    },
    durationMinutes: request.durationMinutes,
    from: { weekday: request.fromWeekday, startTime: request.fromStartTime },
    to: { weekday: request.toWeekday, startTime: request.toStartTime },
    scope: request.scope,
    effectiveDate: request.effectiveDate,
    reason: request.reason,
    status: request.status,
    submittedAt: request.submittedAt,
  };
}

export function serializeChangeRequestForReview(request: any) {
  return {
    ...serializeChangeRequest(request),
    studentName: request.student?.name ?? '',
    parentName: request.student?.parent?.name ?? '',
  };
}

export function serializeBill(bill: any) {
  return {
    id: bill.id,
    number: bill.number,
    studentName: bill.student?.name ?? '',
    period: monthStart(bill.period),
    dueDate: bill.dueDate,
    items: (bill.items ?? []).map((item: any) => ({
      subject: item.subject,
      sessions: item.sessions,
      unitPrice: item.unitPrice,
    })),
    total: bill.total,
    paid: bill.paid,
  };
}

export function serializePayment(payment: any) {
  return {
    id: payment.externalId ?? payment.id,
    billId: payment.billId,
    billPeriod: monthStart(payment.billPeriod),
    amount: payment.amount,
    method: payment.method,
    status: payment.status,
    createdAt: payment.createdAt,
  };
}

export function guessSalutation(
  name?: string | null,
  salutation?: string | null,
): string {
  if (salutation) return salutation;
  if (!name) return 'Bapak/Ibu';
  if (/^ibu\b/i.test(name) || /\bibu\b/i.test(name)) return 'Ibu';
  return 'Bapak';
}
