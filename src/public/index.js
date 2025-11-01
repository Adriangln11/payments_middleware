const paypalBtn = document.getElementById('btn-paypal');
const mercadopagoBtn = document.getElementById('btn-mercado');

const urlParams = new URLSearchParams(window.location.search)
const paymentData = Object.fromEntries(urlParams.entries())

paypalBtn.addEventListener('click', async () => {
  console.log('PRESSED PAYPAL')
  console.log(paymentData)
})

mercadopagoBtn.addEventListener('click', async () => {
  console.log('PRESSED MERCADOPAGO')
  console.log(paymentData)
  await fetch('/api/payment/mercadopago', {
    method: 'POST',
    headers: {
      "Content-Type": 'application/json'
    },
    body: JSON.stringify(paymentData)
  })
})
