import Razorpay from 'razorpay'

let razorpay

function getRazorpay() {
  if (!razorpay) {
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    })
  }
  return razorpay
}

export async function createTestOrder({
  amount,
  currency = 'INR',
  receipt,
  notes = {},
}) {
  const order = await getRazorpay().orders.create({
    amount: Math.round(amount * 100),
    currency,
    receipt,
    notes,
  })

  return order
}

export async function createTestPaymentLink({
  amount,
  description,
  referenceId,
  customer,
}) {
  const paymentLink =
  await getRazorpay().paymentLink.create({
    amount: Math.round(amount * 100),
    currency: 'INR',
    description,
    reference_id: referenceId,
    ...(customer &&
    Object.keys(customer).length > 0
      ? { customer }
      : {}),
    notify: {
      sms: false,
      email: false,
    },
  })

  return paymentLink
}

export async function verifyCredentials() {
  const rp = getRazorpay()
  const result = await rp.payments.all({ count: 1 })
  return { verified: true, paymentCount: result.count || 0 }
}

export async function listPayments({ count = 100, skip = 0, from, to } = {}) {
  const rp = getRazorpay()
  const params = { count, skip }
  if (from) params.from = from
  if (to) params.to = to
  const result = await rp.payments.all(params)
  return result
}