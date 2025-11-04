# 💳 Payment Gateway API - Jumpseller Integration

## 📋 Overview
Gateway de pagos robusto que integra múltiples procesadores de pago (MercadoPago, PayPal) con soporte para guest checkout y webhooks. Diseñado específicamente para integraciones con Jumpseller y otras plataformas de e-commerce.

### ✨ Features
- **Multi-Gateway Support**: MercadoPago, PayPal con guest checkout
- **Security**: HMAC signature validation, rate limiting, CSP headers
- **Webhooks**: Notificaciones automáticas de estado de pago
- **Countries**: Soporte para Argentina, México, Chile, Estados Unidos
- **Frontend**: Interface de checkout responsiva incluida
- **Monitoring**: Logging estructurado con Winston

## 🏗 Architecture

```
Frontend (Checkout UI)
         ↓
Express.js Backend
         ↓
Payment Processors (MercadoPago/PayPal)
         ↓
Webhooks → Database → Jumpseller
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- TypeScript
- Git

### Installation

1. **Clone repository**
```bash
git clone <repository-url>
cd payment-gateway-demo/backend
```

2. **Install dependencies**
```bash
npm install
# or
yarn install
```

3. **Environment setup**
```bash
cp .env.example .env
# Edit .env with your credentials
```

4. **Database setup** (if using Prisma)
```bash
npx prisma generate
npx prisma migrate dev
```

5. **Run development server**
```bash
npm run dev
```

6. **Build for production**
```bash
npm run build
npm start
```

## 🌐 Base URLs
- **Development**: `http://localhost:3000`
- **API Base**: `http://localhost:3000/api`
- **Checkout UI**: `http://localhost:3000/index.html`

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

## ⚙️ Configuración del Entorno

### Variables de Entorno Requeridas

```bash
# Configuración del Servidor
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173

# Base de Datos (PostgreSQL)
DATABASE_URL=postgresql://user:password@localhost:5432/payment_gateway

# Redis (para caché y colas)
REDIS_HOST=localhost
REDIS_PORT=6379

# Seguridad JWT
JWT_SECRET=tu-clave-jwt-super-secreta-cambiar-en-produccion

# Integración Jumpseller
JUMPSELLER_PAYMENT_SECRET=external_payment_gateway_password
JUMPSELLER_ACCOUNT_ID=tu_account_id

# Credenciales MercadoPago
MERCADOPAGO_ACCESS_TOKEN_AR=TEST-xxxxx-AR  # Argentina
MERCADOPAGO_ACCESS_TOKEN_MX=TEST-xxxxx-MX  # México  
MERCADOPAGO_ACCESS_TOKEN_CL=TEST-xxxxx-CL  # Chile
DEV_ACCESS_TOKEN_MP=TEST-xxxxx-DEV         # Desarrollo
PROD_ACCES_TOKEN_MP=APP_USR-xxxxx-PROD     # Producción

# Credenciales PayPal
PAYPAL_CLIENT_ID=tu-paypal-client-id
PAYPAL_CLIENT_SECRET=tu-paypal-secret
PAYPAL_MODE=sandbox  # o 'live' para producción
CLIENT_ID_PAYPAL=tu-paypal-client-id       # Soporte legacy
SECRET_KEY_PAYPAL=tu-paypal-secret         # Soporte legacy
URL_API_PAYPAL=https://api.sandbox.paypal.com

# Seguridad HMAC
SECRET_HMAC=tu-clave-hmac-segura

# Binance Pay (Opcional)
BINANCE_PAY_API_KEY=tu-api-key
BINANCE_PAY_SECRET=tu-secret-key
BINANCE_PAY_MODE=sandbox

# API de Tipos de Cambio
EXCHANGE_RATE_API_KEY=tu-api-key
```

## 🔧 Cómo Funciona

### Flujo de Pago

1. **Iniciar Pago**
   ```
   POST /api/payment/ → Muestra la interfaz de checkout
   ```

2. **Usuario Selecciona Método de Pago**
   - PayPal (con cuenta o guest checkout)
   - MercadoPago (por país)

3. **Procesamiento del Pago**
   ```
   POST /api/payment/paypal → API de Órdenes PayPal
   POST /api/payment/mercadopago → API de Preferencias MercadoPago
   ```

4. **Usuario Completa el Pago**
   - Redirigido al procesador de pagos
   - Completa pago/autenticación

5. **Notificación por Webhook**
   ```
   POST /api/payment/paypal/webhook
   POST /api/payment/mercadopago/webhook
   ```

6. **Finalización**
   ```
   POST /api/payment/completed → Página de éxito
   ```

### Integración Frontend

La interfaz de checkout (`/src/public/index.html`) proporciona:
- **Diseño Responsivo**: Enfoque mobile-first
- **Carga Dinámica**: SDK de PayPal cargado con variables de entorno
- **Manejo de Errores**: Mensajes de error amigables
- **Guest Checkout**: Pagos PayPal sin crear cuenta

### Monitoreo de Salud
```bash
GET /health
{
  "status": "ok",
  "timestamp": "2023-10-23T12:00:00.000Z",
  "version": "1.0.0"
}
```
