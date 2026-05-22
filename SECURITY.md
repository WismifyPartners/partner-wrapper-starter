# Política de Seguridad

## Reportar una vulnerabilidad

Si encuentras una vulnerabilidad en este starter kit o en el Programa Partner
de Wismify (`partners.wismify.com`, `cx.wismify.com`), por favor **no abras
un issue público**. En su lugar, escribe a:

```
security@wismify.com
```

(o `partners@wismify.com` si prefieres)

Incluye:
- Una descripción del problema
- Pasos para reproducirlo
- Impacto estimado (qué se puede hacer con la vulnerabilidad)
- Tu propuesta de fix (si tienes una)

## Qué esperar

- **Acuse de recibo** en menos de 48 h hábiles
- **Evaluación y diagnóstico inicial** en menos de 7 días
- **Coordinación de la divulgación** según severidad

Si la vulnerabilidad es válida y crítica, podemos otorgarte crédito público
una vez parcheada (a tu elección).

## Alcance

Este repositorio contiene un **wrapper de ejemplo** que partners despliegan en
su propia infra. Vulnerabilidades aquí (ej. fallo en verificación HMAC,
inyección via parseo de JSON, etc.) son relevantes y se tratan con prioridad.

Vulnerabilidades en TU PROPIO despliegue del wrapper (ej. mala config de
credentials, exposición de tu API interna) **no son responsabilidad de
Wismify** — son responsabilidad del partner. Aun así, si crees que algo del
starter kit te empuja a un anti-patrón, repórtalo.

## Lo que NO está en alcance

- Comportamiento esperado y documentado (rate limits, scopes, etc.)
- Vulnerabilidades en dependencias de terceros con un fix conocido y published
- Issues que requieren acceso físico al server del partner
