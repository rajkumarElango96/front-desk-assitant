const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// Helper — time value (date part ignored by @db.Time)
const t = (hh, mm) => new Date(`1970-01-01T${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:00`)

// Helper — date value (time part ignored by @db.Date)
const d = (yyyy, mm, dd) => new Date(`${yyyy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}T00:00:00`)

// Rolling week — next 5 weekdays starting tomorrow, computed relative to when this seed
// actually runs. A hardcoded calendar week ages into the past and stops being bookable;
// this keeps re-seeding useful no matter when you run it.
function nextWeekdays(count) {
  const days = []
  const cursor = new Date()
  cursor.setUTCHours(0, 0, 0, 0)
  cursor.setUTCDate(cursor.getUTCDate() + 1) // start tomorrow
  while (days.length < count) {
    const dow = cursor.getUTCDay() // 0 = Sun, 6 = Sat
    if (dow !== 0 && dow !== 6) days.push(new Date(cursor))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return days
}

const WEEK = nextWeekdays(5)

// Same block pattern for every provider — more than 3 per day so the "show 3 available
// slots" cap in tools.js is actually exercised, not trivially satisfied.
const DAILY_BLOCKS = [
  { start: t(9,  0), end: t(10, 0) },
  { start: t(10, 0), end: t(11, 0) },
  { start: t(11, 0), end: t(12, 0) },
  { start: t(14, 0), end: t(15, 0) },
  { start: t(15, 0), end: t(16, 0) },
]

async function main() {

  // ── Clean existing data (order respects FK constraints) ───────────────────
  await prisma.prescription.deleteMany()
  await prisma.visitHistory.deleteMany()
  await prisma.appointment.deleteMany()
  await prisma.providerSlot.deleteMany()
  await prisma.patient.deleteMany()
  await prisma.provider.deleteMany()
  console.log('🧹 Cleared existing data')

  // ── Providers — 2 per specialty (Cardiology + Orthopedics, for now) ───────
  const drPatel = await prisma.provider.create({
    data: { providerFirstName: 'Anika', providerLastName: 'Patel', npi: '1234567890', specialty: 'CARDIOLOGY' },
  })
  const drChen = await prisma.provider.create({
    data: { providerFirstName: 'Emma', providerLastName: 'Chen', npi: '9988776655', specialty: 'CARDIOLOGY' },
  })
  const drRoss = await prisma.provider.create({
    data: { providerFirstName: 'James', providerLastName: 'Ross', npi: '0987654321', specialty: 'ORTHOPEDICS' },
  })
  const drTran = await prisma.provider.create({
    data: { providerFirstName: 'Lisa', providerLastName: 'Tran', npi: '4433221100', specialty: 'ORTHOPEDICS' },
  })

  console.log('✅ Providers seeded (4 — 2 Cardiology, 2 Orthopedics)')

  // ── Patients ──────────────────────────────────────────────────────────────
  const patient1 = await prisma.patient.create({
    data: { firstName: 'John', lastName: 'Doe', dob: d(1985, 6, 15), email: 'john.doe@email.com', phone: '5551234567' },
  })
  const patient2 = await prisma.patient.create({
    data: { firstName: 'Maria', lastName: 'Garcia', dob: d(1990, 3, 22), email: 'maria.garcia@email.com', phone: null },
  })
  const patient3 = await prisma.patient.create({
    data: { firstName: 'Tom', lastName: 'Chen', dob: d(1978, 11, 5), email: 'tom.chen@email.com', phone: '5559876543' },
  })

  console.log('✅ Patients seeded (3)')

  // ── Slots — every provider gets availability across the upcoming rolling week ──
  const timezoneFor = {
    [drPatel.providerId]: 'AMERICA_NEW_YORK',
    [drChen.providerId]:  'AMERICA_NEW_YORK',
    [drRoss.providerId]:  'AMERICA_CHICAGO',
    [drTran.providerId]:  'AMERICA_CHICAGO',
  }
  const providers = [drPatel, drChen, drRoss, drTran]

  const slotData = []
  for (const provider of providers) {
    for (const day of WEEK) {
      for (const block of DAILY_BLOCKS) {
        slotData.push({
          providerId:    provider.providerId,
          slotDate:      day,
          slotStartTime: block.start,
          slotEndTime:   block.end,
          timezone:      timezoneFor[provider.providerId],
          status:        'AVAILABLE',
        })
      }
    }
  }

  await prisma.providerSlot.createMany({ data: slotData })
  console.log(`✅ Slots seeded (${slotData.length} total across 4 providers)`)

  // ── Completed appointment chain ────────────────────────────────────────────
  // John Doe — sees Dr Patel (Cardiology) on day 1 at 9am → visit → prescription

  const bookedSlot = await prisma.providerSlot.findFirst({
    where: { providerId: drPatel.providerId, slotDate: WEEK[0], slotStartTime: t(9, 0) },
  })

  const appointment1 = await prisma.appointment.create({
    data: {
      patientId:         patient1.patientId,
      providerId:        drPatel.providerId,
      slotId:            bookedSlot.slotId,
      appointmentType:   'IN_PERSON',
      appointmentDate:   WEEK[0],
      appointmentReason: 'Chest pain and shortness of breath',
      apptStatus:        'COMPLETED',
    },
  })

  await prisma.providerSlot.update({ where: { slotId: bookedSlot.slotId }, data: { status: 'BOOKED' } })

  const visit1 = await prisma.visitHistory.create({
    data: {
      patientId:            patient1.patientId,
      appointmentId:        appointment1.appointmentId,
      visitSummary:         'Patient presented with chest pain. EKG normal. Prescribed beta blocker.',
      prescriptionProvided: true,
    },
  })

  await prisma.prescription.create({
    data: {
      visitId:              visit1.visitId,
      prescriptionDate:     WEEK[0],
      prescriptionMedicine: 'Metoprolol 25mg',
      isRefill:             false,
      nextRefillDate:       null,
    },
  })

  console.log('✅ Completed appointment + visit + prescription seeded')

  // ── Confirmed upcoming appointment ────────────────────────────────────────
  // Maria Garcia — sees Dr Ross (Orthopedics) on day 2 at 9am

  const upcomingSlot = await prisma.providerSlot.findFirst({
    where: { providerId: drRoss.providerId, slotDate: WEEK[1], slotStartTime: t(9, 0) },
  })

  await prisma.appointment.create({
    data: {
      patientId:         patient2.patientId,
      providerId:        drRoss.providerId,
      slotId:            upcomingSlot.slotId,
      appointmentType:   'IN_PERSON',
      appointmentDate:   WEEK[1],
      appointmentReason: 'Knee pain after running',
      apptStatus:        'CONFIRMED',
    },
  })

  await prisma.providerSlot.update({ where: { slotId: upcomingSlot.slotId }, data: { status: 'BOOKED' } })

  // ── Tele appointment ──────────────────────────────────────────────────────
  // Tom Chen — telehealth with Dr Chen (Cardiology) on day 3 at 10am

  const teleSlot = await prisma.providerSlot.findFirst({
    where: { providerId: drChen.providerId, slotDate: WEEK[2], slotStartTime: t(10, 0) },
  })

  await prisma.appointment.create({
    data: {
      patientId:         patient3.patientId,
      providerId:        drChen.providerId,
      slotId:            teleSlot.slotId,
      appointmentType:   'TELE',
      appointmentDate:   WEEK[2],
      appointmentReason: 'Follow-up on blood pressure medication',
      apptStatus:        'PENDING',
    },
  })

  await prisma.providerSlot.update({ where: { slotId: teleSlot.slotId }, data: { status: 'BOOKED' } })

  console.log('✅ Upcoming appointments seeded (confirmed + pending tele)')
  console.log('\n🎉 Done — amara seeded with a rolling week of data (starting tomorrow).')
  console.log(`   Providers : 4 (2 Cardiology, 2 Orthopedics)`)
  console.log(`   Patients  : 3`)
  console.log(`   Slots     : ${slotData.length} (${slotData.length - 3} available, 3 booked)`)
  console.log(`   Appointments: 3 (1 completed, 1 confirmed, 1 pending tele)`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
