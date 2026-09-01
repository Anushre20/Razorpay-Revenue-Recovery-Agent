import transactions from '../data/transactions.json' with { type: 'json' }

export const getTransactions = (req, res) => {
  res.json({
    success: true,
    count: transactions.length,
    data: transactions,
  })
}

export const getTransactionById = (req, res) => {
  const transaction = transactions.find(
    (item) => item.id === req.params.id,
  )

  if (!transaction) {
    return res.status(404).json({
      success: false,
      message: 'Transaction not found',
    })
  }

  res.json({
    success: true,
    data: transaction,
  })
}