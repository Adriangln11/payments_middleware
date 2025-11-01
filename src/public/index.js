const paypalBtn = document.getElementById('btn-paypal');
const mercadopagoBtn = document.getElementById('btn-mercado');

const urlParams = new URLSearchParams(window.location.search)
const paymentData = Object.fromEntries(urlParams.entries())

paypalBtn.addEventListener('click', async () => {
  const res = await fetch('/api/payment/paypal', {
    method: 'POST',
    headers: {
      "Content-Type": 'application/json'
    },
    body: JSON.stringify(paymentData)
  })

  const data = await res.json()
  if (data.links[1].href) {
    window.location.href = data.links[1].href
  } else {
    console.error('Error processing PayPal payment', data)
  }
})

mercadopagoBtn.addEventListener('click', async () => {

  const res = await fetch('/api/payment/mercadopago', {
    method: 'POST',
    headers: {
      "Content-Type": 'application/json'
    },
    body: JSON.stringify(paymentData)
  })

  const data = await res.json()
  if (data.url) {
    window.location.href = data.url
  } else {
    console.error('Error processing MercadoPago payment', data)
  }
})
