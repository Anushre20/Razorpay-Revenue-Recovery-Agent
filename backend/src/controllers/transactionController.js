import {
  getTransactionsBySource,
  findTransaction,
} from '../services/transactionStore.js'

export const getTransactions = (req, res) => {
  const source = req.query.source
  const result = source ? getTransactionsBySource(source) : getTransactionsBySource('all')

  res.json({
    success: true,
    count: result.length,
    data: result,
  })
}

export const getTransactionById = (req, res) => {
  const transaction = findTransaction(req.params.id)

  if (transaction) {
    return res.json({
      success: true,
      data: transaction,
    })
  }

  return res.status(404).json({
    success: false,
    message: 'Transaction not found',
  })
}
