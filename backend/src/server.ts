// backend/src/server.ts
import Fastify from 'fastify'

const app = Fastify({ logger: true })

app.get('/', async () => {
  return { status: 'Mindnamo Backend Online' }
})

const start = async () => {
  try {
    // Host 0.0.0.0 is required for Project IDX to expose the port
    await app.listen({ port: 3000, host: '0.0.0.0' })
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()