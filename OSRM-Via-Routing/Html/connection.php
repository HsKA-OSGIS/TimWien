<?php
	$db = pg_connect("host=localhost port=5432 dbname=Tim_Wien_v2 user=user password=user");
	if (!$db) {
		echo "Konnte keine Verbindung aufbauen :-(\n";
		exit;
	}
?>	