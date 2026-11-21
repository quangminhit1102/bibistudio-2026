CREATE TABLE visitor_exclusion_settings (id TINYINT UNSIGNED PRIMARY KEY,revision INT UNSIGNED NOT NULL,rules JSON NOT NULL,CONSTRAINT visitor_exclusion_singleton CHECK (id=1)) ENGINE=InnoDB;
