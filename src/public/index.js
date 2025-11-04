
const paypalBtn = document.getElementById('btn-paypal');
const mercadopagoBtn = document.getElementById('btn-mercado');

const urlParams = new URLSearchParams(window.location.search)
const paymentData = Object.fromEntries(urlParams.entries())

function populatePurchaseData() {

  document.getElementById('description').textContent = paymentData.x_description.replaceAll(/\\n/g, '\n') || 'Descripción del producto';
  document.getElementById('reference').textContent = paymentData.x_reference || '-';
  document.getElementById('shop-name').textContent = paymentData.x_shop_name || '-';


  const customerName = `${paymentData.x_customer_first_name || ''} ${paymentData.x_customer_last_name || ''}`.trim();
  document.getElementById('customer-name').textContent = customerName || '-';
  document.getElementById('customer-email').textContent = paymentData.x_customer_email || '-';
  document.getElementById('customer-phone').textContent = paymentData.x_customer_phone || '-';


  const amount = paymentData.x_amount || '0.00';
  const currency = paymentData.x_currency || 'USD';
  document.getElementById('subtotal').textContent = `$${amount} ${currency}`;
  document.getElementById('amount').textContent = `$${amount} ${currency}`;
}

function initializePayPal() {
  const amount = paymentData.x_amount || '10.00';
  const currency = paymentData.x_currency || 'USD';

  paypal.Buttons({
    fundingSource: paypal.FUNDING.CARD,
    createOrder: function (_, actions) {
      return actions.order.create({
        intent: 'CAPTURE',
        application_context: {
          shipping_preference: 'NO_SHIPPING',
          landing_page: 'BILLING',
          user_action: 'PAY_NOW'
        },
        purchase_units: [{
          amount: {
            currency_code: currency,
            value: amount
          }
        }]
      });
    },
    onApprove: function (_, actions) {
      return actions.order.capture().then(async function (orderData) {
        if (orderData.status === 'COMPLETED') {
          const res = await fetch('/api/payment/completed', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(paymentData)
          })
          const data = await res.json()
          if (data.success) window.location.href = data.url
        }
      });
    },
    onCancel: function (data) {
      console.log('Payment cancelled:', data);
    },
    onError: function (err) {
      alert('Error en el pago');
      console.error('Payment error:', err);
    }
  }).render('#paypal-form');
}

async function loadPayPalSDK() {
  try {
    const configResponse = await fetch('/api/payment/paypal/config');
    const config = await configResponse.json();

    if (!config.clientId) {
      console.error('PayPal Client ID not available');
      return;
    }

    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?client-id=${config.clientId}&components=buttons,funding-eligibility&enable-funding=card&disable-funding=credit,paylater`;
    script.async = true;

    script.onload = () => {
      console.log('PayPal SDK loaded successfully');
      initializePayPal();
    };

    script.onerror = () => {
      console.error('Failed to load PayPal SDK');
    };

    document.head.appendChild(script);

  } catch (error) {
    console.error('Error loading PayPal configuration:', error);
  }
}

function checkPayPalSDK() {
  if (typeof paypal !== 'undefined') {
    initializePayPal();
  } else {
    setTimeout(checkPayPalSDK, 100);
  }
}

document.addEventListener('DOMContentLoaded', function () {
  populatePurchaseData();
  loadPayPalSDK();
});

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
