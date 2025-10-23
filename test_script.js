
const crypto = require('crypto');

const API_URL = 'http://localhost:3000/api';
const SECRET = 'external_payment_gateway_password';

function generateSignature(params, secret) {

  const xParams = {};
  for (const [key, value] of Object.entries(params)) {
    if (key.startsWith('x_') && key !== 'x_signature') {
      xParams[key] = String(value);
    }
  }


  const sortedKeys = Object.keys(xParams).sort();
  const concatenatedString = sortedKeys
    .map(key => `${key}+${xParams[key]}`)
    .join('+');

  console.log('🔐 Concatenated string:', concatenatedString);

  return crypto
    .createHmac('sha256', secret)
    .update(concatenatedString)
    .digest('hex');
}

async function testPayment() {

  const orderParams = {
    x_reference: `ORDER-${Date.now()}`,
    x_amount: '12000',
    x_currency: 'CLP',
    x_shop_name: 'Tienda ColombiaCrypto',
    x_url_complete: 'https://shop.example.com/success',
    x_url_cancel: 'https://shop.example.com/cancel',
    x_url_callback: 'https://shop.example.com/callback',
    x_account_id: 'demo_account_id'
  };

  const signature = generateSignature(orderParams, SECRET);
  console.log('Generated signature:', signature);


  const signedParams = {
    ...orderParams,
    x_signature: signature
  };

  console.log('Sending order to payment gateway...');

  try {

    const response = await fetch(`${API_URL}/payment/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(signedParams),
      redirect: 'manual'
    });

    console.log('Response:', response);

    if (response.status === 302) {
      const redirectUrl = response.headers.get('location');
    } else if (response.status === 200) {
      const data = await response.json();
      console.log('Response data:', data);
    } else {
      const errorText = await response.text();
      console.log('Unexpected response:', errorText);
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

async function testHealthCheck() {
  console.log('Testing health check...');

  try {
    const response = await fetch(`${API_URL.replace('/api', '')}/health`);
    const data = await response.json();
    console.log('Health check passed:', data);
  } catch (error) {
    console.error('Health check failed:', error.message);
  }
}

async function main() {
  console.log('Payment Gateway Test\n');

  await testHealthCheck();
  console.log('');
  await testPayment();

  console.log('\nTest completed!');
  console.log('\nNext steps:');
  console.log('   1. Open the redirect URL in your browser');
  console.log('   2. Test payment method selection');
  console.log('   3. Check admin panel at http://localhost:5173/admin/login');
  console.log('      - Email: admin@demo.com');
  console.log('      - Password: Admin123!');
}

if (require.main === module) {
  main().catch(console.error);
}