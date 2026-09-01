import { recoveryActions, agentLogs } from '../data/apiData.js'

export const getRecoveryActions = (req, res) => {
  res.json({
    success: true,
    count: recoveryActions.length,
    data: recoveryActions,
  })
}

export const getAgentLogs = (req, res) => {
  res.json({
    success: true,
    count: agentLogs.length,
    data: agentLogs,
  })
}