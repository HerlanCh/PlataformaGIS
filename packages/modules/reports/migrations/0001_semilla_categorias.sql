-- Semilla: las cinco categorías del MVP (SRS 3.1). Una prueba verifica que coincidan
-- con MVP_CATEGORIES del dominio.
INSERT INTO "categorias" ("codigo", "nombre", "ttl_minutos", "radio_duplicado_m", "es_sensible") VALUES
	('bloqueo', 'Bloqueo o protesta vial', 360, 100, false),
	('accidente', 'Accidente de tránsito', 180, 50, false),
	('robo', 'Hecho delictivo / robo', 120, 200, true),
	('infraestructura', 'Derrumbe / vía dañada / fuga', 1440, 50, false),
	('jauria', 'Jauría de perros agresivos', 120, 150, false);
