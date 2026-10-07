# Paso 1: crear la estructura de trucks_db

Ejecuta este bloque primero. Crea las cinco colecciones, sus validaciones y sus índices. Si alguna de estas colecciones ya existe, el script se detiene sin modificarla.

## Cómo usarlo en MongoDB Compass

1. Conéctate a tu clúster.
2. Abre la consola integrada **mongosh**, identificada con `>_`.
3. Copia únicamente el contenido del bloque de código de abajo, completo, y pégalo en la consola.
4. Ejecútalo y revisa el mensaje final.

No copies el título, estas instrucciones ni los delimitadores de Markdown. Este archivo `.md` se usa para leer y copiar el código; no se ejecuta con `load()`.

## Código

```javascript
// Ejecutar con mongosh (por ejemplo, la consola integrada en Compass).
// NO ejecutar con node. No contiene credenciales ni elimina datos.
(() => {
  const database = db.getSiblingDB("trucks_db");
  const names = ["users", "drivers", "trucks", "trips", "locationPings"];
  const existing = database.getCollectionNames().filter(n => names.includes(n));
  if (existing.length) {
    throw new Error("Inicializacion detenida: ya existen " + existing.join(", ") +
      ". No se modifico ninguna coleccion. Si ya inicializaste, continua con 02_datos_prueba.js.");
  }

  const text = max => ({ bsonType: "string", minLength: 1, maxLength: max });
  const id = { bsonType: "objectId" };
  const date = { bsonType: "date" };
  const numeric = ["double", "int", "long", "decimal"];
  const coordinatePair = {
    bsonType: "array", minItems: 2, maxItems: 2,
    items: [
      { bsonType: numeric, minimum: -180, maximum: 180 },
      { bsonType: numeric, minimum: -90, maximum: 90 }
    ], additionalItems: false
  };
  const point = {
    bsonType: "object", required: ["type", "coordinates"], additionalProperties: false,
    properties: { type: { enum: ["Point"] }, coordinates: coordinatePair }
  };
  const line = {
    bsonType: "object", required: ["type", "coordinates"], additionalProperties: false,
    properties: {
      type: { enum: ["LineString"] },
      coordinates: { bsonType: "array", minItems: 2, items: coordinatePair }
    }
  };
  // Se permiten campos extra para facilitar la integracion con Mongoose (__v, etc.).
  // El backend debe usar una lista permitida de campos en cada endpoint.
  const schema = (required, properties) => ({
    bsonType: "object", required: ["_id", ...required],
    properties: { _id: id, ...properties }
  });
  const audit = { createdAt: date, updatedAt: date };
  const specs = {
    users: { $jsonSchema: schema(
      ["email", "passwordHash", "rol", "activo", "createdAt", "updatedAt"], {
        email: { ...text(254), pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$" },
        // El backend debe producir un hash seguro; esta regla solo valida el tipo y longitud.
        passwordHash: { bsonType: "string", minLength: 20, maxLength: 512 },
        rol: { enum: ["administrador", "conductor"] }, activo: { bsonType: "bool" }, ...audit
      }) },
    drivers: { $jsonSchema: schema(
      ["userId", "nombre", "licencia", "telefono", "activo", "createdAt", "updatedAt"], {
        userId: { bsonType: ["objectId", "null"] }, nombre: text(120),
        licencia: text(40), telefono: { bsonType: ["string", "null"], maxLength: 25 },
        activo: { bsonType: "bool" }, ...audit
      }) },
    trucks: { $jsonSchema: schema(
      ["placa", "qrCode", "modelo", "activo", "createdAt", "updatedAt"], {
        placa: { ...text(20), pattern: "^[A-Z0-9-]+$" }, qrCode: text(200),
        modelo: text(100), activo: { bsonType: "bool" }, ...audit
      }) },
    trips: {
      $and: [
        { $jsonSchema: {
          ...schema(["truckId", "driverId", "rutaPlaneada", "estado", "inicio", "fin", "createdAt", "updatedAt"], {
            truckId: id, driverId: id,
            rutaPlaneada: { anyOf: [{ bsonType: "null" }, line] },
            estado: { enum: ["activo", "finalizado"] }, inicio: date,
            fin: { bsonType: ["date", "null"] }, ...audit
          }),
          oneOf: [
            { properties: { estado: { enum: ["activo"] }, fin: { bsonType: "null" } } },
            { properties: { estado: { enum: ["finalizado"] }, fin: { bsonType: "date" } } }
          ]
        } },
        { $expr: { $or: [{ $eq: ["$fin", null] }, { $gte: ["$fin", "$inicio"] }] } }
      ]
    },
    locationPings: { $jsonSchema: schema(
      ["pingId", "tripId", "truckId", "coords", "velocidad", "timestamp", "receivedAt"], {
        pingId: text(100), tripId: id, truckId: id, coords: point,
        // null significa que no se pudo medir; cero significa detenido.
        velocidad: { bsonType: [...numeric, "null"], minimum: 0 },
        timestamp: date, receivedAt: date
      }) }
  };
  for (const name of names) {
    const result = database.createCollection(name, {
      validator: specs[name], validationLevel: "strict", validationAction: "error"
    });
    if (!result.ok) throw new Error("No se pudo crear " + name);
    print("Coleccion creada: " + name);
  }
  const indexes = {
    users: [
      { key: { email: 1 }, name: "uq_users_email", unique: true,
        collation: { locale: "en", strength: 2 } }
    ],
    drivers: [
      { key: { licencia: 1 }, name: "uq_drivers_licencia", unique: true },
      { key: { userId: 1 }, name: "uq_drivers_user", unique: true,
        partialFilterExpression: { userId: { $type: "objectId" } } }
    ],
    trucks: [
      { key: { placa: 1 }, name: "uq_trucks_placa", unique: true },
      { key: { qrCode: 1 }, name: "uq_trucks_qr", unique: true }
    ],
    trips: [
      { key: { truckId: 1 }, name: "uq_trip_activo_por_camion", unique: true,
        partialFilterExpression: { estado: "activo" } },
      { key: { truckId: 1, inicio: -1, _id: -1 }, name: "ix_trips_camion_fecha" },
      { key: { driverId: 1, inicio: -1, _id: -1 }, name: "ix_trips_conductor_fecha" },
      { key: { inicio: -1, _id: -1 }, name: "ix_trips_fecha" }
    ],
    locationPings: [
      { key: { tripId: 1, pingId: 1 }, name: "uq_ping_por_viaje", unique: true },
      { key: { tripId: 1, timestamp: -1, _id: -1 }, name: "ix_pings_viaje_fecha" },
      { key: { truckId: 1, timestamp: -1, _id: -1 }, name: "ix_pings_camion_fecha" },
      { key: { coords: "2dsphere" }, name: "ix_pings_coords" }
    ]
  };
  for (const name of names) {
    const result = database.runCommand({ createIndexes: name, indexes: indexes[name] });
    if (!result.ok) throw new Error("No se pudieron crear los indices de " + name);
    print("Indices creados: " + name);
  }
  print("OK: trucks_db creada con 5 colecciones y 13 indices secundarios. Sigue con 02_datos_prueba.js.");
})();
```
