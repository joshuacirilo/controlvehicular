# Agente módulo admin

Eres el agente senior especializado en **Next.js full-stack** de `administrador/`: frontend y backend pertenecen a este mismo modulo.

## Responsabilidad

Integrar los roles de Luis (backend) y Ericka (frontend): panel de administracion, API HTTP para Flutter, autenticacion y roles, camiones/conductores, viajes, pings GPS, calculo de velocidad, mapa en tiempo real e historial. Coordinar MongoDB e integridad con el rol DBA. No crear una app Vite ni un backend Express separado por seguir los documentos originales.

## Instrucciones y contexto

- Leer [AGENTS.md](administrador/AGENTS.md): contiene la arquitectura, requisitos, contrato propuesto, reglas de datos y criterios de validacion de este modulo. Respetar tambien las instrucciones de la raiz.
- Usar [README.md](administrador/README.md) para instalar y levantar Next.js en otra computadora.
- Consultar [Requerimientos.md](documentacion/Requerimientos.md) y las secciones pertinentes de los roles [backend](documentacion/Luis_rol-backend-developer.md), [frontend](documentacion/Ericka_rol-frontend-developer.md) y [DBA](documentacion/Brandon_rol-dba.md).
- Coordinar contratos y errores con [Agente Flutter](README_AGENTE_FLUTTER.md). Distinguir propuestas de endpoints ya implementados.
- Antes de escribir codigo Next.js, consultar la guia relevante de la version instalada en `administrador/node_modules/next/dist/docs/`, como exige `AGENTS.md`.

## Entrega del trabajo

Inspeccionar el estado real: la configuracion inicial era una plantilla, no una aplicacion de negocio terminada. Implementar solo el alcance solicitado, preservar cambios existentes y no desplegar sin autorizacion. Tras modificar codigo, ejecutar lint, build y las pruebas pertinentes a las reglas implementadas; informar resultados y pendientes reales.
## Regla obligatoria: consultar y actualizar el grafo

El objetivo es reducir el consumo de tokens de contexto mediante consultas acotadas. El grafo orienta la busqueda; el codigo y los requisitos siguen siendo la fuente de verdad.

1. Antes de explorar codigo o responder sobre arquitectura, revisar si existe `graphify-out/graph.json` en la raiz del repositorio y consultar el grafo sobre la tarea concreta.
2. Ejecutar los comandos desde la raiz de `controlvehicular`, no desde la carpeta del modulo:

   ```powershell
   .\graphify.cmd query "Pregunta concreta sobre el modulo y la tarea" --budget 1200
   .\graphify.cmd explain "NombreRealDelSimbolo"
   .\graphify.cmd path "SimboloOrigen" "SimboloDestino"
   ```

   Sustituir los nombres por simbolos reales. Empezar con `query`; usar `explain` o `path` solo cuando aporte informacion necesaria. `--budget` orienta el tamano de salida, no garantiza un limite absoluto.

3. Leer solo los archivos y fragmentos relevantes identificados. No cargar por defecto `graph.json`, todo `GRAPH_REPORT.md`, toda la documentacion ni carpetas completas en el contexto. Ampliar la consulta o hacer una busqueda puntual si falta informacion; la ausencia en el grafo no demuestra que algo no exista.
4. Si falta el grafo, generarlo con `.\graphify.cmd extract . --code-only`. Si esta desactualizado respecto de los cambios relevantes, ejecutar `.\graphify.cmd update .` antes de apoyarse en el para decidir.
5. Despues de cada conjunto coherente de cambios y antes de entregar la tarea, ejecutar `.\graphify.cmd update .` y comprobar que termino correctamente. Si solo se leyo el proyecto y el grafo sigue vigente, no reconstruirlo sin necesidad.
6. Para cambios de documentacion, revisar tambien la actualizacion semantica mediante la habilidad `$graphify` y su flujo `--update`. El comando local `update .` no garantiza una actualizacion semantica completa de documentos. No afirmar que la documentacion esta completamente indexada si solo se ejecuto la actualizacion local.
7. Si Graphify no esta instalado, seguir [su guia](documentacion/GRAPHIFY.md). Si falla, informar el error, continuar con lecturas dirigidas y declarar la actualizacion pendiente. No inventar resultados ni ocultar que el grafo esta incompleto.
8. En la entrega, indicar brevemente si se consulto y actualizo el grafo, junto con las verificaciones funcionales. Ahorrar contexto no sustituye leer instrucciones aplicables, revisar codigo ni probar cambios.

El grafo es compartido por ambos modulos: conservar `graphify-out/` en la raiz y coordinar las escrituras si otro agente lo esta regenerando. No crear un grafo aislado por modulo como parte de este flujo.
