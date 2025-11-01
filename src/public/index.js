const paypalBtn = document.getElementById('btn-paypal');
const mercadopagoBtn = document.getElementById('btn-mercadopago');

const urlParams = new URLSearchParams(window.location.search)
const paymentData = Object.fromEntries(urlParams.entries())

paypalBtn.addEventListener('click', async () => {
  await fetch('/api/payment/paypal', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: paymentData
  })
})

mercadopagoBtn.addEventListener('click', async () => {
  console.log(paymentData)
})