# Payment Gateway API Documentation

## Overview
Esta API proporciona endpoints para procesamiento de pagos a través de MercadoPago y PayPal, incluyendo webhooks para notificaciones de estado de pago.

## Base URL
```
http://localhost:3000/api
```

## Health Check

### GET /health
Endpoint para verificar el estado de la aplicación.

**Respuesta:**
```json
{
  "status": "ok",
  "timestamp": "2023-10-23T12:00:00.000Z",
  "version": "1.0.0"
}
```

## MercadoPago Integration

### POST /api/payment/mercadopago
Crea una transacción de pago con MercadoPago.

**Request Body:**
```json
{
  "x_signature": "string",
  "x_amount": "number",
  "x_currency": "string",
  "x_reference": "string",
  "x_shop_name": "string",
  "x_url_complete": "string",
  "x_url_cancel": "string"
}
```

**Ejemplo de Request:**
```json
{
  "x_signature": "abc123def456",
  "x_amount": 100.50,
  "x_currency": "ARS",
  "x_reference": "ORDER-123",
  "x_shop_name": "Mi Tienda",
  "x_url_complete": "https://mitienda.com/success",
  "x_url_cancel": "https://mitienda.com/cancel"
}
```

**Response:**
```json
{
  "url": "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=PREFERENCE_ID"
}
```

**Status Codes:**
- `200 OK` - Transacción creada exitosamente
- `500 Internal Server Error` - Error en el procesamiento

---

### POST /api/payment/mercadopago/webhook
Webhook para recibir notificaciones de estado de pago de MercadoPago.

**Request Body (Merchant Order):**
```json
{
  "topic": "merchant_order",
  "resource": "https://api.mercadopago.com/merchant_orders/ORDER_ID"
}
```

**Request Body (Payment):**
```json
{
  "topic": "payment",
  "data": {
    "id": "PAYMENT_ID"
  }
}
```

**Response:**
```json
{
  "success": true
}
```

**Status Codes:**
- `200 OK` - Webhook procesado correctamente

**Supported Countries:**
- AR (Argentina) - ARS
- MX (México) - MXN  
- CL (Chile) - CLP

## PayPal Integration

### POST /api/payment/paypal
Crea una transacción de pago con PayPal.

**Request Body:**
```json
{
  "intent": "CAPTURE",
  "purchase_units": [
    {
      "amount": {
        "currency_code": "USD",
        "value": "100.00"
      },
      "description": "Descripción del producto",
      "reference_id": "ORDER-123"
    }
  ],
  "application_context": {
    "return_url": "https://mitienda.com/success",
    "cancel_url": "https://mitienda.com/cancel"
  }
}
```

**Response:**
```json
{
  "id": "ORDER_ID",
  "status": "CREATED",
  "links": [
    {
      "href": "https://api.paypal.com/v2/checkout/orders/ORDER_ID",
      "rel": "self",
      "method": "GET"
    },
    {
      "href": "https://www.paypal.com/checkoutnow?token=ORDER_ID",
      "rel": "approve",
      "method": "GET"
    }
  ]
}
```

**Status Codes:**
- `200 OK` - Orden creada exitosamente
- `500 Internal Server Error` - Error en el procesamiento

---

### POST /api/payment/paypal/webhook
Webhook para recibir notificaciones de estado de pago de PayPal.

**Request Body:**
```json
{
  "event_type": "PAYMENT.CAPTURE.COMPLETED",
  "resource": {
    "id": "PAYMENT_ID",
    "amount": {
      "currency_code": "USD",
      "value": "100.00"
    },
    "status": "COMPLETED"
  }
}
```

**Response:**
```json
{
  "success": true
}
```

**Eventos Soportados:**
- `PAYMENT.CAPTURE.COMPLETED` - Pago completado
- `PAYMENT.CAPTURE.DENIED` - Pago denegado
- `CHECKOUT.ORDER.APPROVED` - Orden aprobada

**Status Codes:**
- `200 OK` - Webhook procesado correctamente

**Supported Currencies:**
- USD, EUR, GBP, CAD, AUD, JPY, ARS, MXN, CLP, COP

## Error Handling

Todos los endpoints pueden retornar los siguientes errores:

**400 Bad Request:**
```json
{
  "error": "Invalid signature"
}
```

**404 Not Found:**
```json
{
  "error": "Route not found",
  "path": "/api/invalid-path",
  "method": "GET"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Internal server error"
}
```

## Rate Limiting
- Límite: 100 requests por 15 minutos por IP
- Header de respuesta: `X-RateLimit-*`

## Security
- Todas las rutas están protegidas con CORS
- Validación de firmas HMAC para webhooks de Jumpseller
- Rate limiting implementado
- Headers de seguridad con Helmet

## Environment Variables Required

### MercadoPago
```
DEV_ACCESS_TOKEN_MP=your_mercadopago_access_token
BASE_URL=http://localhost:3000
```

### PayPal
```
CLIENT_ID_PAYPAL=your_paypal_client_id
SECRET_KEY_PAYPAL=your_paypal_secret_key
URL_API_PAYPAL=https://api.sandbox.paypal.com (sandbox) o https://api.paypal.com (production)
```

### General
```
FRONTEND_URL=http://localhost:5173
PORT=3000
```
