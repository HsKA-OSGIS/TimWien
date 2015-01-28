




$(document).ready(function(){

$( "#slider" ).slider({
      range: "min",
      min: 0,
      max: 100,
      value: opacities[2],
      slide: function(e, ui) {
       opacity(ui.value);
          $( "#amount1" ).val( ui.value );
	
	if(ui.value < 5){
          $("#amount").attr("style","border:2; color:#00FF66; font-weight:bold;");
          $( "#slider-range-max" ).css("background-color","#ff0000");
         }
        else
          $("#amount").attr("style","border:2; color:#00ff00; font-weight:bold;");
	}
      });
	$( "#amount1" ).val( $( "#slider" ).slider( "value" ) );
});








