const paypalBtn = document.getElementById('btn-paypal');
const mercadopagoBtn = document.getElementById('btn-mercado');

const urlParams = new URLSearchParams(window.location.search)
const paymentData = Object.fromEntries(urlParams.entries())

// Populate purchase information
function populatePurchaseData() {
  // Purchase info
  document.getElementById('description').textContent = paymentData.x_description || 'Descripción del producto';
  document.getElementById('reference').textContent = paymentData.x_reference || '-';
  document.getElementById('shop-name').textContent = paymentData.x_shop_name || '-';
  
  // Customer info
  const customerName = `${paymentData.x_customer_first_name || ''} ${paymentData.x_customer_last_name || ''}`.trim();
  document.getElementById('customer-name').textContent = customerName || '-';
  document.getElementById('customer-email').textContent = paymentData.x_customer_email || '-';
  document.getElementById('customer-phone').textContent = paymentData.x_customer_phone || '-';
  
  // Amount with currency
  const amount = paymentData.x_amount || '0.00';
  const currency = paymentData.x_currency || 'USD';
  document.getElementById('subtotal').textContent = `$${amount} ${currency}`;
  document.getElementById('amount').textContent = `$${amount} ${currency}`;
}

// Initialize data when page loads
document.addEventListener('DOMContentLoaded', populatePurchaseData);

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
