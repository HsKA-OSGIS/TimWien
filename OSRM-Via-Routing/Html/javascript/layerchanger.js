//------------------------------------------------------------------------------
//	$Id: layerchanger.js,v 1.32 2014/09/03 09:08:48 wolf Exp wolf $
//------------------------------------------------------------------------------
//	Erklaerung:	http://www.netzwolf.info/kartografie/openlayers/layerchanger.htm
//------------------------------------------------------------------------------
//	Fragen, Wuensche, Bedenken, Anregungen?
//	<openlayers(%40)netzwolf.info>
//------------------------------------------------------------------------------
//
//	Based on OpenLayers.Control.LayerChanger provided by OpenLayers 2.13.1
//
//	http://dev.openlayers.org/releases/OpenLayers-2.13.1/lib/OpenLayers/Control/LayerSwitcher.js
//
//------------------------------------------------------------------------------

OpenLayers.Control.LayerChanger = OpenLayers.Class(OpenLayers.Control, {

	//----------------------------------------------------------------------
	//	Configuration
	//----------------------------------------------------------------------

	controls:		null,
	maxGroupsOpen:		null,

	minimizeButtonImageURL: null,
	maximizeButtonImageURL: null,

	withOpacityButtons:	false,
	minOpacity:		0.5,
	opacityStep:		0.1,

	withFullZoomButton:	false,
	withDeleteButton:	false,
	hideMinMaxButtons:	false,

	enableAutoClose:	false,	// autoclose groups if box overflows map

	toggleKeyCode:		null,
	defaultPosition:	0,

	//----------------------------------------------------------------------
	//	children of this.div:
	//----------------------------------------------------------------------

	layersDiv:		null,
	minimizeDiv:		null,
	maximizeDiv:		null,

	//----------------------------------------------------------------------
	//	State
	//----------------------------------------------------------------------

	minimized:		null,
	mustRedraw:		false,
	layerStates:		null,
	groupsHidden:		null,
	minTableWidth:		100,

	//----------------------------------------------------------------------
	//	Text
	//----------------------------------------------------------------------

	textHeaderControls:	'Steuerelemente',

	textShowLayerChanger:	'Zeigt den Layerchanger',
	textHideLayerChanger:	'Versteckt den LayerChanger',

	textShowGroup:		'Zeigt diese Gruppe',
	textHideGroup:		'Versteckt diese Gruppe',

	textShowLayer:		'Zeigt diese Ebene',
	textHideLayer:		'Versteckt diese Ebene',
	textMakeBaseLayer:	'W'+String.fromCharCode(228)+'hlt diese Ebene als Basisebene',

	textShowControl:	'Zeigt dieses Steuerelement',
	textHideControl:	'Versteckt dieses Steuerelement',

	textMinusLayerOpacity:	'Verringert die Deckkraft der Ebene',
	textPlusLayerOpacity:	'Erh'+String.fromCharCode(246)+'ht die Deckkraft der Ebene',

	textMinusControlOpacity:'Verringert die Deckkraft des Steuerelements',
	textPlusControlOpacity:	'Erh'+String.fromCharCode(246)+'ht die Deckkraft des Steuerelements',

	textFullZoom:		'Zoomt auf Ausdehnung',
	textDelete:		'Entfernt das Layer',

	labelButtonFullZoom:	String.fromCharCode(9632),	// Rectangle
	labelButtonDelete:	String.fromCharCode(215),	// multiply-x
			//	String.fromCharCode(9851),	// Recycling

	//----------------------------------------------------------------------
	//	Images
	//----------------------------------------------------------------------


	closerURL:	'data:image/png;base64,' +
		'iVBORw0KGgoAAAANSUhEUgAAABIAAAASAgMAAAAroGbEAA' +
		'AADFBMVEXAwMDMzMyZmZlmZmY5B4mWAAAAAXRSTlMAQObY' +
		'ZgAAACpJREFUCJljYFq1atUCBs7Q0NAEBlUwORUvOf3//7' +
		'8wEr9KiGkQk8G2AAAhACaFeLd5EwAAAABJRU5ErkJggg==',

	openerURL:	'data:image/png;base64,' +
		'iVBORw0KGgoAAAANSUhEUgAAABIAAAASAgMAAAAroGbEAAAAD' +
		'FBMVEXAwMDMzMyZmZlmZmY5B4mWAAAAAXRSTlMAQObYZgAAAD' +
		'RJREFUCJljYOBatWoBA8PS0NAEBqZQEMkJJlVDa+HkVGSy/v9' +
		'fOIkkjqweYgLENIjJYFsAVtEi7RlpX9gAAAAASUVORK5CYII=',

	//----------------------------------------------------------------------
	//	private variables
	//----------------------------------------------------------------------

	nextMinorPosition: null,

	//----------------------------------------------------------------------
	//	OpenLayers.Control:	Constructor
	//----------------------------------------------------------------------

	initialize: function(options) {

		OpenLayers.Control.prototype.initialize.apply(this, arguments);

		this.layerStates = [];
		this.groupsHidden= {};
	},

	//----------------------------------------------------------------------
	//	OpenLayers.Control:	Destructor
	//----------------------------------------------------------------------

	destroy: function() {

		this.map.events.un({
			addlayer:	this.redraw,
			changelayer:	this.redraw,
			removelayer:	this.redraw,
			changebaselayer:this.redraw,
			scope: this
		});

		if (this.div) this.div.innerHTML = '';

		OpenLayers.Control.prototype.destroy.apply(this, arguments);
	},

	//----------------------------------------------------------------------
	//	OpenLayers.Control:	Attached to map
	//----------------------------------------------------------------------

	setMap: function(map) {

		OpenLayers.Control.prototype.setMap.apply(this, arguments);

		this.map.events.on({
			addlayer:	this.redraw,
			changelayer:	this.redraw,
			removelayer:	this.redraw,
			changebaselayer:this.redraw,
			scope: this
		});

		if (this.toggleKeyCode) {

			var layer = this; // closure

			OpenLayers.Event.observe (document, 'keypress', function(evt) {

				if (evt.keyCode === layer.toggleKeyCode) {

					layer.toggleControl();
				}
			});
		}
	},

	//----------------------------------------------------------------------
	//	OpenLayers.Control:	Create HTML-Elements, return main <div>
	//----------------------------------------------------------------------

	draw: function() {

		OpenLayers.Control.prototype.draw.apply(this);

		var changer = this; // for closure

		//--------------------------------------------------------------
		//	allow bottom overflow
		//--------------------------------------------------------------

		if (this.enableAutoClose) {

			this.div.style.bottom = 'auto';
		}

		//--------------------------------------------------------------
		//	avoid mousedown events reaching the map
		//--------------------------------------------------------------

		this.div.onmousedown= function(evt) {

			if (evt.layerY<changer.layersDiv.offsetHeight)
				OpenLayers.Event.stop(evt);
		};

		//--------------------------------------------------------------
		//	layers div
		//--------------------------------------------------------------

		this.layersDiv = document.createElement('div');
		this.layersDiv.className = 'layersDiv';
		this.layersDiv.ondblclick = function(evt) { OpenLayers.Event.stop(evt); };

		this.div.appendChild(this.layersDiv);

		//--------------------------------------------------------------
		//	maximize button
		//--------------------------------------------------------------

		var imgURL = this.maximizeButtonImageURL || this.openerURL;

		this.maximizeDiv = OpenLayers.Util.createAlphaImageDiv(
			'OpenLayers_Control_MaximizeDiv', null, null, imgURL, 'absolute');

		OpenLayers.Element.addClass(this.maximizeDiv, 'maximizeDiv olButton');
		this.maximizeDiv.style.display = 'none';
		this.maximizeDiv.onclick = function(evt) {changer.maximizeControl(evt);};
		this.maximizeDiv.title = this.textShowLayerChanger;

		this.div.appendChild(this.maximizeDiv);

		//--------------------------------------------------------------
		//	minimize button div
		//--------------------------------------------------------------

		var imgURL = this.minimizeButtonImageURL || this.closerURL;

		this.minimizeDiv = OpenLayers.Util.createAlphaImageDiv(
			'OpenLayers_Control_MinimizeDiv', null, null, imgURL, 'absolute');

		OpenLayers.Element.addClass(this.minimizeDiv, 'minimizeDiv olButton');
		this.minimizeDiv.style.display = 'none';
		this.minimizeDiv.onclick = function(evt) {changer.minimizeControl(evt);};
		this.minimizeDiv.title = this.textHideLayerChanger;

		this.div.appendChild(this.minimizeDiv);

		//--------------------------------------------------------------
		//	make visible
		//--------------------------------------------------------------

		if (!this.outsideViewport) {

			if (this.minimized===false) {
				this.maximizeControl();
			} else {
				this.minimizeControl();
			}
		}

		this.redraw();

		return this.div;
	},

	//----------------------------------------------------------------------
	//	check if maps layer structure changed
	//----------------------------------------------------------------------

	checkRedraw: function() {

		if (this.map.layers.length != this.layerStates.length) {

			return true;
		}

		for (var i in this.layerStates) {

			var layerState	= this.layerStates[i];
			var layer	= this.map.layers [i];

			if ( (layerState.name != layer.name) ||
				 (layerState.inRange != layer.inRange) ||
				 (layerState.id != layer.id) ||
				 (layerState.visibility != layer.visibility) ) {
				return true;
			}
		}

		return false;
	},

	//----------------------------------------------------------------------
	//	create or recreate table
	//----------------------------------------------------------------------

	redraw: function(force) {

		if (force) this.layerStates = [];

		//--------------------------------------------------------------
		//	be lazy
		//--------------------------------------------------------------

		if (this.minimized===true) {

			this.mustRedraw	= true;
			return;
		}

		this.mustRedraw	= false;

		if (!this.checkRedraw()) return;

		//--------------------------------------------------------------
		//	create groups from configuration
		//--------------------------------------------------------------

		var layerGroupMap = {};
		var layerGroups   = [];

		if (this.layerGroups) for (var groupIndex in this.layerGroups) {

			var layerGroupInfo = this.layerGroups[groupIndex];

			var id = layerGroupInfo.id;
			if (!id || layerGroupMap[id]) continue;

			var layerGroup = {

				id:	id,
				name:	layerGroupInfo.name || id,
				trList:	[]
			};

			layerGroups.push (layerGroup);
			layerGroupMap[id]=layerGroup;

			if (this.groupsHidden[id]==null) {

				this.groupsHidden[id]=!!layerGroupInfo.hidden;
			}
		}

		//--------------------------------------------------------------
		//	prepend main group if missing
		//--------------------------------------------------------------

		if (!layerGroupMap.main) {

			var id = 'main';
			var layerGroup = {

				id:	id,
				name:	OpenLayers.i18n('Base Layer'),
				trList:	[]
			};

			layerGroups.unshift(layerGroup);
			layerGroupMap[id] = layerGroup;
		}

		//--------------------------------------------------------------
		//	append data group if missing
		//--------------------------------------------------------------

		if (!layerGroupMap.data) {

			var id = 'data';
			var layerGroup = {

				id:	id,
				name:	OpenLayers.i18n('Overlays'),
				trList:	[]
			};

			layerGroups.push (layerGroup);
			layerGroupMap[id]=layerGroup;
		}

		//--------------------------------------------------------------
		//	append ctrl group if missing
		//--------------------------------------------------------------

		if (!layerGroupMap.ctrl) {

			var id = 'ctrl';
			var layerGroup = {

				id:	id,
				name:	this.textHeaderControls,
				trList:	[]
			};

			layerGroups.push (layerGroup);
			layerGroupMap[id]=layerGroup;
		}

		//--------------------------------------------------------------
		//	groups
		//--------------------------------------------------------------

		var radioGroupMap = {};
		var linkGroupMap = {};

		//--------------------------------------------------------------
		//	assign controls to groups
		//--------------------------------------------------------------

		this.nextMinorPosition = 0;

		for (var controlIndex in this.map.controls) {

			var control = this.map.controls[controlIndex];

			if (control==this || control.displayInLayerChanger===false ||
				control.displayInLayerSwitcher===false) continue;

			if (!control.displayInLayerChanger &&
				!control.displayInLayerSwitcher && this.controls !== true) {

				if (!(this.controls instanceof Array)) continue;

				if (OpenLayers.Util.indexOf(this.controls, control)<0 &&
				OpenLayers.Util.indexOf(this.controls, control.CLASS_NAME)<0) {

					continue;
				}
			}

			// No config of 'Control' text cause it can't happen [tm]

			var title = control.title || control.name || control.CLASS_NAME &&
				control.CLASS_NAME.split('.').pop() || 'Control';

			//------------------------------------------------------
			//	add control to layer group
			//------------------------------------------------------

			var layerGroup	= control.layerGroup && layerGroupMap[control.layerGroup]
				|| layerGroupMap.ctrl;

			var isChecked = control.activate && control.deactivate ? control.active :
					control.div.style.display != 'none';

			//------------------------------------------------------
			//	radio and link groups
			//------------------------------------------------------

			if (control.radioGroup) {

				var layerList = radioGroupMap[control.radioGroup] || [];
				radioGroupMap[control.radioGroup] = layerList;
				layerList.push(control);
				control.radioPeers = layerList;
			}

			this.addObject (layerGroup, control, title, true, false, isChecked, false);
		}

		//--------------------------------------------------------------
		//	assign layers to groups
		//--------------------------------------------------------------

		var layers = this.map.layers.slice();
		this.layerStates = [];

		for (var layerIndex in layers) {

			//------------------------------------------------------
			//	prepare layer data
			//------------------------------------------------------

			var layer = layers[layerIndex];

			//------------------------------------------------------
			//	save state for change check
			//------------------------------------------------------

			this.layerStates.push ({
				id:		layer.id,
				name:		layer.name,
				visibility:	layer.visibility,
				inRange:	layer.inRange
			});

			//------------------------------------------------------
			//	get layer info
			//------------------------------------------------------

			if (!layer.displayInLayerChanger &&
				!layer.displayInLayerSwitcher) continue;

			var isBaseLayer	= layer.isBaseLayer;
			var isChecked	= isBaseLayer? layer==this.map.baseLayer : layer.getVisibility();
			var isDisabled	= !isBaseLayer && !layer.inRange;

			var layerGroup	= layer.layerGroup && layerGroupMap[layer.layerGroup]
				|| (isBaseLayer ? layerGroupMap.main : layerGroupMap.data);

			//------------------------------------------------------
			//	radio and link groups
			//------------------------------------------------------

			if (layer.radioGroup) {

				var layerList = radioGroupMap[layer.radioGroup] || [];
				radioGroupMap[layer.radioGroup] = layerList;
				layerList.push(layer);
				layer.radioPeers = layerList;
			}

			if (layer.linkGroup) {

				var layerList = linkGroupMap[layer.linkGroup] || [];
				linkGroupMap[layer.linkGroup] = layerList;
				layerList.push(layer);
				layer.linkPeers = layerList;
			}

			//------------------------------------------------------
			//	add layer to layer group
			//------------------------------------------------------

			this.addObject (layerGroup, layer, layer.name, false,
				isDisabled, isChecked, isBaseLayer);
		}

		//--------------------------------------------------------------
		//	create <table>
		//--------------------------------------------------------------

		var tableElement = document.createElement('table');
		tableElement.style.minWidth = this.minTableWidth + 'px';
		tableElement._changer = this;

		for (var layerIndex in layerGroups) {

			var layerGroup = layerGroups[layerIndex];
			if (layerGroup.trList.length==0) continue;

			//------------------------------------------------------
			//	sort trList
			//------------------------------------------------------

			layerGroup.trList.sort(function(a,b) {
				return a._layer._posInLayerChanger-b._layer._posInLayerChanger;
			});

			//------------------------------------------------------
			//	create header <tr><th> {layerGroupName}
			//------------------------------------------------------

			var isHidden = this.groupsHidden[layerGroup.id];

			var thElem = document.createElement('th');
			thElem.colSpan = 2 +
				(this.withFullZoomButton||this.withDeleteButton?1:0) +
				(this.withOpacityButtons||this.controlOpacity?1:0);
			thElem.onclick = this.onGroupVisibilityToggle;
			thElem.className = isHidden? 'hidden' : 'visible';
			thElem.title = isHidden ? this.textShowGroup : this.textHideGroup;
			thElem._changer= this;
			thElem._groupId= layerGroup.id;
			thElem.appendChild(document.createTextNode(layerGroup.name));

			//------------------------------------------------------
			//	create <tbody> and append <tr> from trList
			//------------------------------------------------------

			var groupBody = document.createElement('tbody');
			groupBody.style.display = isHidden ? 'none' : '';

			for (var trIndex in layerGroup.trList) {

				groupBody.appendChild(layerGroup.trList[trIndex]);
			}

			//------------------------------------------------------
			//	Append group header and group body to table
			//------------------------------------------------------

			var groupHeader = document.createElement('tr');
			groupHeader.className = 'layerChangerGroupHeader';
			groupHeader.appendChild (thElem);

			tableElement.appendChild(groupHeader);
			tableElement.appendChild(groupBody);
		}

		this.layersDiv.innerHTML = '';
		this.layersDiv.appendChild (tableElement);
	},

	//----------------------------------------------------------------------
	//	Add layer or control
	//----------------------------------------------------------------------

	addObject: function (layerGroup, object, name, isControl, isDisabled, isChecked, isBaseLayer) {
		var pos = parseInt(object.positionInLayerChanger);
		if (isNaN(pos)) pos = this.defaultPosition;
		object._posInLayerChanger = 1e5 * pos + ++this.nextMinorPosition;

		//--------------------------------------------------------------
		//	<tr>
		//--------------------------------------------------------------

		var trElem = document.createElement('tr');
		trElem._layer = object;

		if (isDisabled) trElem.className = 'disabled';

		layerGroup.trList.push(trElem);

		//--------------------------------------------------------------
		//	<td> <input>
		//--------------------------------------------------------------

		var tooltip =
			isControl && isChecked? this.textHideControl :
			isControl ? this.textShowControl :
			!isBaseLayer && isChecked? this.textHideLayer :
			!isBaseLayer ? this.textShowLayer :
			!isChecked? this.textMakeBaseLayer : '';

		var inputElem = document.createElement('input');

		inputElem.type		= isBaseLayer ? 'radio' : 'checkbox';
		inputElem.name		= name,
		inputElem.value		= name;
		inputElem.checked	= isChecked;
		inputElem.defaultChecked= isChecked;
		inputElem.disabled	= isDisabled;
		inputElem.className	= 'olButton';
		inputElem.title		= tooltip;
		inputElem.onclick	= this.onInputClick;

		var inputTdElem = document.createElement('td');
		inputTdElem.appendChild (inputElem);

		trElem.appendChild (inputTdElem);

		//--------------------------------------------------------------
		//	<td> <label>
		//--------------------------------------------------------------

		var labelElem = document.createElement('label');

		labelElem._input	= inputElem;
		labelElem.className	= 'labelElem olButton';
		labelElem.title		= object.description || '';
		labelElem.appendChild (document.createTextNode (name));

		labelElem.onclick = function() {this._input.click();};

		var labelTdElem = document.createElement('td');
		labelTdElem.appendChild (labelElem);

		trElem.appendChild (labelTdElem);

		//--------------------------------------------------------------
		//	<td> {<opacity-changer}
		//--------------------------------------------------------------

		if (this.withOpacityButtons || this.controlOpacity) {

			var container = document.createElement('td');
			container.className = 'opacityChanger';
			trElem.appendChild (container);

			if (object.div && (!isControl || object.div.firstChild)) {

				var minusButton = document.createElement('button');
				minusButton.className = 'minus';
				minusButton.title = isControl?
					this.textMinusControlOpacity : this.textMinusLayerOpacity;
				minusButton.appendChild(document.createTextNode(
					String.fromCharCode(8211))); // long-"-"
				minusButton.onclick = this.onMinusOpacity;

				container.appendChild (minusButton);

				var plusButton = document.createElement('button');
				plusButton.className = 'plus';
				plusButton.title = isControl?
					this.textPlusControlOpacity : this.textPlusLayerOpacity;
				plusButton.appendChild(document.createTextNode('+'));
				plusButton.onclick = this.onPlusOpacity;
				//plusButton.ondblclick = this.onMaxOpacity;
				container.appendChild (plusButton);
			}
		}

		//--------------------------------------------------------------
		//	<td> {autozoom}
		//--------------------------------------------------------------

		if (this.withFullZoomButton||this.withDeleteButton) {

			var container = document.createElement('td');
			container.className = 'autoZoom';
			trElem.appendChild (container);

			if (this.withFullZoomButton && object.getDataExtent && (
				object.strategies && object.strategies[0] &&
					object.strategies[0].CLASS_NAME=='OpenLayers.Strategy.Fixed'
				|| object.CLASS_NAME=='OpenLayers.Layer.Vector' && !object.strategies
				|| object.location && object.createHtmlFromData)) {

				var zoomButton = document.createElement('button');
				zoomButton.className = 'zoom';
				zoomButton.title = this.textFullZoom;
				zoomButton.disabled = !isChecked;
				zoomButton.appendChild(
					document.createTextNode(this.labelButtonFullZoom));
				zoomButton.onclick = this.onFullZoom;
				container.appendChild (zoomButton);
			}

			if (this.withDeleteButton && object.ephemeral) {

				var deleteButton = document.createElement('button');
				deleteButton.className = 'delete';
				deleteButton.title = this.textDelete;
				deleteButton.appendChild(
					document.createTextNode(this.labelButtonDelete));
				deleteButton.onclick = this.onDelete;
				container.appendChild (deleteButton);
			}
		}
	},

	//----------------------------------------------------------------------
	//	Remote control
	//----------------------------------------------------------------------

	setWithOpacityButtons: function (on) {

		this.withOpacityButtons = !!on;
		this.minTableWidth = 100;
		this.redraw(true);
	},

	setWithFullZoomButton: function (on) {

		this.withFullZoomButton = !!on;
		this.minTableWidth = 100;
		this.redraw(true);
	},

	setAllGroupsOpen: function (on) {

		var hide = !on;
		var changed = false;

		for (groupId in this.groupsHidden) {

			if (this.groupsHidden[groupId]!=hide) changed=true;
			this.groupsHidden[groupId] = hide;
		}

		if (changed) this.redraw(true);
	},

	//----------------------------------------------------------------------
	//	On click handler
	//----------------------------------------------------------------------

	onGroupVisibilityToggle: function (evt) {

		if (evt != null) OpenLayers.Event.stop(evt);

		var changer= this._changer;
		var tbody = this.parentElement.nextSibling;

		changer.minTableWidth = tbody.parentElement.offsetWidth;
		tbody.parentElement.style.minWidth = changer.minTableWidth + 'px';

		var hide = changer.groupsHidden[this._groupId] = !changer.groupsHidden[this._groupId];

		if (hide) {
			tbody.style.display='none';
			this.className = 'hidden';
			this.title = changer.textShowGroup;
		} else {
			tbody.style.display='';
			this.className = 'visible';
			this.title = changer.textHideGroup;
		}

		if (hide) return;

		//--------------------------------------------------------------
		//	if maxGroupsOpen eventually close groups
		//--------------------------------------------------------------

		if (changer.maxGroupsOpen) {

			var nGroupsOpen = 0;

			for (var element = tbody.parentElement.firstChild; element; element=element.nextSibling) {

				if (element.tagName != 'TR') continue;
				var thElement = element.firstChild;
				if (!changer.groupsHidden[thElement._groupId]) nGroupsOpen++;
			}

			for (var element = tbody.parentElement.lastChild; element; element=element.previousSibling) {

				if (nGroupsOpen <= changer.maxGroupsOpen) break;
				if (element.tagName != 'TR') continue;

				var thElement = element.firstChild;
				if (thElement==this || changer.groupsHidden[thElement._groupId]) continue;

				thElement.onclick(null);
				nGroupsOpen--;
			}
		}

		//--------------------------------------------------------------
		//	while box overflow, close groups
		//--------------------------------------------------------------

		if (!changer.enableAutoClose) return;

		if (changer.div.offsetTop+changer.div.offsetHeight<=changer.div.parentElement.offsetHeight)
			return;

		for (var element = tbody.parentElement.lastChild; element; element=element.previousSibling) {

			if (element.tagName != 'TR') continue;

			var thElement = element.firstChild;

			if (thElement==this || changer.groupsHidden[thElement._groupId]) continue;

			thElement.onclick(null);

			if (changer.div.offsetTop+changer.div.offsetHeight<=changer.div.parentElement.offsetHeight)
				break;
		}
	},

	onInputClick: function(evt) {

		if (evt != null) OpenLayers.Event.stop(evt);

		if (this.disabled) return;

		var layer  = this.parentElement.parentElement._layer;
		var changer= this.parentElement.parentElement.parentElement.parentElement._changer;

		if (this.type == 'radio') {

			changer.map.setBaseLayer(layer);

		} else if (layer.setVisibility) {

			layer.setVisibility(this.checked);

			//------------------------------------------------------
			//	link and radio groups
			//------------------------------------------------------

			if (layer.linkPeers) {

				for (var i in layer.linkPeers) {

					var peer = layer.linkPeers[i];
					if (peer==layer) continue;
					if (layer.radioPeers &&
						OpenLayers.Util.indexOf(layer.radioPeers,peer)>=0)
							continue;

					peer.setVisibility(this.checked);
				}
			}

			if (this.checked) changer.processRadioPeers(layer);

		} else if (layer.activate && layer.deactivate) {

			if (this.checked) {

				layer.activate();

				if (layer.div && layer.div.style.display=='none') {
					layer.div.style.display='';
				}

				changer.processRadioPeers(layer);

			} else {

				layer.deactivate();
				if (layer.div) layer.div.style.display='none';
			}
			changer.redraw(true);
		}
	},

	processRadioPeers: function(component) {

		if (!component.radioPeers) return;

		for (var i in component.radioPeers) {

			var peer = component.radioPeers[i];
			if (peer==component) continue;

			if (peer.setVisibility) {

				peer.setVisibility(false);
				continue;
			}

			if (peer.deactivate) peer.deactivate();
			if (peer.div) peer.div.style.display='none';
		}
	},

	onMinusOpacity: function(evt) {

		if (evt != null) OpenLayers.Event.stop(evt);

		var layer = this.parentElement.parentElement._layer;
		if (layer.visibility===false) return;

		var changer= this.parentElement.parentElement.parentElement.parentElement._changer;
		oldOpacity = parseFloat(layer.div.style.opacity);
		if (isNaN(oldOpacity)) oldOpacity = 1.0;
		layer.div.style.opacity=Math.max(changer.minOpacity, oldOpacity-changer.opacityStep);
	},

	onPlusOpacity: function(evt) {

		if (evt != null) OpenLayers.Event.stop(evt);

		var layer = this.parentElement.parentElement._layer;
		if (layer.visibility===false) return;

		var changer= this.parentElement.parentElement.parentElement.parentElement._changer;
		oldOpacity = parseFloat(layer.div.style.opacity);
		if (isNaN(oldOpacity)) oldOpacity = 1.0;
		layer.div.style.opacity=Math.min(1.0, oldOpacity+changer.opacityStep);
	},

	onMaxOpacity: function(evt) {

		if (evt != null) OpenLayers.Event.stop(evt);

		var layer = this.parentElement.parentElement._layer;
		if (!layer.visibility) return;

		layer.div.style.opacity=1.0;
	},

	onFullZoom: function(evt) {

		if (evt != null) OpenLayers.Event.stop(evt);

		var layer = this.parentElement.parentElement._layer;
		if (layer.getDataExtent && layer.getVisibility() &&
				layer.div && layer.div.firstChild) {

			layer.map.zoomToExtent(layer.getDataExtent());
		}
	},

	onDelete: function(evt) {

		if (evt != null) OpenLayers.Event.stop(evt);

		var layer = this.parentElement.parentElement._layer;
		layer.map.removeLayer(layer);
		layer.destroy();
	},

	//----------------------------------------------------------------------
	//	Maximizer / minimizer
	//----------------------------------------------------------------------

	toggleControl: function(evt) {

		if (this.minimized) {

			this.maximizeControl(evt);

		} else {

			this.minimizeControl(evt);
		}
	},

	maximizeControl: function(evt) {

		if (evt != null) OpenLayers.Event.stop(evt);

		this.minimized			= false;

		if (this.mustRedraw) this.redraw();

		this.layersDiv.style.display	= '';
		this.div.style.overflowY	= 'auto';
		this.div.style.overflowX	= 'hidden';

		if (!this.hideMinMaxButtons) {
			this.minimizeDiv.style.display	= '';
			this.maximizeDiv.style.display	= 'none';
		}
	},

	minimizeControl: function(evt) {

		if (evt != null) OpenLayers.Event.stop(evt);

		this.layersDiv.style.display	= 'none';
		this.div.style.overflowY	= '';
		this.div.style.overflowX	= '';

		if (!this.hideMinMaxButtons) {
			this.minimizeDiv.style.display	= 'none';
			this.maximizeDiv.style.display	= '';
		}

		this.minimized			= true;
	},

	CLASS_NAME: 'OpenLayers.Control.LayerChanger'
});

//------------------------------------------------------------------------------
//	$Id: layerchanger.js,v 1.32 2014/09/03 09:08:48 wolf Exp wolf $
//------------------------------------------------------------------------------
