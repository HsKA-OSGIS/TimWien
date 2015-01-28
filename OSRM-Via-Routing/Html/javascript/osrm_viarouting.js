//------------------------------------------------------------------------------
//	$Id: osrm_viarouting.js,v 1.6 2014/08/23 15:30:15 wolf Exp wolf $
//------------------------------------------------------------------------------
//	Erklaerung:	http://www.netzwolf.info/kartografie/openlayers/osrm_viarouting.htm
//------------------------------------------------------------------------------
//	Fragen, Wuensche, Bedenken, Anregungen?
//	<openlayers(%40)netzwolf.info>
//------------------------------------------------------------------------------
//	See: https://github.com/Project-OSRM/osrm-backend/wiki/Server-api
//------------------------------------------------------------------------------

OpenLayers.Control.OSRMViaRouting=OpenLayers.Class(OpenLayers.Control, {

	//----------------------------------------------------------------------
	//	config
	//----------------------------------------------------------------------

	title: 'Routing',
	routingURL: 'http://router.project-osrm.org/viaroute?',

	displayInLayerSwitcher: true,

	cursor: 'crosshair',
	busyCursor: 'progress',
	showAlternatives: false,

	routeStyle: {
		strokeColor: 'blue',
		strokeWidth: 9,
		strokeOpacity: 0.5
	},

	alternativeStyle: {
		strokeColor: '#000099',
		strokeWidth: 5,
		strokeOpacity: 0.5
	},

	startMarkerStyle: {

		pointRadius: 10,
		strokeWidth: 2,
		strokeColor: 'red',
		fillColor: 'white',
		fillOpacity: 0.5

		//externalGraphic: '/i/ol/nadel_rot_26x30.png',
		//graphicWidth: 24,
		//graphicHeight: 25,
		//graphicXOffset: 0,
		//graphicYOffset: -25
	},

	viaMarkerStyle: {

		pointRadius: 10,
		strokeWidth: 2,
		strokeColor: 'yellow',
		fillColor: 'white',
		fillOpacity: 0.5

		//externalGraphic: '/i/ol/nadel_gelb_24x25.png',
		//graphicWidth: 24,
		//graphicHeight: 25,
		//graphicXOffset: 0,
		//graphicYOffset: -25
	},

	activeMarkerStyle: {

		pointRadius: 10,
		strokeWidth: 2,
		strokeColor: 'blue',
		fillColor: 'white',
		fillOpacity: 0.5

		//externalGraphic: '/i/ol/nadel_blau_28x28.png',
		//graphicWidth: 28,
		//graphicHeight: 28,
		//graphicXOffset: 0,
		//graphicYOffset: -28
	},

	formatSummary: function(meters, seconds) {

		var mins = Math.ceil (seconds/60);
		var h_mm = Math.floor(mins/60)+':'+((mins%60/100).toFixed(2)+'').substring(2);
		var km = (meters / 1000).toFixed(2);
		return km + String.fromCharCode(8198) + 'km';    //, ' + h_mm + String.fromCharCode(8198) + 'h';
	},

	jsonpBaseId: 'osrmViaRoutingCallback',

	jsonpTimeout: 5000,

	//----------------------------------------------------------------------
	//	local vars
	//----------------------------------------------------------------------

	layer:	null,

	lonLats:null,
	points:	null,

	nPoints: null,
	activeIndex: null,
	markers:null,

	//----------------------------------------------------------------------
	//	ol control methods
	//----------------------------------------------------------------------

	draw: function () {

		this.handler = new OpenLayers.Handler.Click (this, {click: this.onclick}, {});

		var control = this;

		window[this.callbackFunction] = function(result) {

			control.processRouterResult(result);
		};

		this.boundOnKeypress = function (evt) {

			return control.onKeypress (evt);
		};
	},

	activate: function() {

		OpenLayers.Control.prototype.activate.apply(this);
		this.reset();
		this.map.div.style.cursor = this.cursor;
	},

	deactivate: function() {

		OpenLayers.Control.prototype.deactivate.apply(this);
		this.reset();
		this.map.div.style.cursor = null;
	},

	//----------------------------------------------------------------------
	//	auxiliary methods
	//----------------------------------------------------------------------

	reset: function() {

		OpenLayers.Event.stopObserving (document, 'keypress', this.boundOnKeypress);

		if (!this.layer) {

			this.layer = new OpenLayers.Layer.Vector('Route', {

				visibility: false,
				displayInLayerSwitcher: false,
				attribution:
'Routing '+String.fromCharCode(169)+' <a target="_blank" href="http://project-osrm.org/">OSRM</a>'
			});

			this.map.addLayer(this.layer);
		}

		this.layer.destroyFeatures();
		this.layer.setVisibility(false);
		this.points = [];
		this.lonLats= [];
		this.nPoints= 0;
		this.activeIndex = -1;
		this.markers= null;
	},

	//----------------------------------------------------------------------
	//	event handler
	//----------------------------------------------------------------------

	onclick: function (evt) {

		if (!evt.ctrlKey) return true;

		var lonLat=this.map.getLonLatFromViewPortPx(evt.xy);
		var point = new OpenLayers.Geometry.Point(lonLat.lon, lonLat.lat);
		lonLat.transform(this.map.getProjectionObject(),this.map.displayProjection);

		this.activeIndex++;
		this.points.splice(this.activeIndex,  0, point);
		this.lonLats.splice(this.activeIndex, 0, lonLat);
		this.nPoints++;

		if( this.nPoints==1) this.layer.setVisibility(true);

		if (this.points.length==1) {

			OpenLayers.Event.observe (document, 'keypress', this.boundOnKeypress);
		}

		this.update();

		return false;
	},

	boundOnkeypress: null,

	onKeypress: function (evt) {

		switch (evt.keyCode) {

		case 37: // Cursor left

			if (this.nPoints<2 || this.activeIndex<1) break;
			this.activeIndex--;
			this.updateMarkers();
			return false;

		case 39: // Cursor right

			if (this.activeIndex<this.nPoints-1) {

				this.activeIndex++;
				this.updateMarkers();
				return false;
			}

			if (this.nPoints>=this.points.length) return false;

			this.nPoints++;
			this.activeIndex++;

			this.update();
			return false;

		case 8: // Backspace

			if (this.nPoints<=1 || evt.shiftKey) {

				this.reset();
				return false;
			}

			if (this.activeIndex<this.nPoints-1) {

				this.points.splice(this.activeIndex,  1);
				this.lonLats.splice(this.activeIndex, 1);
			}

			this.nPoints--;

			if (this.activeIndex>0) {

				if (evt.ctrlKey || this.activeIndex>=this.nPoints) this.activeIndex--;
			}

			this.update();
			return false;

		case 27: // ESC

			if (this.points.length<2) break;
			this.map.zoomToExtent(this.layer.getDataExtent());
			return false;
		}

		return true;
	},

	//----------------------------------------------------------------------
	//	auxiliary methods
	//----------------------------------------------------------------------

	updateMarkers: function() {

		this.layer.removeFeatures(this.markers);
		this.markers=[];

		for (var index=0; index<this.nPoints; index++) {

			var style = index==this.activeIndex? this.activeMarkerStyle :
				index==0? this.startMarkerStyle : this.viaMarkerStyle;

			var marker = new OpenLayers.Feature.Vector(this.points[index], null, style);
			this.markers.push(marker);
		}

		this.layer.addFeatures(this.markers);
	},

	//----------------------------------------------------------------------------
	//	Routing
	//----------------------------------------------------------------------------

	update: function () {

		if (this.nPoints<2) {

			this.layer.destroyFeatures();
			this.updateMarkers();
			return;
		}

		this.updateMarkers();

		//--------------------------------------------------------------
		//	OSRM request URL
		//--------------------------------------------------------------

		var url = this.routingURL + 'alt=' + this.showAlternatives + '&instructions=true&jsonp=#';

		for (var i=0; i<this.nPoints; i++) {

			url += '&loc=' + this.lonLats[i].lat + ',' + this.lonLats[i].lon;
		}

		//--------------------------------------------------------------
		//	start jsonp request
		//--------------------------------------------------------------

		this.map.div.style.cursor = this.busyCursor;

		this.jsonpRequest(url, this.onRouterResult, this.onRouterTimeout);

		return;

		//--------------------------------------------------------------
		//	use demo routing result
		//--------------------------------------------------------------

		var control=this;
		window.setTimeout(function() {

			control.processRouterResult(control.demo_result);
		}, 3000);
	},

	onRouterTimeout: function (url) {

		this.map.div.style.cursor = this.cursor;

		alert ('OSRM: Timeout nach ' + this.jsonpTimeout/1000 + ' Sekunden');
	},

	onRouterResult: function (result, url) {

		this.map.div.style.cursor = this.cursor;

		if (result.status) {

			alert ('OSRM: ' + result.status_message + ' [status ' + result.status + ']');
			return;
		}

		var routes = [];

		routes.push(this.createRouteFeature(
			result.route_geometry,
			result.route_summary,
			result.route_name,
			result.found_alternative? 'Hauptvorschlag' : null,
			this.routeStyle));

		if (result.found_alternative) {

			for (var i=0; i<result.alternative_geometries.length; i++) {

				routes.push(this.createRouteFeature(
					result.alternative_geometries[i],
					result.alternative_summaries[i],
					result.alternative_names[i],
					result.alternative_geometries.length<2?
						'Alternative' : 'Alternative ' + (i+1),
					this.alternativeStyle));
			}
		}

		this.markers=null;
		this.layer.destroyFeatures();
		this.layer.addFeatures(routes);
		this.updateMarkers();

		this.map.setLayerIndex(this.layer, this.map.layers.length);
	},

	createRouteFeature: function (geometry, summary, name, header, style) {

		var lonLats = this.decodeOSRMGeometry(geometry);
		var distance= this.formatSummary (summary.total_distance, summary.total_time);

		var info = [];
		if (header) info.push (header+':');
		if (name) info.push (name.join(', '));
		if (distance) info.push (distance);
		if (info.length) {

			style=OpenLayers.Util.extend(null, style);
			style.graphicTitle = info.join('\n');
		}

		var points=[];

		for (var i in lonLats) {

			var p = new OpenLayers.Geometry.Point(lonLats[i][0],lonLats[i][1]).
				transform(new OpenLayers.Projection('EPSG:4326'), this.map.getProjectionObject());
			points.push(p);
		}

		return new OpenLayers.Feature.Vector(
			new OpenLayers.Geometry.LineString(points), null, style);
	},

	decodeOSRMGeometry: function (encoded) {

		var lat=0, lon=0, result=[];

		for (var index=0; index<encoded.length;) {

			var value = 0;

			for (var shift=0;;shift+=5) {

				var digit = encoded.charCodeAt(index++) - 63;
				value |= (digit & 0x1f) << shift;
				if (digit<0x20) break;
			}

			lat += ((value & 1) ? ~(value >> 1) : (value >> 1));

			value = 0;

			for (var shift=0;;shift+=5) {

				var digit = encoded.charCodeAt(index++) - 63;
				value |= (digit & 0x1f) << shift;
				if (digit<0x20) break;
			}

			lon += ((value & 1) ? ~(value >> 1) : (value >> 1));

			result.push([lon * 1e-6, lat * 1e-6]);
		}

		return result;
	},

	//----------------------------------------------------------------------
	//	JSONP request (w/o using global variables)
	//----------------------------------------------------------------------

	jsonpSequence: 0,

	jsonpCancel: function (requestId) {

		var scriptNode = document.getElementById (requestId);
		if (!scriptNode) return false;

		scriptNode.parentElement.removeChild (scriptNode);
		return true;
	},

	jsonpRequest: function (url, onResponse, onTimeout) {

		//--------------------------------------------------------------
		//	get requestId and patch url
		//--------------------------------------------------------------

		var requestId = this.jsonpBaseId + '_' + ++this.jsonpSequence;
		var scriptURL = url.replace (/#/, requestId);

		//--------------------------------------------------------------
		//	attach jsonp callback and timeout handler
		//--------------------------------------------------------------

		var responseCallback= onResponse;
		var timeoutCallback = onTimeout;
		var control = this;

		var timeoutId = window.setTimeout(function(){

			if (!control.jsonpCancel(requestId)) return;
			if (timeoutCallback) timeoutCallback.apply(control, [scriptURL]);
		}, 5000);

		window[requestId] = function (data) {

			//-------------------------------------------------
			//	cleanup callback structure
			//-------------------------------------------------

			control.jsonpCancel(requestId);

			//-------------------------------------------------
			//	callback
			//-------------------------------------------------

			responseCallback.apply (control, [data, scriptURL]);
		};

		var scriptNode = document.createElement ('script');
		scriptNode.id  = requestId;
		scriptNode.src = scriptURL;

		document.getElementsByTagName('BODY')[0].appendChild (scriptNode);

		return requestId;
	},

	//----------------------------------------------------------------------
	//	demo routing result
	//----------------------------------------------------------------------

	demo_result: {route_geometry: 'qg~c`B}_ugLvNfCpIjD`LDpUmAhCCbHoBhHgC|JjAxJ?nJq@lCuBjQqQwAch@gCkl@rB{SdE_M`MuXvBaLVc_@y@yx@vBqPjCqGvAaBxNyH`h@c@p{@hFnNjC~\\xK`MjC|R~BlXVzf@sCxf@b@dr@cAp]oBdXeD`NcEhUiKf`Ayy@rToP`O_OjZiXjc@_^~VcWr]wWn_Aw_@tv@kYdVaMjf@cRvyA{j@pe@mSfh@eRxoAak@to@o[dsAcs@f}@ei@fThhAdUneA|]j|AzXfgAn|@dsDl[fuA`nG}oA|jAkSt|Ac[b`@iJjlE_x@bYcFpjHggAreBqVlGdBhHzGd@fGz@hGjAfDxFtIzKrDjJm@pEwClEuFpFyNzCqH`G}GlE}Bd{Fi\\hc@sD`jAqEnv@kEjnCcTr_BqGtlQy_Al~AgEvpAd@~`FzRd}e@xqB|{AjI`wAfLpjAfNv_S~`Db{AfQ~{@bEtj@Dj`@q@pj@cFdd@{Hvj@yOjg@qSjV}K~_@eTn_@sXfo@wl@|n@{t@pn@o~@xm@sfAny@sbBnjNoiZvo@gtAtuFiwL|w@caBti@mcA~k@u`A`_@yh@dr@w|@~dAofAbs@yl@|w@{l@bfM}cJ|vQ{rM`x@_h@h~BgdBhiJcwGtfEe~C`jBiwAvz@mu@~}@i}@za@eb@huBc|BllC}mDnqAelBtn@ucAx{B}`Ep_@eu@df@ybAxn@wvAt_A_}BvaAglCbaDyjJl\\_fAhSut@lR}w@lRkaAlRaiArWkiBrr@whFlx@qjGvM}hAbOufAxUcrAhRm{@hXa`A|U{o@dVij@lR}^lIsLdi@c}@pS}V`}@iz@fIqCdIeAhCfClCfBpDv@tDLfI{CrCyC`CqE`CeJx@oKUoJbByFxAsCpDiDd\\kInQgAbUr@~Fd@`t@vMdNCjWzB~SK|LqAjo@{Q|OyGjMmKlL_OjGcK~K{Z|EcRnTcnAp]aiBfe@yjDxJct@b@sOvIwq@bF}\\rEcVfTot@t@gKLmJu@wPuT_gAyLgi@oKw`@{W{gAoOan@}ZaqAmHw^w[ynAeAaIoA}KuB}Vu@wOi@sN^{k@|l@Gp@al@F}NoAwn@bq@L'},

	CLASS_NAME: 'OpenLayers.Control.OSRMViaRouting'
});

//------------------------------------------------------------------------------
//	$Id: osrm_viarouting.js,v 1.6 2014/08/23 15:30:15 wolf Exp wolf $
//------------------------------------------------------------------------------
