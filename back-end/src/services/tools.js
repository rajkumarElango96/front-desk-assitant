'use strict'

/**
 * Tool Implementations — Amara AI Layer
 *
 * Each function here maps 1:1 to an OpenAI tool definition.
 * GPT-4o decides which tool to call based on the patient's message.
 * We execute directly via Prisma — no HTTP round trip to our own endpoints.
 */

const mailer = require('../utils/mailer')

// ── Tool Definitions (sent to OpenAI) ─────────────────────────────────────────
const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'list_providers',
      description: 'List providers (doctors) for a given medical specialty. Use this FIRST when a patient wants to schedule an appointment, before looking at availability — patients pick a doctor, then you look at that doctor\'s open slots.',
      parameters: {
        type: 'object',
        properties: {
          specialty: {
            type: 'string',
            enum: ['CARDIOLOGY', 'ORTHOPEDICS', 'DERMATOLOGY', 'NEUROLOGY', 'GENERAL'],
            description: 'Medical specialty inferred from patient symptoms or explicit request',
          },
        },
        required: ['specialty'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_available_slots',
      description: 'Find the next available appointment slots. Call with a providerId once a specific doctor has been chosen (via list_providers) to get that doctor\'s next 3 openings. Date range is optional — omit it to just get the soonest available slots.',
      parameters: {
        type: 'object',
        properties: {
          providerId: {
            type: 'string',
            description: 'UUID of a specific provider, once the patient has picked one via list_providers',
          },
          specialty: {
            type: 'string',
            enum: ['CARDIOLOGY', 'ORTHOPEDICS', 'DERMATOLOGY', 'NEUROLOGY', 'GENERAL'],
            description: 'Medical specialty — only needed if providerId is not yet known',
          },
          startDate: {
            type: 'string',
            description: 'Start of date range in YYYY-MM-DD format. Omit to default to today.',
          },
          endDate: {
            type: 'string',
            description: 'End of date range in YYYY-MM-DD format. Omit to default to a 90-day window.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'book_appointment',
      description: 'Book an appointment for the patient once they have selected a slot. Requires patientId, providerId, slotId, and appointmentType.',
      parameters: {
        type: 'object',
        properties: {
          patientId:         { type: 'string', description: 'UUID of the patient' },
          providerId:        { type: 'string', description: 'UUID of the provider' },
          slotId:            { type: 'string', description: 'UUID of the selected slot' },
          appointmentType:   { type: 'string', enum: ['TELE', 'IN_PERSON'] },
          appointmentDate:   { type: 'string', description: 'Date in YYYY-MM-DD format' },
          appointmentReason: { type: 'string', description: 'Reason or symptoms described by patient' },
        },
        required: ['patientId', 'providerId', 'slotId', 'appointmentType', 'appointmentDate'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_patient_appointments',
      description: 'Get all appointments for the current patient. Use when patient asks about their upcoming or past appointments.',
      parameters: {
        type: 'object',
        properties: {
          patientId: { type: 'string', description: 'UUID of the patient' },
        },
        required: ['patientId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_patient_prescriptions',
      description: 'Get all prescriptions for the current patient. Use when patient asks about their medications or refills.',
      parameters: {
        type: 'object',
        properties: {
          patientId: { type: 'string', description: 'UUID of the patient' },
        },
        required: ['patientId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_appointment',
      description: 'Cancel an appointment for the patient. Use when patient explicitly asks to cancel.',
      parameters: {
        type: 'object',
        properties: {
          appointmentId: { type: 'string', description: 'UUID of the appointment to cancel' },
        },
        required: ['appointmentId'],
      },
    },
  },
]

// ── Tool Executors (called when GPT-4o fires a tool) ──────────────────────────

const DEFAULT_AVAILABILITY_WINDOW_DAYS = 90
const MAX_SLOTS_RETURNED = 3

async function list_providers(prisma, { specialty }) {
  const providers = await prisma.provider.findMany({
    where: { specialty },
    select: {
      providerId:        true,
      providerFirstName: true,
      providerLastName:  true,
      specialty:         true,
    },
  })

  if (!providers.length) return { found: false, message: 'No providers found for this specialty' }
  return { found: true, providers }
}

async function find_available_slots(prisma, { providerId, specialty, startDate, endDate }) {
  const today = new Date()
  const start = startDate ? new Date(startDate) : today
  const end = endDate
    ? new Date(endDate)
    : new Date(today.getTime() + DEFAULT_AVAILABILITY_WINDOW_DAYS * 24 * 60 * 60 * 1000)

  const slots = await prisma.providerSlot.findMany({
    where: {
      status:   'AVAILABLE',
      slotDate: { gte: start, lte: end },
      providerId: providerId || undefined,
      provider: !providerId && specialty ? { specialty } : undefined,
    },
    include: {
      provider: {
        select: {
          providerId:        true,
          providerFirstName: true,
          providerLastName:  true,
          specialty:         true,
        },
      },
    },
    orderBy: [{ slotDate: 'asc' }, { slotStartTime: 'asc' }],
    take: MAX_SLOTS_RETURNED,
  })

  if (!slots.length) return { available: false, message: 'No available slots found for the given criteria' }
  return { available: true, slots }
}

async function book_appointment(prisma, { patientId, providerId, slotId, appointmentType, appointmentDate, appointmentReason }) {
  // Validate slot
  const slot = await prisma.providerSlot.findUnique({ where: { slotId } })
  if (!slot)                       return { success: false, error: 'Slot not found' }
  if (slot.providerId !== providerId) return { success: false, error: 'Slot does not belong to this provider' }
  if (slot.status !== 'AVAILABLE') return { success: false, error: 'Slot is no longer available' }

  // Validate patient
  const patient = await prisma.patient.findUnique({ where: { patientId } })
  if (!patient) return { success: false, error: 'Patient not found' }

  // Atomic transaction
  try {
    const [appointment] = await prisma.$transaction([
      prisma.appointment.create({
        data: {
          patientId,
          providerId,
          slotId,
          appointmentType,
          appointmentDate:   new Date(appointmentDate),
          appointmentReason: appointmentReason || null,
          apptStatus:        'PENDING',
        },
        include: { patient: true, provider: true, slot: true },
      }),
      prisma.providerSlot.update({
        where: { slotId },
        data:  { status: 'BOOKED' },
      }),
    ])
    // Fire confirmation + reminder emails automatically — non-blocking, don't fail the booking if either fails.
    mailer.sendConfirmationEmail(appointment).catch((e) =>
      console.error('[MAILER] Failed to send confirmation email:', e.message)
    )
    mailer.sendReminderEmail(appointment)
      .then(() => prisma.appointment.update({
        where: { appointmentId: appointment.appointmentId },
        data:  { reminderSentAt: new Date() },
      }))
      .catch((e) => console.error('[MAILER] Failed to send reminder email:', e.message))
    return { success: true, appointment }
  } catch (err) {
    if (err.code === 'P2002') return { success: false, error: 'Slot was just taken by another patient, please choose another' }
    throw err
  }
}

async function get_patient_appointments(prisma, { patientId }) {
  const appointments = await prisma.appointment.findMany({
    where:   { patientId },
    include: { provider: true, slot: true },
    orderBy: { appointmentDate: 'asc' },
  })
  if (!appointments.length) return { found: false, message: 'No appointments found for this patient' }
  return { found: true, appointments }
}

async function get_patient_prescriptions(prisma, { patientId }) {
  const visits = await prisma.visitHistory.findMany({
    where:   { patientId },
    include: { prescriptions: true },
  })
  const prescriptions = visits.flatMap((v) => v.prescriptions)
  if (!prescriptions.length) return { found: false, message: 'No prescriptions found for this patient' }
  return { found: true, prescriptions }
}

async function cancel_appointment(prisma, { appointmentId }) {
  const appt = await prisma.appointment.findUnique({ where: { appointmentId } })
  if (!appt) return { success: false, error: 'Appointment not found' }

  await prisma.$transaction([
    prisma.appointment.update({
      where: { appointmentId },
      data:  { apptStatus: 'CANCELLED' },
    }),
    prisma.providerSlot.update({
      where: { slotId: appt.slotId },
      data:  { status: 'AVAILABLE' },
    }),
  ])

  return { success: true, message: 'Appointment cancelled and slot released' }
}

// ── Tool Dispatcher ───────────────────────────────────────────────────────────
// Called by the OpenAI service when GPT-4o fires a tool_call

async function executeTool(prisma, toolName, toolArgs) {
  switch (toolName) {
    case 'list_providers':           return list_providers(prisma, toolArgs)
    case 'find_available_slots':     return find_available_slots(prisma, toolArgs)
    case 'book_appointment':         return book_appointment(prisma, toolArgs)
    case 'get_patient_appointments': return get_patient_appointments(prisma, toolArgs)
    case 'get_patient_prescriptions':return get_patient_prescriptions(prisma, toolArgs)
    case 'cancel_appointment':       return cancel_appointment(prisma, toolArgs)
    default: return { error: `Unknown tool: ${toolName}` }
  }
}

module.exports = { TOOL_DEFINITIONS, executeTool }
