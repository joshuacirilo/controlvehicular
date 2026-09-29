# Graphify en Control Vehicular

Instalado: paquete oficial `graphifyy==0.9.71` en `.venv-graphify/`.
Origen: https://github.com/Graphify-Labs/graphify
Es una herramienta de desarrollo, no una dependencia de la aplicacion.

## Restaurar la instalacion

Requiere uv. Desde la raiz del proyecto:

```powershell
.\scripts\install-graphify.cmd
.\graphify.cmd --help
```

La habilidad esta en `.codex/skills/graphify/` y las instrucciones en `AGENTS.md`.
En Codex invocar `$graphify`. Los comandos .cmd funcionan desde PowerShell sin
cambiar la politica de ejecucion de scripts de Windows.

## Uso

```powershell
.\graphify.cmd extract . --code-only
.\graphify.cmd update .
.\graphify.cmd query "Como se relacionan los modulos de vehiculos?"
.\graphify.cmd explain "NombreDeClase"
.\graphify.cmd path "ClaseA" "ClaseB"
```

Usar nombres que existan en el codigo. Consultar el grafo antes de investigar
relaciones y actualizarlo despues de modificar codigo.

Los resultados locales estan en `graphify-out/` y no se versionan. La extraccion
`--code-only` no llama a modelos ni requiere API. El analisis semantico de documentos
requiere el asistente o un backend configurado. `.graphifyignore` excluye el entorno,
la cache y la configuracion del asistente.
