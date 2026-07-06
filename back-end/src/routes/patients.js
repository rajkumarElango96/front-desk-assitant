'use strict'

module.exports = async function (fastify) {

  // GET /api/patients — list all patients
  fastify.get('/', async () => {
    return fastify.prisma.patient.findMany()
  })

  // GET /api/patients/:id — get a single patient with their appointments
  fastify.get('/:id', async (request, reply) => {
    const patient = await fastify.prisma.patient.findUnique({
      where: { patientId: request.params.id },
      include: { appointments: true, visits: true },
    })
    if (!patient) return reply.code(404).send({ error: 'Patient not found' })
    return patient
  })

  // POST /api/patients — register new patient or return existing by email
  fastify.post('/', {
    schema: {
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          firstName: { type: 'string' },
          lastName:  { type: 'string' },
          dob:       { type: 'string' },
          email:     { type: 'string', format: 'email' },
          phone:     { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { firstName, lastName, dob, email, phone } = request.body

    // Returning patient — find by email and return immediately
    const existing = await fastify.prisma.patient.findUnique({ where: { email } })
    if (existing) return reply.code(200).send({ ...existing, returning: true })

    // New patient — require all fields
    if (!firstName || !lastName || !dob) {
      return reply.code(400).send({ error: 'First name, last name, and date of birth are required for new patients' })
    }

    const patient = await fastify.prisma.patient.create({
      data: {
        firstName,
        lastName,
        dob:   new Date(dob),
        email,
        phone: phone || null,
      },
    })
    return reply.code(201).send({ ...patient, returning: false })
  })

  // PATCH /api/patients/:id — update phone or email
  fastify.patch('/:id', {
    schema: {
      body: {
        type: 'object',
        properties: {
          phone: { type: 'string' },
          email: { type: 'string', format: 'email' },
        },
      },
    },
  }, async (request, reply) => {
    const patient = await fastify.prisma.patient.update({
      where: { patientId: request.params.id },
      data:  request.body,
    })
    return patient
  })
}
