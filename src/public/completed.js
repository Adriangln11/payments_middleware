const urlParams = new URLSearchParams(window.location.search)
const paymentData = Object.fromEntries(urlParams.entries())


function populatePurchaseData() {

  const date = new Date()

  document.getElementById('product-name').textContent = paymentData.x_description.replaceAll(/\\n/g, '\n') || 'Descripción del producto';
  document.getElementById('reference').textContent = paymentData.x_reference || '-';
  document.getElementById('date').textContent = date || '-';
  const amount = paymentData.x_amount || '0.00';
  const currency = paymentData.x_currency || 'USD';
  document.getElementById('total').textContent = `$${amount} ${currency}`;
}

document.addEventListener('DOMContentLoaded', function () {
  populatePurchaseData();
});