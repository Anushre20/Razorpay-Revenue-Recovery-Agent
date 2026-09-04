import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import transactionRoutes from './routes/transactionRoutes.js'
import diagnosisRoutes from './routes/diagnosisRoutes.js'
import recoveryRoutes from './routes/recoveryRoutes.js'
import analyticsRoutes from './routes/analyticsRoutes.js'
import auditRoutes from './routes/auditRoutes.js'
import leakageRoutes from './routes/leakageRoutes.js'
import evaluationRoutes from './routes/evaluationRoutes.js'
import integrationRoutes from './routes/integrationRoutes.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

app.use(cors())
app.use(express.json())
app.use('/api/transactions', transactionRoutes)
app.use('/api/diagnosis', diagnosisRoutes)
app.use('/api/recovery', recoveryRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/audit', auditRoutes)
app.use('/api/leakage', leakageRoutes)
app.use('/api/evaluation', evaluationRoutes)
app.use('/api/integration', integrationRoutes)

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Revenue Recovery Agent Backend is running',
  })
})

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    service: 'revenue-recovery-agent-backend',
    status: 'healthy',
  })
})

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Revenue Recovery Backend running on port ${PORT}`)
})

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use.`)
    console.error('Stop the existing backend process and run npm run dev again.')
    process.exit(1)
  }

  console.error('Server error:', error)
})

process.on('SIGINT', () => {
  console.log('\nServer shutting down...')
  server.close(() => {
    console.log('Server stopped.')
    process.exit(0)
  })
})

process.on('SIGTERM', () => {
  server.close(() => {
    process.exit(0)
  })
})

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Promise Rejection:', reason)
})

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err)
})