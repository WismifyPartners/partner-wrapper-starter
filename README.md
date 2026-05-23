# Wismify Partner Wrapper Starter

Servidor en **Node + Express + TypeScript** para integrar tu plataforma con el
[Programa Partner de Wismify](https://partners.wismify.com).

Este wrapper es la pieza HTTPS pública que recibe los eventos firmados desde
Wismify (cuando un agente del tenant clica un botón en el ticket, abre tu
dashboard en el sidebar, etc.), los procesa contra TU API interna, y devuelve
un **Block Kit JSON** que Wismify renderiza nativo en el panel CX.

```
┌─────────────┐     POST firmado HMAC      ┌────────────┐     llamadas privadas    ┌─────────────┐
│ Wismify CX  │  ─────────────────────────►│ Tu wrapper │ ────────────────────────►│ Tu API real │
│ (ticket UI) │                            │  (este     │                          │ (Obsydian,  │
│             │ ◄────────────────────────  │   repo)    │ ◄────────────────────────│  CRM, …)    │
└─────────────┘    Block Kit JSON          └────────────┘     respuestas internas  └─────────────┘
```

**Lo que hace este wrapper:**
- Verifica firma HMAC-SHA256 en cada request (rechaza si falla)
- Despacha al handler de la acción / dashboard correspondiente
- Devuelve Block Kit validado por tipos TypeScript

**Lo que NO hace:**
- Hospedar UI (Wismify renderiza con su diseño)
- Mantener sesiones (cada call es independiente)
- Almacenar datos de Wismify (los recibe firmados, los usa, los olvida)

---

## Quick start (5 minutos)

### 1. Clona y arranca

```bash
git clone https://github.com/WismifyPartners/partner-wrapper-starter wismify-wrapper
cd wismify-wrapper
npm install
cp .env.example .env
```

### 2. Crea tu app en el panel

1. Regístrate en https://partners.wismify.com (firma docs, activa 2FA)
2. **Aplicaciones → + Crear app**
3. Paso 2: define **nombre**, **descripción**, **scopes** (qué datos pedirás:
   `ticket.read`, `customer.read`, `shipment.read`, `carrier.read`) y
   **dashboard URL** opcional
4. Paso 3: define **acciones webhook** — botones que aparecerán en el panel
   del ticket. Para cada uno, la **Webhook URL** debe apuntar a tu wrapper:
   ```
   https://tu-dominio.com/actions/<slug-único>
   ```
5. Paso 4: automatizaciones opcionales (reglas IF-THEN que disparan acciones
   automáticamente cuando se cumplen condiciones en el ticket)
6. **Finalizar** → Wismify revisa la app (≤24h) → al aprobar, se muestran tus
   `client_id`, `client_secret` y `webhook_secret` **una sola vez**

### 3. Configura `.env`

```ini
WISMIFY_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxx
PORT=3000

# Tus credenciales internas (ejemplo Obsydian)
OBSYDIAN_API_KEY_ID=apk_xxxxxxxxxxxxxxxxxxx
OBSYDIAN_API_PASSWORD=opr_live_xxxxxxxxxxxxx
```

`WISMIFY_WEBHOOK_SECRET` lo guardas del momento de finalizar la app — no se
muestra dos veces. Si lo pierdes, **Rotar secret** desde el detalle de la
app (genera uno nuevo e invalida el anterior).

### 4. Despliega

Cualquier host Node 20+ con HTTPS público:

| Host | Cómo |
|---|---|
| **Vercel** | `vercel deploy --prod` |
| **Railway** | conecta el repo en railway.app |
| **Fly.io** | `fly launch` |
| **VPS + PM2** | `npm run build && pm2 start dist/index.js --name wismify-wrapper` |
| **Docker** | `node:20-alpine` + `npm ci && npm run build && npm start` |

### 5. Configura las URLs en el panel

Vuelve al detalle de tu app en `partners.wismify.com` y verifica que cada
acción apunta a `https://tu-dominio.com/actions/<slug>` (mismo slug que el
`case` en `src/index.ts`).

### 6. Prueba con un tenant real

Desde el detalle de tu app → **Enviar a un tenant** → email del admin del
tenant → Wismify revisa la install request → tenant recibe email → acepta los
scopes → tu app aparece en su panel CX.

---

## Estructura del repo

```
wismify-wrapper/
├── src/
│   ├── index.ts                    ← entry: registra acciones + dashboard
│   ├── lib/
│   │   ├── verify.ts               ← HMAC-SHA256 timing-safe
│   │   ├── payload.ts              ← tipos del JSON que recibes
│   │   └── blockkit.ts             ← tipos del JSON que devuelves
│   └── actions/
│       ├── obsydian-claim.ts       ← EJEMPLO: crear reclamación
│       └── obsydian-refund.ts      ← EJEMPLO: marcar reembolso
├── .env.example
├── package.json
└── tsconfig.json
```

---

## Crear una acción nueva (3 pasos)

### Paso 1 — Define el handler

Crea `src/actions/mi-accion.ts`:

```ts
import type { WismifyEventPayload } from '../lib/payload.js';
import type { WismifyResponse } from '../lib/blockkit.js';

export async function handleMiAccion(payload: WismifyEventPayload): Promise<WismifyResponse> {
  // 1. Lee los datos del ticket / cliente / envío que pediste vía scopes
  const ticket   = payload.data.ticket;
  const customer = payload.data.customer;
  const shipment = payload.data.shipment;

  // 2. Llama a TU API con TUS credenciales (nunca expuestas a Wismify)
  const myApiResponse = await fetch('https://mi-api-interna.com/algo', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.MI_API_KEY}` },
    body: JSON.stringify({
      tracking: shipment?.tracking_number,
      customer_email: customer?.email,
    }),
  });
  const data = await myApiResponse.json();

  // 3. Devuelve Block Kit — Wismify lo renderiza con su diseño
  return {
    blocks: [
      { type: 'heading', text: 'Procesado correctamente' },
      { type: 'field', label: 'ID', value: data.id },
      { type: 'status_badge', tone: 'success', text: data.status },
    ],
  };
}
```

### Paso 2 — Regístralo en `src/index.ts`

```ts
import { handleMiAccion } from './actions/mi-accion.js';

// dentro del switch (slug):
case 'mi-accion':
  response = await handleMiAccion(payload);
  break;
```

### Paso 3 — Crea la acción en el panel

`partners.wismify.com → tu app → Setup paso 3 → + Añadir acción`:
- **Label**: "Procesar X" (lo que verá el agente)
- **Webhook URL**: `https://tu-dominio.com/actions/mi-accion`
- **Scopes requeridos**: marca solo los necesarios

Wismify firmará y enviará llamadas a esa URL cuando el agente clique.

---

## Ejemplo completo: integración Opereit ↔ Wismify (para ECOALF)

Caso real: Opereit gestiona reclamaciones logísticas. Wismify CX recibe
tickets; cuando uno se categoriza como incidencia de transporte (perdida o
dañada), debe crear una reclamación en Opereit automáticamente.

### Setup en partners.wismify.com

- Crea app `Opereit Claims`
- Scopes: `ticket.read`, `customer.read`, `shipment.read`, `carrier.read`
- Acciones:
  - Slug `opereit-claim` → label `Crear reclamación`, scopes los 4
- Automatización (paso 4): cuando `incidence.type` está en `['LOST','DAMAGED']`,
  notificar webhook `opereit-claim`

### Handler `src/actions/opereit-claim.ts`

```ts
import type { WismifyEventPayload } from '../lib/payload.js';
import type { WismifyResponse } from '../lib/blockkit.js';

const OBSYDIAN_API = 'https://api.obsydianai.com/v1';

export async function handleOpereitClaim(payload: WismifyEventPayload): Promise<WismifyResponse> {
  const { ticket, customer, shipment, carrier } = payload.data;

  // Mapea Wismify → Obsydian
  const claimBody = {
    shipment: {
      tracking_number: shipment?.tracking_number,
      carrier: (carrier?.name ?? '').toUpperCase(),  // UPS, SEUR, CORREOS…
      line_items: [
        { description: ticket?.subject ?? 'Pedido', quantity: 1, unit_price: 5000, currency: 'EUR' },
      ],
      origin: { postcode: '28001', country: 'ES' },  // tu warehouse
      destination: {
        postcode: shipment?.destination?.postcode ?? '',
        country: shipment?.destination?.country ?? 'ES',
        city: shipment?.destination?.city ?? '',
        address: shipment?.destination?.address ?? '',
        customer_name: customer?.name ?? '',
        customer_phone: customer?.phone ?? undefined,
      },
    },
    incidence: {
      type: 'LOST',                  // o 'DAMAGED' según IA de Wismify
      description: ticket?.subject ?? '',
      claimed_amount: 5000,           // céntimos
      currency: 'EUR',
    },
  };

  const auth = Buffer.from(
    `${process.env.OBSYDIAN_API_KEY_ID}:${process.env.OBSYDIAN_API_PASSWORD}`
  ).toString('base64');

  const resp = await fetch(`${OBSYDIAN_API}/claims`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(claimBody),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: resp.statusText }));
    return {
      blocks: [
        { type: 'heading', text: 'No se pudo crear la reclamación' },
        { type: 'status_badge', tone: 'danger', text: `HTTP ${resp.status}` },
        { type: 'text', text: err.error ?? 'Error desconocido' },
      ],
    };
  }

  const claim = await resp.json();

  return {
    blocks: [
      { type: 'heading', text: `Reclamación creada` },
      { type: 'status_badge', tone: 'success', text: claim.status },
      { type: 'field', label: 'ID', value: claim.id },
      { type: 'field', label: 'Tracking', value: shipment?.tracking_number ?? '—' },
      { type: 'field', label: 'Importe reclamado', value: `${(claim.incidence.claimed_amount / 100).toFixed(2)} ${claim.incidence.currency}` },
      { type: 'divider' },
      { type: 'link', label: 'Ver en Opereit', url: `https://dashboard.opereit.ai/claims/${claim.id}` },
    ],
  };
}
```

---

## Dashboard del sidebar (opcional)

Además de las acciones en el ticket, tu app tiene una **pestaña propia** en
el sidebar del tenant (`cx.wismify.com/apps/<installation_id>`). Dos modos
posibles, configurables al crear/editar la app:

### Modo Block Kit

Wismify hace POST a `https://tu-dominio.com/dashboard` (configura esta URL
en el wizard). Tu wrapper devuelve Block Kit, Wismify lo renderiza con su
diseño. Mismo formato que las acciones pero con `event: 'dashboard.load'`.

El starter kit incluye ya un handler ejemplo en `src/index.ts`:

```ts
app.post('/dashboard', async (req, res) => {
  // ... verify firma ...
  // const payload = req.body as WismifyEventPayload;
  // payload.installation_id te dice cuál tenant es
  return res.json({
    blocks: [
      { type: 'heading', text: 'Estado de reclamaciones' },
      { type: 'field', label: 'Activas', value: '12', style: 'default' },
      { type: 'field', label: 'En revisión', value: '5', style: 'warning' },
      { type: 'field', label: 'Resueltas (30d)', value: '47', style: 'success' },
      // ...
    ],
  });
});
```

### Modo Iframe SSO

Wismify embebe TU URL HTML en un iframe sandboxed y te pasa un **JWT
RS256 corto-lived** (5 min) que identifica al tenant + agente. Tú validas el
JWT contra el JWKS público de Wismify y muestras tu propio dashboard
autenticado. Ideal si ya tienes UI compleja (charts, gráficos, tablas).

Verifica el JWT con `jose` o cualquier lib JWT:

```ts
import { jwtVerify, createRemoteJWKSet } from 'jose';

const JWKS = createRemoteJWKSet(
  new URL('https://cx.wismify.com/.well-known/jwks.json')
);

// En tu página /dashboard-embed
const params = new URLSearchParams(location.hash.replace(/^#/, ''));
const token = params.get('wismify_sso');
history.replaceState(null, '', location.pathname);  // limpiar hash

const { payload } = await jwtVerify(token, JWKS, {
  issuer:   'https://cx.wismify.com',
  audience: 'TU_CLIENT_ID',           // wsmp_xxxxxxxx
});
// payload.sub       = installation_id
// payload.tenant    = hash opaco estable del tenant
// payload.user      = hash opaco estable del agente
// payload.scopes    = array de scopes aprobados
```

**Importante sobre `aud`:** NO pongas el `client_id` como query string en la
URL (ej. `?aud=wsmp_…`). Cada nueva versión de tu app tiene un `client_id`
distinto, y si lo metes en la URL se queda hardcoded al clonar. Tu wrapper
conoce su `client_id` por configuración interna — léelo de ahí.

Tu HTML del embed **debe** incluir cabecera:
```
Content-Security-Policy: frame-ancestors https://cx.wismify.com
```

---

## Formato Block Kit (referencia)

Tu wrapper devuelve siempre `{ blocks: [...] }`. Tipos disponibles:

| Tipo | Para qué | Ejemplo |
|---|---|---|
| `text` | Párrafo | `{ type: 'text', text: 'Hola' }` |
| `heading` | Título | `{ type: 'heading', text: 'Reclamación #123' }` |
| `field` | Clave-valor | `{ type: 'field', label: 'Estado', value: 'Activo', style: 'success' }` |
| `divider` | Separador | `{ type: 'divider' }` |
| `list` | Bullets | `{ type: 'list', items: ['a', 'b', 'c'] }` |
| `link` | Enlace https | `{ type: 'link', label: 'Ver', url: 'https://...' }` |
| `button` | Reinvoca tu webhook con `action_id` | `{ type: 'button', label: 'Reintentar', action_id: 'retry', style: 'primary' }` |
| `status_badge` | Pill coloreado | `{ type: 'status_badge', text: 'OK', tone: 'success' }` |
| `timeline` | Eventos verticales | `{ type: 'timeline', items: [{ label, time, status: 'done'\|'pending'\|'failed' }] }` |
| `form` | Modal con campos | ver abajo |
| `actions` | Fila de botones | `{ type: 'actions', buttons: [...] }` |

**Estilos disponibles:**
- `field.style`: `default`, `success`, `warning`, `danger`
- `status_badge.tone`: `neutral`, `success`, `warning`, `danger`
- `button.style`: `default`, `primary`, `danger`

**Form completo:**

```ts
{
  type: 'form',
  submit_action_id: 'create_claim',
  submit_label: 'Crear reclamación',
  fields: [
    { type: 'select', name: 'type', label: 'Motivo', required: true,
      options: [
        { value: 'LOST',    label: 'Perdido' },
        { value: 'DAMAGED', label: 'Dañado' },
      ]},
    { type: 'number',   name: 'amount_cents', label: 'Importe (céntimos)', required: true },
    { type: 'textarea', name: 'description',  label: 'Observaciones' },
  ],
}
```

Cuando el agente envía el form, tu webhook recibe el mismo payload pero con
`sub_action.action_id = 'create_claim'` y `sub_action.form_values` con los
valores tipados.

**Tipos no listados se descartan silenciosamente.** URLs solo `https://`
pública (no `http`, no IPs privadas).

---

## Verificación de firma HMAC

Cada request lleva:

```
X-Wismify-Signature: t=1729123456,v1=8a3f9e1b9c4d...
X-Wismify-Timestamp: 1729123456
X-Wismify-App-Id: wsmp_xxxxxxxxxxxx
X-Wismify-Installation-Id: <uuid>
X-Wismify-Action-Id: <uuid>             (solo en /actions/...)
X-Wismify-Event: action.invoked          (o 'dashboard.load')
```

El starter verifica automáticamente. **Nunca proceses un request sin
verificar la firma** — sería trivialmente suplantable.

Algoritmo: `HMAC-SHA256(webhook_secret, `${timestamp}.${rawBody}`)`.
Tolerancia: 5 min entre `timestamp` y `now()` (anti-replay).

---

## Payload que recibes

```ts
{
  event: 'action.invoked' | 'dashboard.load' | 'automation.triggered',
  action: { id: '<uuid>', label: 'Ver reclamación' },
  installation_id: '<uuid>',
  client_id: 'wsmp_xxxxx',
  triggered_by: '<auth.users.id del agente>',
  triggered_at: '2026-05-22T10:00:00Z',
  scopes: ['ticket.read', 'customer.read', 'shipment.read'],
  data: {
    ticket?:   { id, subject, status, urgency, channel, from_email, from_name, created_at },
    customer?: { id, name, email, phone, shopify_customer_id },
    shipment?: { order_id, tracking_number, carrier, destination: {
                   address, city, country, postcode, customer_name } } | null,
    carrier?:  { name, tracking_url, status } | null,
  },
  sub_action?: {
    action_id: 'create_claim',
    form_values?: { type: 'LOST', amount_cents: 5500 }
  }
}
```

Las claves de `data` **solo aparecen si declaraste el scope correspondiente**.
Sin `customer.read`, `data.customer` es undefined.

---

## Versionado (importante)

Una vez la app está `approved`, sus **scopes, acciones, dashboard URL y modo
son inmutables** (los tenants firmaron ese contrato). Para cambiarlos:

1. **Editar como nueva versión** desde el detalle de tu app
2. Se crea v2 en `draft` con copia de v1
3. Editas v2 normalmente, finalizas, pasa por revisión
4. Cuando v2 se apruebe, tenants reciben notificación de upgrade
5. Cada tenant acepta el upgrade (re-consent si cambiaste scopes)
6. v1 sigue funcionando mientras tanto

**Cada versión tiene su propio `client_id` y `webhook_secret`** — rotar/revocar
v1 no afecta v2.

---

## Seguridad — qué garantiza Wismify

1. **No accedes a datos no autorizados**: solo recibes lo que declaraste en
   `required_scopes`
2. **No invocas otros tenants**: cada webhook es de UNA installation
3. **No enumeras cross-tenant**: tus credenciales solo sirven para tu app
4. **Rate limit**: 60 calls/min por installation. Por encima → 429

---

## Troubleshooting

### "401 signature missing" / "signature mismatch"
- `.env`: ¿`WISMIFY_WEBHOOK_SECRET` coincide con el que viste al finalizar?
- ¿Estás verificando contra el **raw body** (sin parsear)? El starter ya lo hace
- Si lo perdiste: **Rotar secret** desde el detalle de la app

### Wismify devuelve 502 al llamar a tu endpoint
- Tu dominio: ¿HTTPS válido? (Let's Encrypt, no auto-firmado)
- ¿Accesible desde Internet? (no localhost, no detrás de VPN)
- ¿No bloqueado por Cloudflare / WAF a IPs de Wismify?

### Block Kit no se renderiza / partes desaparecen
- Verifica los tipos contra la tabla — tipos no listados se descartan
- URLs: solo `https://` público (sin localhost, IPs privadas, puertos extra)
- Strings con caracteres invisibles (RTL `\u202E`, ZWSP): el parser los limpia

### Iframe SSO falla con "refused to connect"
- Tu HTML necesita `Content-Security-Policy: frame-ancestors https://cx.wismify.com`
- NO incluyas `X-Frame-Options: DENY`

### Iframe SSO falla con "unexpected aud claim value"
- No metas el `client_id` como query param en la URL — cada versión tiene
  uno distinto y al clonar se queda hardcoded al viejo. Lee el `aud` del JWT.

### "Esta versión ya está enviada a revisión"
- En `pending_review` o `approved` no se edita. Crea una nueva versión.

---

## Soporte

- **Panel + Guía interactiva**: https://partners.wismify.com (botón Guía
  flotante en el detalle de la app)
- **Email**: partners@wismify.com
- **Issues**: https://github.com/WismifyPartners/partner-wrapper-starter/issues

Si necesitas una funcionalidad que no exista (scope nuevo, bloque Block Kit,
trigger de automatización, etc.) escríbenos — el programa está en fase
inicial y priorizamos desarrollo sobre la marcha con partners activos.
