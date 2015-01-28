<?php 

// Datenbankverbindung
include 'connection.php';



// Abfrage
$result = pg_query($db, 

"
SELECT 
	e, n

FROM 
	".$_GET["category"]."

WHERE 
	acos (
      cos ( radians(".$_GET["plat"].") )
      * cos( radians( n ) )
      * cos( radians( e ) - radians(".$_GET["plon"].") )
      + sin ( radians(".$_GET["plat"].") )
      * sin( radians( n ) )) * 6371 < ".$_GET["radius"]."
");  




if (!$result) {
  echo "Ein Fehler ist aufgetreten!\n";
  exit;
}


// GeoJSON
$geojson = array(
       'type'      => 'FeatureCollection',
       'features'  => array()
); 

while ($row = pg_fetch_assoc($result)) {
	$feature = array(
		'type' => 'Feature', 
		'geometry' => array(
		   'type' => 'Point',
		   'coordinates' => array($row['e'], $row['n'])
		),
		'properties' => array(),
	);

	// Add feature array to feature collection array
	array_push($geojson['features'], $feature);

	//echo $row['id']; 
	//echo "<br />\n";
	//echo $row['name'];  
	//echo "<br />\n"; 
}
//Ausgabe

//header("Content-Type: application/json");

echo json_encode($geojson, JSON_PRETTY_PRINT);





//print "SELECT * FROM bars WHERE radius = ".$_GET[radius]."";

//array($_GET["radius"], $_GET["category"], $_GET["plat"])

?>


