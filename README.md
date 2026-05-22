# Wismify Partner Wrapper Starter

Servidor mínimo en Node + Express + TypeScript para integrar tu API con el
[Programa Partner de Wismify](https://partners.wismify.com).

**Lo que hace este wrapper:**

1. Expone un endpoint HTTPS donde Wismify envía webhooks firmados
2. Verifica la firma HMAC-SHA256 antes de procesar
3. Llama a TU API interna con TUS credenciales
4. Devuelve **Block Kit** — un JSON declarativo que Wismify renderiza como
   tarjeta, modal o formulario con el diseño nativo del panel CX

**Lo que no hace:**

- Hospedar UI (Wismify se encarga del frontend)
- Mantener sesiones de usuario (cada llamada es independiente, firmada)
- Almacenar datos de Wismify (los recibe firmados, los usa, los olvida)

---

## Quick start

```bash
git clone https://github.com/WismifyPartners/partner-wrapper-starter wismify-wrapper
cd wismify-wrapper
npm install
cp .env.example .env
# edita .env con tus secrets
npm run dev
```

El servidor levanta en `http://localhost:3000`. Para producción, desplégalo
detrás de un dominio público con HTTPS (Vercel, Railway, Fly, tu propio VPS).

Cuando crees tus acciones en el dashboard de Wismify Partners, apunta el
campo **Webhook URL** a:

```
https://tu-dominio.com/actions/<slug-de-la-acción>
```

Por ejemplo:
- Acción "Ver/abrir reclamación" → `https://wismify.opereit.com/actions/obsydian-claim`
- Acción "Marcar reembolso" → `https://wismify.opereit.com/actions/obsydian-refund`

---

## Cómo crear una acción nueva

1. Crea `src/actions/<nombre>.ts`:

   ```ts
   import type { WismifyEventPayload } from '../lib/payload.js';
   import type { WismifyResponse } from '../lib/blockkit.js';

   export async function handleMyAction(payload: WismifyEventPayload): Promise<WismifyResponse> {
     // Tu lógica aquí — llama a tu API, formatea datos, etc.
     return {
       blocks: [
         { type: 'heading', text: 'Resultado' },
         { type: 'text', text: 'Lo que quieras mostrar al agente.' },
       ],
     };
   }
   ```

2. Registra el handler en `src/index.ts` (añade un `case` en el `switch`):

   ```ts
   import { handleMyAction } from './actions/my-action.js';
   // ...
   case 'my-action':
     response = await handleMyAction(payload);
     break;
   ```

3. En el dashboard de Wismify, crea la acción con URL
   `https://tu-dominio.com/actions/my-action`.

4. Listo. Wismify firmará y enviará llamadas a esa URL cuando el agente clique.

---

## Formato Block Kit

Tu wrapper debe devolver siempre un objeto `{ blocks: [...] }` con
componentes del catálogo de Wismify. Wismify los renderiza con su diseño;
tú solo decides la información.

**Tipos disponibles:**

| Tipo | Para qué sirve | Ejemplo |
|---|---|---|
| `text` | Párrafo plano | `{ type: 'text', text: 'Hola' }` |
| `heading` | Título de sección | `{ type: 'heading', text: 'Reclamación #123' }` |
| `field` | Par clave-valor | `{ type: 'field', label: 'Estado', value: 'Activo' }` |
| `divider` | Línea separadora | `{ type: 'divider' }` |
| `list` | Lista con bullets | `{ type: 'list', items: ['a', 'b', 'c'] }` |
| `link` | Enlace externo | `{ type: 'link', label: 'Ver detalle', url: 'https://...' }` |
| `button` | Botón que reinvoca tu webhook | `{ type: 'button', label: 'Reintentar', action_id: 'retry' }` |
| `status_badge` | Pill con color | `{ type: 'status_badge', text: 'OK', tone: 'success' }` |
| `timeline` | Lista vertical de eventos | `{ type: 'timeline', items: [...] }` |
| `form` | Modal con form | `{ type: 'form', submit_action_id: '...', fields: [...] }` |

Si devuelves un tipo no listado, Wismify lo descarta silenciosamente.

**URLs deben ser `https://`**, dominio público (no localhost, no IPs privadas).

---

## Verificación de firma HMAC

Cada request de Wismify llega con cabeceras:

```
X-Wismify-Signature: t=1729123456,v1=8a3f9e1b...
X-Wismify-Timestamp: 1729123456
X-Wismify-App-Id: wsmp_xxxxxxxxxxxx
X-Wismify-Installation-Id: <uuid>
X-Wismify-Action-Id: <uuid>
```

El wrapper verifica automáticamente — si la firma no coincide, devuelve 401
sin procesar. **No proceses nunca un request sin verificar la firma.**

El algoritmo: `HMAC-SHA256(webhook_secret, `${timestamp}.${rawBody}`)`.

Tolerancia: 5 minutos entre `timestamp` y `Date.now()` para evitar replay.

---

## Estructura del payload

Lo que recibes en el body (ver `src/lib/payload.ts` para tipos completos):

```ts
{
  event: 'action.invoked',
  action: { id: '<uuid>', label: 'Ver reclamación' },
  installation_id: '<uuid>',
  client_id: 'wsmp_xxxxx',
  triggered_by: '<auth.users.id del agente>',
  triggered_at: '2026-05-22T10:00:00Z',
  scopes: ['ticket.read', 'customer.read', 'shipment.read'],
  data: {
    ticket: { id, subject, status, priority, channel, created_at },
    customer: { id, name, email, phone },
    shipment: { tracking_number, carrier, destination: {...} } | null,
    carrier: { name, tracking_url, status } | null,
  },
  sub_action?: {
    action_id: 'create_claim',
    form_values: { type: 'LOST', amount_cents: 5500 }
  }
}
```

Las claves de `data` solo aparecen si tu acción declaró el scope
correspondiente. Si no pediste `customer.read`, `data.customer` no existe.

---

## Seguridad — qué garantiza Wismify

1. **No tienes acceso a datos no autorizados**: solo recibes lo que declaraste
   en `required_scopes` de la acción.
2. **No puedes invocar otros tenants**: cada webhook es de UNA installation
   específica, ligada a UN tenant.
3. **No puedes pedir cross-tenant**: tus credenciales (client_secret) solo
   sirven para tu app, no para enumerar.
4. **Rate limit**: 60 calls/minuto por installation. Por encima → 429.

---

## Despliegue

Cualquier host que sirva Node 20+ con HTTPS:

- **Vercel / Railway / Fly**: drag-and-drop o `git push`
- **Tu VPS con PM2**: `pm2 start dist/index.js --name wismify-wrapper`
- **Docker**: incluye `node:20-alpine` y `npm ci && npm run build && npm start`

⚠️ El endpoint debe ser accesible desde Internet (Wismify llama desde
sus servidores). Asegúrate de tener HTTPS válido — Wismify no llama a HTTP.

---

## Soporte

- Documentación completa: https://partners.wismify.com/docs
- Contacto: partners@wismify.com
